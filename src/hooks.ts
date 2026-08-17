import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type {
  InventoryItem,
  RestockEntry,
  ShoppingItem,
  ProductInput,
  RestockInput,
  ShoppingItemInput,
} from './types';
import { restockAddAmount } from './types';
import { savePriceEntry } from './lib/priceHistory';

const sortAlpha = (a: InventoryItem, b: InventoryItem) => a.product.localeCompare(b.product);

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('product', { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setItems((data as InventoryItem[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addItem = useCallback(async (input: ProductInput) => {
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        product: input.product.trim(),
        brand: input.brand?.trim() || null,
        variant: input.variant?.trim() || null,
        specification: input.specification?.trim() || null,
        unit: input.unit.trim(),
        tracking_mode: input.tracking_mode,
        purchase_package: input.purchase_package?.trim() || null,
        units_per_package: input.units_per_package ?? 1,
        count: input.count,
        min_stock: input.min_stock ?? 0,
        notes: input.notes?.trim() || null,
        is_on_manual_list: false,
      })
      .select()
      .single();
    if (error) throw error;
    if (data) setItems((prev) => [...prev, data as InventoryItem].sort(sortAlpha));
    const created = data as InventoryItem;
    if (created && input.price != null && input.price > 0) {
      await savePriceEntry({
        inventoryId: created.id,
        price: input.price,
        restockedAt: input.purchaseDate || new Date().toISOString().split('T')[0],
        store: input.store ?? null,
        trackingMode: input.tracking_mode,
        quantity: 0,
      });
    }
    return created;
  }, []);

  const updateItem = useCallback(async (id: string, input: ProductInput) => {
    const { data, error } = await supabase
      .from('inventory')
      .update({
        product: input.product.trim(),
        brand: input.brand?.trim() || null,
        variant: input.variant?.trim() || null,
        specification: input.specification?.trim() || null,
        unit: input.unit.trim(),
        tracking_mode: input.tracking_mode,
        purchase_package: input.purchase_package?.trim() || null,
        units_per_package: input.units_per_package ?? 1,
        count: input.count,
        min_stock: input.min_stock ?? 0,
        notes: input.notes?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (data)
      setItems((prev) => prev.map((it) => (it.id === id ? (data as InventoryItem) : it)).sort(sortAlpha));
    if (input.price != null && input.price > 0) {
      await savePriceEntry({
        inventoryId: id,
        price: input.price,
        restockedAt: input.purchaseDate || new Date().toISOString().split('T')[0],
        store: input.store ?? null,
        trackingMode: input.tracking_mode,
        quantity: 0,
      });
    }
  }, []);

  const adjustCount = useCallback(async (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, count: Math.max(0, it.count + delta) } : it)),
    );
    const current = await supabase.from('inventory').select('count').eq('id', id).maybeSingle();
    if (current.error) throw current.error;
    const next = Math.max(0, (current.data?.count ?? 0) + delta);
    const { error } = await supabase.from('inventory').update({ count: next }).eq('id', id);
    if (error) throw error;
  }, []);

  const restock = useCallback(
    async (id: string, input: RestockInput) => {
      const addUnits = restockAddAmount(
        input.trackingMode,
        input.packagesPurchased,
        input.unitsPerPackage,
        input.unitOverride,
      );
      const { data: cur } = await supabase.from('inventory').select('count').eq('id', id).maybeSingle();
      const currentCount = cur?.count ?? 0;
      const newCount = currentCount + addUnits;
      const { error: updErr } = await supabase
        .from('inventory')
        .update({ count: newCount, is_on_manual_list: false })
        .eq('id', id);
      if (updErr) throw updErr;
      const { error: histErr } = await supabase.from('restock_history').insert({
        inventory_id: id,
        price: input.price,
        quantity: addUnits,
        packages_purchased: input.packagesPurchased,
        tracking_mode: input.trackingMode,
        restocked_at: input.restockedAt,
        store: input.store?.trim() || null,
        notes: input.notes?.trim() || null,
      });
      if (histErr) throw histErr;
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, count: newCount, is_on_manual_list: false } : it)),
      );
    },
    [],
  );

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) throw error;
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
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setItems((data as ShoppingItem[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addShoppingItem = useCallback(async (input: ShoppingItemInput) => {
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({
        product: input.product.trim(),
        brand: input.brand?.trim() || null,
        variant: input.variant?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    if (data) setItems((prev) => [data as ShoppingItem, ...prev]);
    return data as ShoppingItem;
  }, []);

  const updateShoppingItem = useCallback(async (id: string, input: ShoppingItemInput) => {
    const { data, error } = await supabase
      .from('shopping_items')
      .update({
        product: input.product.trim(),
        brand: input.brand?.trim() || null,
        variant: input.variant?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (data) setItems((prev) => prev.map((it) => (it.id === id ? (data as ShoppingItem) : it)));
  }, []);

  const toggleShoppingItemDone = useCallback(async (id: string, value: boolean) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_done: value } : it)));
    const { error } = await supabase.from('shopping_items').update({ is_done: value }).eq('id', id);
    if (error) throw error;
  }, []);

  const deleteShoppingItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id);
    if (error) throw error;
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
    supabase
      .from('restock_history')
      .select('*')
      .eq('inventory_id', inventoryId)
      .order('restocked_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setHistory((data as RestockEntry[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inventoryId]);

  return { history, loading, error };
}
