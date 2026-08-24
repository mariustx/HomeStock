export type TrackingMode = 'packages' | 'units';
export type ComparisonUnit = 'kg' | 'g' | 'L' | 'ml' | 'piece';

export interface InventoryItem {
  id: string;
  product: string;
  brand: string | null;
  variant: string | null;
  specification: string | null;
  package_size: string | null;
  unit: string;
  tracking_mode: TrackingMode;
  purchase_package: string | null;
  units_per_package: number;
  count: number;
  min_stock: number;
  notes: string | null;
  is_on_manual_list: boolean;
  opened_at: string | null;
  restock_enabled?: boolean;
  comparison_quantity?: number | null;
  comparison_unit?: string | null;
  created_at: string;
}

export interface RestockEntry {
  id: string;
  inventory_id: string;
  price: number | null;
  restocked_at: string;
  quantity: number;
  packages_purchased: number | null;
  tracking_mode: TrackingMode | null;
  store: string | null;
  notes: string | null;
  comparison_quantity?: number | null;
  comparison_unit?: string | null;
}

export interface ShoppingItem {
  id: string;
  product: string;
  brand: string | null;
  variant: string | null;
  notes: string | null;
  is_done: boolean;
  created_at: string;
}

export type ProductInput = {
  product: string;
  brand?: string | null;
  variant?: string | null;
  specification?: string | null;
  unit: string;
  tracking_mode: TrackingMode;
  purchase_package?: string | null;
  units_per_package?: number;
  count: number;
  min_stock?: number;
  notes?: string | null;
  openedAt?: string | null;
  restock_enabled?: boolean;
  comparison_quantity?: number | null;
  comparison_unit?: string | null;
  /** Optional price spotted at a store — saved to restock_history without changing stock. */
  price?: number | null;
  purchaseDate?: string | null;
  store?: string | null;
};

export type RestockInput = {
  packagesPurchased: number;
  unitsPerPackage: number;
  trackingMode: TrackingMode;
  unitOverride?: number | null;
  price: number | null;
  restockedAt: string;
  store?: string | null;
  notes?: string | null;
  comparison_quantity?: number | null;
  comparison_unit?: string | null;
};

export type ShoppingItemInput = {
  product: string;
  brand?: string | null;
  variant?: string | null;
  notes?: string | null;
};

export type TabKey = 'inventory' | 'shopping' | 'insights';

export const STOCK_UNIT_SUGGESTIONS = ['piece', 'roll', 'bottle', 'tube', 'can', 'jar', 'tablet', 'capsule', 'pair', 'box', 'bag'] as const;
export const PACKAGE_SUGGESTIONS = ['Piece', 'Pack', 'Box', 'Tray', 'Carton', 'Bag', 'Crate', 'Bundle', 'Set'] as const;
export const SPECIFICATION_SUGGESTIONS = ['400 mL', '700 mL', '1 L', '1 kg', '400 g', '3-ply', 'AA', 'AAA', 'E27', 'Sensitive'] as const;
export const COMPARISON_UNITS: readonly ComparisonUnit[] = ['kg', 'g', 'L', 'ml', 'piece'] as const;

export const TRACKING_MODE_LABELS: Record<TrackingMode, string> = {
  packages: 'Unopened packages',
  units: 'Individual units',
};

export const TRACKING_MODE_SHORT: Record<TrackingMode, string> = {
  packages: 'Packages',
  units: 'Units',
};

export function formatDateOnly(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timestamptzToDateInput(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function dateInputToTimestamptz(date: string): string | null {
  if (!date.trim()) return null;
  return new Date(date + 'T00:00:00').toISOString();
}

export function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  const lower = word.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') || lower.endsWith('ch') || lower.endsWith('sh')) {
    return word + 'es';
  }
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    return word.slice(0, -1) + 'ies';
  }
  return word + 's';
}

/**
 * Compute the amount a restock adds to stock, based on tracking mode.
 * - packages mode: each package purchased adds 1 to stock (1 pack = 1 unopened item)
 * - units mode: packages purchased × units per package
 */
export function restockAddAmount(
  mode: TrackingMode,
  packagesPurchased: number,
  unitsPerPackage: number,
  unitOverride?: number | null,
): number {
  if (unitOverride !== null && unitOverride !== undefined) return Math.max(0, unitOverride);
  if (mode === 'packages') return Math.max(0, packagesPurchased);
  return Math.max(0, packagesPurchased * unitsPerPackage);
}

/**
 * Compute a comparable unit price from price, quantity, and unit.
 * Normalises weights (g→kg) and volumes (ml→L) and handles per-piece prices.
 *
 * Supported units:
 *   - kg → RON/kg
 *   - g → RON/kg
 *   - L → RON/L
 *   - ml → RON/L
 *   - piece → RON/piece
 *
 * Returns { price, unitLabel } or null if invalid/missing.
 */
export function computeComparablePrice(
  price: number | null | undefined,
  quantity: number | null | undefined,
  unit: string | null | undefined,
): { price: number; unitLabel: string } | null {
  if (price == null || Number.isNaN(price) || price <= 0) return null;
  if (quantity == null || Number.isNaN(quantity) || quantity <= 0) return null;
  if (!unit || typeof unit !== 'string') return null;

  const u = unit.trim().toLowerCase();

  // Weight: normalise to per-kg
  if (u === 'kg' || u === 'kilos' || u === 'kilogram' || u === 'kilograms') {
    return { price: price / quantity, unitLabel: 'RON/kg' };
  }
  if (u === 'g' || u === 'gr' || u === 'grams' || u === 'gram') {
    return { price: (price / quantity) * 1000, unitLabel: 'RON/kg' };
  }

  // Volume: normalise to per-litre
  if (u === 'l' || u === 'liter' || u === 'litre' || u === 'liters' || u === 'litres') {
    return { price: price / quantity, unitLabel: 'RON/L' };
  }
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre' || u === 'milliliters' || u === 'millilitres') {
    return { price: (price / quantity) * 1000, unitLabel: 'RON/L' };
  }

  // Countable: individual pieces
  if (u === 'piece' || u === 'pieces' || u === 'buc' || u === 'bucati' || u === 'bucată') {
    return { price: price / quantity, unitLabel: 'RON/piece' };
  }

  return null;
}

/**
 * Format a comparable price for display.
 * e.g.
 *   7.33 RON / 1.836 kg → 3.99 RON/kg
 *   2.07 RON / 0.518 kg → 4.00 RON/kg
 *   5 RON / 500 g → 10 RON/kg
 *   6 RON / 750 ml → 8 RON/L
 */
export function formatComparable(price: number, unitLabel: string): string {
  if (Number.isNaN(price) || !Number.isFinite(price) || price <= 0) return '';
  if (Number.isInteger(price)) {
    return `${price} ${unitLabel}`;
  }
  return `${price.toFixed(2)} ${unitLabel}`;
}
