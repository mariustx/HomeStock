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
  ConsumptionEntry,
  ConsumptionStats,
} from './types';
import { restockAddAmount } from './types';
import { calculateConsumptionStats } from './lib/consumption';

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
    const isConsumable = input.consumable !== false;
    const openedAt = isConsumable ? (input.openedAt ?? null) : null;

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
      opened_at: openedAt,
      restock_enabled: isConsumable ? (input.restock_enabled !== false) : false,
      consumable: isConsumable,
      price_basis: input.price_basis ?? null,
      created_at: now,
    };
    await db.inventory.add(newItem);

    // If consumable and openedAt is provided, record the initial opening event in history
    if (isConsumable && openedAt) {
      await db.consumption_history.add({
        id: generateId(),
        inventory_id: id,
        opened_at: openedAt,
        notes: null,
        created_at: now,
      });
    }

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

    const isConsumable = input.consumable !== undefined ? input.consumable : (existing.consumable !== false);
    const newOpenedAt = input.openedAt !== undefined ? input.openedAt : (existing.opened_at ?? null);

    // Sync opened_at with consumption_history if consumable and openedAt changed
    if (isConsumable && input.openedAt !== undefined && input.openedAt !== existing.opened_at) {
      if (input.openedAt) {
        const entries = await db.consumption_history
          .where('inventory_id')
          .equals(id)
          .sortBy('opened_at');
        if (entries.length > 0) {
          // Update the latest corresponding entry
          const latest = entries[entries.length - 1];
          await db.consumption_history.update(latest.id, { opened_at: input.openedAt });
        } else {
          // Create initial history entry
          await db.consumption_history.add({
            id: generateId(),
            inventory_id: id,
            opened_at: input.openedAt,
            notes: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

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
      min_stock: input.min_stock !== undefined ? input.min_stock : existing.min_stock,
      notes: input.notes?.trim() || null,
      opened_at: newOpenedAt,
      restock_enabled: input.restock_enabled !== undefined ? input.restock_enabled : (existing.restock_enabled !== false),
      consumable: isConsumable,
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
    const isConsumable = existing.consumable !== false;
    const isStockDecrease = delta < 0 && existing.count > 0;
    const nowIso = new Date().toISOString();
    const updateData: Partial<InventoryItem> = { count: next };

    // For consumable items, clicking '-' when stock > 0 means starting an unopened item:
    // 1. Record new opening event in consumption_history.
    // 2. Update inventory.opened_at to current timestamp.
    if (isConsumable && isStockDecrease) {
      updateData.opened_at = nowIso;

      // Check if we need to preserve existing.opened_at if it wasn't yet in history
      const entries = await db.consumption_history
        .where('inventory_id')
        .equals(id)
        .sortBy('opened_at');

      if (entries.length === 0 && existing.opened_at) {
        await db.consumption_history.add({
          id: generateId(),
          inventory_id: id,
          opened_at: existing.opened_at,
          notes: null,
          created_at: existing.created_at || nowIso,
        });
      }

      // Add the new opening event
      await db.consumption_history.add({
        id: generateId(),
        inventory_id: id,
        opened_at: nowIso,
        notes: null,
        created_at: nowIso,
      });
    }

    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, count: next, ...(isConsumable && isStockDecrease ? { opened_at: nowIso } : {}) }
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
    await db.transaction('rw', [db.inventory, db.restock_history, db.consumption_history], async () => {
      await db.restock_history.where('inventory_id').equals(id).delete();
      await db.consumption_history.where('inventory_id').equals(id).delete();
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

export function useConsumptionHistory(inventoryId: string | null) {
  const [history, setHistory] = useState<ConsumptionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!inventoryId) {
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await db.consumption_history
        .where('inventory_id')
        .equals(inventoryId)
        .sortBy('opened_at');
      setHistory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const syncLatestOpenedAt = useCallback(async () => {
    if (!inventoryId) return;
    const entries = await db.consumption_history
      .where('inventory_id')
      .equals(inventoryId)
      .sortBy('opened_at');
    const latestDate = entries.length > 0 ? entries[entries.length - 1].opened_at : null;
    await db.inventory.update(inventoryId, { opened_at: latestDate });
  }, [inventoryId]);

  const addOpeningEntry = useCallback(
    async (openedAt: string, notes?: string | null) => {
      if (!inventoryId) return;
      const newEntry: ConsumptionEntry = {
        id: generateId(),
        inventory_id: inventoryId,
        opened_at: openedAt,
        notes: notes?.trim() || null,
        created_at: new Date().toISOString(),
      };
      await db.consumption_history.add(newEntry);
      await syncLatestOpenedAt();
      await loadHistory();
    },
    [inventoryId, loadHistory, syncLatestOpenedAt],
  );

  const updateOpeningEntry = useCallback(
    async (id: string, openedAt: string, notes?: string | null) => {
      await db.consumption_history.update(id, {
        opened_at: openedAt,
        notes: notes !== undefined ? (notes?.trim() || null) : undefined,
      });
      await syncLatestOpenedAt();
      await loadHistory();
    },
    [loadHistory, syncLatestOpenedAt],
  );

  const deleteOpeningEntry = useCallback(
    async (id: string) => {
      await db.consumption_history.delete(id);
      await syncLatestOpenedAt();
      await loadHistory();
    },
    [loadHistory, syncLatestOpenedAt],
  );

  const stats: ConsumptionStats = calculateConsumptionStats(history);

  return {
    history,
    stats,
    loading,
    error,
    reload: loadHistory,
    addOpeningEntry,
    updateOpeningEntry,
    deleteOpeningEntry,
  };
}

export function useAllConsumptionStats(items: InventoryItem[]) {
  const [statsMap, setStatsMap] = useState<Map<string, ConsumptionStats>>(new Map());

  useEffect(() => {
    let cancelled = false;
    db.consumption_history
      .toArray()
      .then((allEntries) => {
        if (cancelled) return;
        const grouped = new Map<string, ConsumptionEntry[]>();
        for (const entry of allEntries) {
          const arr = grouped.get(entry.inventory_id);
          if (arr) arr.push(entry);
          else grouped.set(entry.inventory_id, [entry]);
        }
        const out = new Map<string, ConsumptionStats>();
        for (const [id, entries] of grouped) {
          out.set(id, calculateConsumptionStats(entries));
        }
        setStatsMap(out);
      })
      .catch((e) => {
        console.error('Failed to load consumption stats map:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  return statsMap;
}
