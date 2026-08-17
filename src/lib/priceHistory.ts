import { supabase } from './supabase';
import type { TrackingMode } from '../types';

/**
 * Insert a row into restock_history (the shared price-history table)
 * without changing inventory stock. Used when recording a spotted price
 * during Add/Edit Product (e.g. price seen in store, stock still 0).
 */
export async function savePriceEntry(opts: {
  inventoryId: string;
  price: number;
  restockedAt: string;
  store?: string | null;
  notes?: string | null;
  trackingMode?: TrackingMode | null;
  packagesPurchased?: number | null;
  quantity?: number;
}): Promise<void> {
  const { error } = await supabase.from('restock_history').insert({
    inventory_id: opts.inventoryId,
    price: opts.price,
    quantity: opts.quantity ?? 0,
    packages_purchased: opts.packagesPurchased ?? null,
    tracking_mode: opts.trackingMode ?? null,
    restocked_at: opts.restockedAt,
    store: opts.store?.trim() || null,
    notes: opts.notes?.trim() || null,
  });
  if (error) throw error;
}

/**
 * Gather distinct store names previously used across the user's inventory.
 */
export async function fetchStoreSuggestions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('restock_history')
    .select('store')
    .not('store', 'is', null);
  if (error || !data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data as { store: string | null }[]) {
    const s = (row.store ?? '').trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}
