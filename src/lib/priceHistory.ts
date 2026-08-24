import { db } from '../db';
import type { TrackingMode } from '../types';

/**
 * Insert a row into restock_history (the local Dexie table)
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
  comparisonQuantity?: number | null;
  comparisonUnit?: string | null;
}): Promise<void> {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

  await db.restock_history.add({
    id,
    inventory_id: opts.inventoryId,
    price: opts.price,
    quantity: opts.quantity ?? 0,
    packages_purchased: opts.packagesPurchased ?? null,
    tracking_mode: opts.trackingMode ?? null,
    restocked_at: opts.restockedAt,
    store: opts.store?.trim() || null,
    notes: opts.notes?.trim() || null,
    comparison_quantity: opts.comparisonQuantity ?? null,
    comparison_unit: opts.comparisonUnit?.trim() || null,
  });
}

/**
 * Gather distinct store names previously used across the user's inventory.
 */
export async function fetchStoreSuggestions(): Promise<string[]> {
  try {
    const data = await db.restock_history.toArray();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of data) {
      const s = (row.store ?? '').trim();
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
    }
    return out;
  } catch (e) {
    console.error('Failed to fetch store suggestions:', e);
    return [];
  }
}
