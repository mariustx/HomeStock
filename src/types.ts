export type TrackingMode = 'packages' | 'units';
export type PriceBasis = 'kg' | 'L' | 'piece' | 'package';

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
  /** Whether the product is consumable (gets used up) or a durable non-consumable. Defaults to true. */
  consumable?: boolean;
  /** Price basis for price-tracking purposes only. Does not affect stock. */
  price_basis?: PriceBasis | null;
  /**
   * @deprecated Use price_basis instead.
   * Retained for backward compatibility with old records/backups.
   */
  comparison_quantity?: number | null;
  /**
   * @deprecated Use price_basis instead.
   * Retained for backward compatibility with old records/backups.
   */
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
  /** Price basis for this specific price entry. Does not affect stock. */
  price_basis?: PriceBasis | null;
  /**
   * @deprecated Use price_basis instead.
   * Retained for backward compatibility with old records/backups.
   */
  comparison_quantity?: number | null;
  /**
   * @deprecated Use price_basis instead.
   * Retained for backward compatibility with old records/backups.
   */
  comparison_unit?: string | null;
}

export interface ConsumptionEntry {
  id: string;
  inventory_id: string;
  opened_at: string;
  notes?: string | null;
  created_at: string;
}

export interface ConsumptionPeriod {
  fromOpenedAt: string;
  toOpenedAt: string;
  days: number;
}

export interface ConsumptionStats {
  openingsCount: number;
  periodsCount: number;
  averageDays: number | null;
  lastDays: number | null;
  periods: ConsumptionPeriod[];
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
  consumable?: boolean;
  price_basis?: PriceBasis | null;
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
  price_basis?: PriceBasis | null;
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

export const PRICE_BASIS_OPTIONS: readonly { value: PriceBasis; label: string }[] = [
  { value: 'kg', label: 'per kg' },
  { value: 'L', label: 'per L' },
  { value: 'piece', label: 'per piece' },
  { value: 'package', label: 'per package' },
] as const;

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
 * Format a price with an optional price basis for display.
 *
 * Examples:
 *   formatPriceWithBasis(3.99, 'kg')      → '3.99 RON/kg'
 *   formatPriceWithBasis(7.50, 'L')       → '7.50 RON/L'
 *   formatPriceWithBasis(0.80, 'piece')   → '0.80 RON/piece'
 *   formatPriceWithBasis(3.50, 'package') → '3.50 RON/package'
 *   formatPriceWithBasis(3.50, null)      → '3.50 RON'
 */
export function formatPriceWithBasis(
  price: number | null | undefined,
  basis: PriceBasis | null | undefined,
): string {
  if (price == null || Number.isNaN(price) || !Number.isFinite(price) || price < 0) return '';
  const priceStr = Number.isInteger(price) ? String(price) : price.toFixed(2);
  if (basis) {
    return `${priceStr} RON/${basis}`;
  }
  return `${priceStr} RON`;
}

/** Returns true if the value is a valid PriceBasis. */
export function isValidPriceBasis(v: unknown): v is PriceBasis {
  return v === 'kg' || v === 'L' || v === 'piece' || v === 'package';
}
