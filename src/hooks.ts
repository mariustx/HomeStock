import { useCallback, useEffect, useState } from 'react';
import { db } from './db';
import type {
  InventoryItem,
  RestockEntry,
  ShoppingItem,
  ProductInput,
  RestockInput,
  ShoppingItemInput,
  TrackingMode,
  PriceBasis,
} from './types';
import { restockAddAmount } from './types';

const sortAlpha = (a: InventoryItem, b: InventoryItem) => a.product.localeCompare(b.product);

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function insertPriceEntry(opts: {
  inventoryId: string;
  price: number;
  restockedAt: string;
  store?: string | null;
  notes?: string | null;
  trackingMode?: TrackingMode | null;
  packagesPurchased?: number | null;
  quantity?: number;
  priceBasis?: PriceBasis | null;
}): Promise<void> {
  await db.restock_history.add({
    id: generateId(),
    inventory_id: opts.inventoryId,
    price: opts.price,
    quantity: opts.quantity ?? 0,
    packages_purchased: opts.packagesPurchased ?? null,
    tracking_mode: opts.trackingMode ?? null,
    restocked_at: opts.restockedAt,
    store: opts.store?.trim() || null,
    notes: opts.notes?.trim() || null,
    price_basis: opts.priceBasis ?? null,
  });
}

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.inventory.orderBy('product').toArray();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addItem = useCallback(async (input: ProductInput) => {
    const id = generateId();
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      id,
      product: input.product.trim(),
      brand: input.brand?.trim() || null,
      variant: input.variant?.trim() || null,
      specification: input.specification?.trim() || null,
      package_size: null,
      unit: input.unit.trim(),
      tracking_mode: input.tracking_mode,
      purchase_package: input.purchase_package?.trim() || null,
      units_per_package: input.units_per_package ?? 1,
      count: input.count,
      min_stock: input.min_stock ?? 0,
      notes: input.notes?.trim() || null,
      is_on_manual_list: false,
      opened_at: input.openedAt ?? null,
      restock_enabled: input.restock_enabled !== false,
      price_basis: input.price_basis ?? null,
      created_at: now,
    };
    await db.inventory.add(newItem);
    setItems((prev) => [...prev, newItem].sort(sortAlpha));
    if (input.price != null && input.price > 0) {
      await insertPriceEntry({
        inventoryId: id,
        price: input.price,
        restockedAt: input.purchaseDate || new Date().toISOString().split('T')[0],
        store: input.store ?? null,
        trackingMode: input.tracking_mode,
        quantity: 0,
        priceBasis: input.price_basis ?? null,
      });
    }
    return newItem;
  }, []);

  const updateItem = useCallback(async (id: string, input: ProductInput) => {
    const existing = await db.inventory.get(id);
    if (!existing) throw new Error('Inventory item not found');
    const updated: InventoryItem = {
      ...existing,
      product: input.product.trim(),
      brand: input.brand?.trim() || null,
      variant: input.variant?.trim() || null,
      specification: input.specification?.trim() || null,
      package_size: existing.package_size,
      unit: input.unit.trim(),
      tracking_mode: input.tracking_mode,
      purchase_package: input.purchase_package?.trim() || null,
      units_per_package: input.units_per_package ?? 1,
      count: input.count,
      min_stock: input.min_stock ?? 0,
      notes: input.notes?.trim() || null,
      opened_at: input.openedAt !== undefined ? input.openedAt : (existing.opened_at ?? null),
      restock_enabled: input.restock_enabled !== undefined ? input.restock_enabled : (existing.restock_enabled !== false),
      price_basis: input.price_basis !== undefined ? (input.price_basis ?? null) : (existing.price_basis ?? null),
    };
    await db.inventory.put(updated);
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)).sort(sortAlpha));
    if (input.price != null && input.price > 0) {
      await insertPriceEntry({
        inventoryId: id,
        price: input.price,
        restockedAt: input.purchaseDate || new Date().toISOString().split('T')[0],
        store: input.store ?? null,
        trackingMode: input.tracking_mode,
        quantity: 0,
        priceBasis: input.price_basis ?? existing.price_basis ?? null,
      });
    }
  }, []);

  const adjustCount = useCallback(async (id: string, delta: number) => {
    const existing = await db.inventory.get(id);
    if (!existing) throw new Error('Inventory item not found');
    const next = Math.max(0, existing.count + delta);
    const shouldSetOpenedAt = delta < 0 && existing.count > 0 && !existing.opened_at;
    const nowIso = new Date().toISOString();
    const updateData: Partial<InventoryItem> = { count: next };
    if (shouldSetOpenedAt) {
      updateData.opened_at = nowIso;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, count: next, ...(shouldSetOpenedAt ? { opened_at: nowIso } : {}) }
          : it,
      ),
    );

    await db.inventory.update(id, updateData);
  }, []);

  const restock = useCallback(
    async (id: string, input: RestockInput) => {
      const addUnits = restockAddAmount(
        input.trackingMode,
        input.packagesPurchased,
        input.unitsPerPackage,
        input.unitOverride,
      );
      const newCount = await db.transaction('rw', [db.inventory, db.restock_history], async () => {
        const existing = await db.inventory.get(id);
        if (!existing) throw new Error('Inventory item not found');
        const newCount = existing.count + addUnits;
        await db.inventory.update(id, {
          count: newCount,
          is_on_manual_list: false,
        });
        await db.restock_history.add({
          id: generateId(),
          inventory_id: id,
          price: input.price,
          quantity: addUnits,
          packages_purchased: input.packagesPurchased,
          tracking_mode: input.trackingMode,
          restocked_at: input.restockedAt,
          store: input.store?.trim() || null,
          notes: input.notes?.trim() || null,
          price_basis: input.price_basis ?? null,
        });
        return newCount;
      });
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, count: newCount, is_on_manual_list: false } : it)),
      );
    },
    [],
  );

  const deleteItem = useCallback(async (id: string) => {
    await db.transaction('rw', [db.inventory, db.restock_history], async () => {
      await db.restock_history.where('inventory_id').equals(id).delete();
      await db.inventory.delete(id);
    });
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return {
    items,
    loading,
    error,
    reload: load,
    addItem,
    updateItem,
    adjustCount,
    restock,
    deleteItem,
  };
}

export function useShoppingItems() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.shopping_items.orderBy('created_at').reverse().toArray();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addShoppingItem = useCallback(async (input: ShoppingItemInput) => {
    const newItem: ShoppingItem = {
      id: generateId(),
      product: input.product.trim(),
      brand: input.brand?.trim() || null,
      variant: input.variant?.trim() || null,
      notes: input.notes?.trim() || null,
      is_done: false,
      created_at: new Date().toISOString(),
    };
    await db.shopping_items.add(newItem);
    setItems((prev) => [newItem, ...prev]);
    return newItem;
  }, []);

  const updateShoppingItem = useCallback(async (id: string, input: ShoppingItemInput) => {
    const existing = await db.shopping_items.get(id);
    if (!existing) throw new Error('Shopping item not found');
    const updated: ShoppingItem = {
      ...existing,
      product: input.product.trim(),
      brand: input.brand?.trim() || null,
      variant: input.variant?.trim() || null,
      notes: input.notes?.trim() || null,
    };
    await db.shopping_items.put(updated);
    setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
  }, []);

  const toggleShoppingItemDone = useCallback(async (id: string, value: boolean) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_done: value } : it)));
    await db.shopping_items.update(id, { is_done: value });
  }, []);

  const deleteShoppingItem = useCallback(async (id: string) => {
    await db.shopping_items.delete(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  return {
    items,
    loading,
    error,
    reload: load,
    addShoppingItem,
    updateShoppingItem,
    toggleShoppingItemDone,
    deleteShoppingItem,
  };
}

export function useRestockHistory(inventoryId: string | null) {
  const [history, setHistory] = useState<RestockEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inventoryId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    db.restock_history
      .where('inventory_id')
      .equals(inventoryId)
      .sortBy('restocked_at')
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inventoryId]);

  return { history, loading, error };
}
