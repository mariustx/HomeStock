export type TrackingMode = 'packages' | 'units';

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
 * Parse a specification string like "400 g", "700 mL", "1 L", "90 pieces"
 * into a numeric amount and unit for comparable-price calculation.
 * Returns null when the spec can't be parsed.
 */
export interface ParsedSpec {
  amount: number;
  unit: string;
}

export function parseSpec(spec: string | null | undefined): ParsedSpec | null {
  if (!spec || !spec.trim()) return null;
  const match = spec.trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(amount) || amount <= 0) return null;
  return { amount, unit };
}

/**
 * Compute a comparable unit price from a purchase price and a specification.
 * Normalises weights (g→kg) and volumes (mL→L) so prices are comparable
 * across different package sizes.
 *
 * Examples:
 *   price=8, spec="400 g"  → 20 RON/kg
 *   price=24, spec="1 L"   → 2.40 RON/100mL  (returned as 24 RON/L, caller formats)
 *   price=18, spec="90 pieces" → 0.20 RON/piece
 *
 * Returns { price, unitLabel } or null.
 */
export function comparablePrice(
  price: number,
  spec: string | null | undefined,
): { price: number; unitLabel: string } | null {
  const parsed = parseSpec(spec);
  if (!parsed) return null;
  const { amount, unit } = parsed;

  // Weight: normalise to per-kg (or per-100g for small amounts)
  if (unit === 'g' || unit === 'gr' || unit === 'grams') {
    const perKg = (price / amount) * 1000;
    return { price: perKg, unitLabel: 'RON/kg' };
  }
  if (unit === 'kg' || unit === 'kilos' || unit === 'kilogram') {
    return { price: price / amount, unitLabel: 'RON/kg' };
  }

  // Volume: normalise to per-litre
  if (unit === 'ml' || unit === 'milliliter' || unit === 'millilitre') {
    const perL = (price / amount) * 1000;
    return { price: perL, unitLabel: 'RON/L' };
  }
  if (unit === 'l' || unit === 'liter' || unit === 'litre') {
    return { price: price / amount, unitLabel: 'RON/L' };
  }

  // Countable: pieces, capsules, tablets, rolls, etc.
  return { price: price / amount, unitLabel: `RON/${unit}` };
}

/**
 * Format a comparable price for display.
 */
export function formatComparable(price: number, unitLabel: string): string {
  if (price >= 100) return `${price.toFixed(0)} ${unitLabel}`;
  if (price >= 10) return `${price.toFixed(1)} ${unitLabel}`;
  return `${price.toFixed(2)} ${unitLabel}`;
}
