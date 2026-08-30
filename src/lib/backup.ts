import { db } from '../db';
import type { InventoryItem, RestockEntry, ShoppingItem, ConsumptionEntry, PriceBasis } from '../types';
import { isValidPriceBasis } from '../types';

// ─── Backup format ───────────────────────────────────────────────────────────

export const BACKUP_FORMAT = 'homestock-backup' as const;
export const BACKUP_VERSION = 2 as const;

export interface BackupTables {
  inventory: InventoryItem[];
  restock_history: RestockEntry[];
  shopping_items: ShoppingItem[];
  consumption_history?: ConsumptionEntry[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  created_at: string;
  tables: {
    inventory: InventoryItem[];
    restock_history: RestockEntry[];
    shopping_items: ShoppingItem[];
    consumption_history: ConsumptionEntry[];
  };
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Reads all Dexie tables (including consumption_history), serialises them into
 * a HomeStock backup JSON file, then attempts to share it via the Web Share API (Android/PWA).
 */
export async function exportBackup(): Promise<void> {
  const [inventory, restock_history, shopping_items, consumption_history] = await db.transaction(
    'r',
    [db.inventory, db.restock_history, db.shopping_items, db.consumption_history],
    async () =>
      Promise.all([
        db.inventory.toArray(),
        db.restock_history.toArray(),
        db.shopping_items.toArray(),
        db.consumption_history.toArray(),
      ]),
  );

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    tables: { inventory, restock_history, shopping_items, consumption_history },
  };

  const json = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(':', '-'); // HH-MM-SS
  const filename = `HomeStock-backup-${dateStr}-${timeStr}.json`;

  const file = new File([json], filename, { type: 'application/json' });

  const shareApi = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (
    typeof shareApi.share === 'function' &&
    typeof shareApi.canShare === 'function' &&
    shareApi.canShare({ files: [file] })
  ) {
    try {
      await shareApi.share({
        files: [file],
        title: 'HomeStock Backup',
        text: `HomeStock backup – ${dateStr}`,
      });
      return;
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') {
          /* fall through to browser download fallback */
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  // Fallback: trigger a browser download via a temporary anchor element.
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

// ─── Import / validation ─────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function isBooleanOrUndefined(v: unknown): v is boolean | undefined {
  return v === undefined || typeof v === 'boolean';
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function isNullableNumber(v: unknown): v is number | null {
  return v === null || typeof v === 'number';
}

function isNullableOrUndefinedNumber(v: unknown): v is number | null | undefined {
  return v === undefined || v === null || typeof v === 'number';
}

function isNullableOrUndefinedString(v: unknown): v is string | null | undefined {
  return v === undefined || v === null || typeof v === 'string';
}

function migrateLegacyComparisonUnit(
  comparisonUnit: string | null | undefined,
  existingPriceBasis: unknown,
): PriceBasis | null | undefined {
  if (isValidPriceBasis(existingPriceBasis)) return existingPriceBasis;
  if (existingPriceBasis === null) return null;

  if (!comparisonUnit) return undefined;
  const u = comparisonUnit.trim().toLowerCase();
  if (u === 'kg') return 'kg';
  if (u === 'l') return 'L';
  if (u === 'piece' || u === 'pieces') return 'piece';
  return undefined;
}

function validateInventoryItem(item: unknown, index: number): InventoryItem {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`inventory[${index}] is not an object`);
  }
  const it = item as Record<string, unknown>;

  if (!isString(it.id)) throw new Error(`inventory[${index}].id must be a string`);
  if (!isString(it.product)) throw new Error(`inventory[${index}].product must be a string`);
  if (!isNullableString(it.brand)) throw new Error(`inventory[${index}].brand must be string|null`);
  if (!isNullableString(it.variant)) throw new Error(`inventory[${index}].variant must be string|null`);
  if (!isNullableString(it.specification)) throw new Error(`inventory[${index}].specification must be string|null`);
  if (!isNullableString(it.package_size)) throw new Error(`inventory[${index}].package_size must be string|null`);
  if (!isString(it.unit)) throw new Error(`inventory[${index}].unit must be a string`);
  if (it.tracking_mode !== 'packages' && it.tracking_mode !== 'units') {
    throw new Error(`inventory[${index}].tracking_mode must be "packages" or "units"`);
  }
  if (!isNullableString(it.purchase_package)) throw new Error(`inventory[${index}].purchase_package must be string|null`);
  if (!isNumber(it.units_per_package)) throw new Error(`inventory[${index}].units_per_package must be a number`);
  if (!isNumber(it.count)) throw new Error(`inventory[${index}].count must be a number`);
  if (!isNumber(it.min_stock)) throw new Error(`inventory[${index}].min_stock must be a number`);
  if (!isNullableString(it.notes)) throw new Error(`inventory[${index}].notes must be string|null`);
  if (typeof it.is_on_manual_list !== 'boolean') throw new Error(`inventory[${index}].is_on_manual_list must be a boolean`);
  if (!isNullableString(it.opened_at)) throw new Error(`inventory[${index}].opened_at must be string|null`);
  if (!isBooleanOrUndefined(it.restock_enabled)) throw new Error(`inventory[${index}].restock_enabled must be a boolean or undefined`);
  if (!isBooleanOrUndefined(it.consumable)) throw new Error(`inventory[${index}].consumable must be a boolean or undefined`);
  if (it.price_basis !== undefined && it.price_basis !== null && !isValidPriceBasis(it.price_basis)) {
    throw new Error(`inventory[${index}].price_basis must be "kg", "L", "piece", "package", or null/undefined`);
  }
  if (!isNullableOrUndefinedNumber(it.comparison_quantity)) throw new Error(`inventory[${index}].comparison_quantity must be number|null|undefined`);
  if (!isNullableOrUndefinedString(it.comparison_unit)) throw new Error(`inventory[${index}].comparison_unit must be string|null|undefined`);
  if (!isString(it.created_at)) throw new Error(`inventory[${index}].created_at must be a string`);

  const record = it as unknown as InventoryItem;
  // Default consumable to true for backwards compatibility with older backups
  if (record.consumable === undefined) {
    record.consumable = true;
  }
  const migratedBasis = migrateLegacyComparisonUnit(record.comparison_unit, record.price_basis);
  if (migratedBasis !== undefined) {
    record.price_basis = migratedBasis;
  }

  return record;
}

function validateRestockEntry(item: unknown, index: number): RestockEntry {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`restock_history[${index}] is not an object`);
  }
  const it = item as Record<string, unknown>;

  if (!isString(it.id)) throw new Error(`restock_history[${index}].id must be a string`);
  if (!isString(it.inventory_id)) throw new Error(`restock_history[${index}].inventory_id must be a string`);
  if (!isNullableNumber(it.price)) throw new Error(`restock_history[${index}].price must be number|null`);
  if (!isString(it.restocked_at)) throw new Error(`restock_history[${index}].restocked_at must be a string`);
  if (!isNumber(it.quantity)) throw new Error(`restock_history[${index}].quantity must be a number`);
  if (!isNullableNumber(it.packages_purchased)) throw new Error(`restock_history[${index}].packages_purchased must be number|null`);
  if (
    it.tracking_mode !== null &&
    it.tracking_mode !== 'packages' &&
    it.tracking_mode !== 'units'
  ) {
    throw new Error(`restock_history[${index}].tracking_mode must be "packages", "units", or null`);
  }
  if (!isNullableString(it.store)) throw new Error(`restock_history[${index}].store must be string|null`);
  if (!isNullableString(it.notes)) throw new Error(`restock_history[${index}].notes must be string|null`);
  if (it.price_basis !== undefined && it.price_basis !== null && !isValidPriceBasis(it.price_basis)) {
    throw new Error(`restock_history[${index}].price_basis must be "kg", "L", "piece", "package", or null/undefined`);
  }
  if (!isNullableOrUndefinedNumber(it.comparison_quantity)) throw new Error(`restock_history[${index}].comparison_quantity must be number|null|undefined`);
  if (!isNullableOrUndefinedString(it.comparison_unit)) throw new Error(`restock_history[${index}].comparison_unit must be string|null|undefined`);

  const record = it as unknown as RestockEntry;
  const migratedBasis = migrateLegacyComparisonUnit(record.comparison_unit, record.price_basis);
  if (migratedBasis !== undefined) {
    record.price_basis = migratedBasis;
  }

  return record;
}

function validateConsumptionEntry(item: unknown, index: number): ConsumptionEntry {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`consumption_history[${index}] is not an object`);
  }
  const it = item as Record<string, unknown>;

  if (!isString(it.id)) throw new Error(`consumption_history[${index}].id must be a string`);
  if (!isString(it.inventory_id)) throw new Error(`consumption_history[${index}].inventory_id must be a string`);
  if (!isString(it.opened_at)) throw new Error(`consumption_history[${index}].opened_at must be a string`);
  if (!isNullableOrUndefinedString(it.notes)) throw new Error(`consumption_history[${index}].notes must be string|null|undefined`);
  if (!isString(it.created_at)) throw new Error(`consumption_history[${index}].created_at must be a string`);

  return {
    id: it.id,
    inventory_id: it.inventory_id,
    opened_at: it.opened_at,
    notes: it.notes ? String(it.notes) : null,
    created_at: it.created_at,
  };
}

function validateShoppingItem(item: unknown, index: number): ShoppingItem {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`shopping_items[${index}] is not an object`);
  }
  const it = item as Record<string, unknown>;

  if (!isString(it.id)) throw new Error(`shopping_items[${index}].id must be a string`);
  if (!isString(it.product)) throw new Error(`shopping_items[${index}].product must be a string`);
  if (!isNullableString(it.brand)) throw new Error(`shopping_items[${index}].brand must be string|null`);
  if (!isNullableString(it.variant)) throw new Error(`shopping_items[${index}].variant must be string|null`);
  if (!isNullableString(it.notes)) throw new Error(`shopping_items[${index}].notes must be string|null`);
  if (!isBooleanOrUndefined(it.is_done as unknown) && typeof it.is_done !== 'boolean') {
    throw new Error(`shopping_items[${index}].is_done must be a boolean`);
  }
  if (!isString(it.created_at)) throw new Error(`shopping_items[${index}].created_at must be a string`);

  return it as unknown as ShoppingItem;
}

/**
 * Reads and validates a `File` object, returning a typed `BackupFile`.
 * Throws a descriptive error if the file is malformed, missing required
 * tables, or has an incompatible format/version.
 *
 * Backward compatibility:
 *   - Backups without consumable flag -> default to true
 *   - Backups without consumption_history (v1 backups) -> default to empty array
 *   - Backups with comparison_quantity / comparison_unit -> safely migrated
 */
export async function importBackup(file: File): Promise<BackupFile> {
  let raw: unknown;
  try {
    const text = await file.text();
    raw = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON and cannot be read as a backup.');
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Backup file must be a JSON object.');
  }

  const obj = raw as Record<string, unknown>;

  if (obj.format !== BACKUP_FORMAT) {
    throw new Error(
      `This file is not a HomeStock backup (expected format "${BACKUP_FORMAT}", got "${String(obj.format)}").`,
    );
  }

  if (obj.version !== 1 && obj.version !== 2) {
    throw new Error(
      `Incompatible backup version (got ${String(obj.version)}). Please use a compatible version of HomeStock to restore this file.`,
    );
  }

  if (!isString(obj.created_at)) {
    throw new Error('Backup is missing a valid "created_at" timestamp.');
  }

  if (typeof obj.tables !== 'object' || obj.tables === null) {
    throw new Error('Backup is missing the "tables" section.');
  }

  const tables = obj.tables as Record<string, unknown>;

  for (const required of ['inventory', 'restock_history', 'shopping_items'] as const) {
    if (!Array.isArray(tables[required])) {
      throw new Error(`Backup is missing or has an invalid "${required}" table.`);
    }
  }

  const inventory = (tables.inventory as unknown[]).map(validateInventoryItem);
  const restock_history = (tables.restock_history as unknown[]).map(validateRestockEntry);
  const shopping_items = (tables.shopping_items as unknown[]).map(validateShoppingItem);

  const consumption_history = Array.isArray(tables.consumption_history)
    ? (tables.consumption_history as unknown[]).map(validateConsumptionEntry)
    : [];

  return {
    format: BACKUP_FORMAT,
    version: typeof obj.version === 'number' ? obj.version : BACKUP_VERSION,
    created_at: obj.created_at as string,
    tables: { inventory, restock_history, shopping_items, consumption_history },
  };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

/**
 * Atomically replaces all Dexie tables with the contents of `backup`.
 * If any step fails the entire transaction rolls back, leaving existing data
 * intact. Only call this after `importBackup` has already validated the file.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.inventory, db.restock_history, db.shopping_items, db.consumption_history],
    async () => {
      await db.inventory.clear();
      await db.restock_history.clear();
      await db.shopping_items.clear();
      await db.consumption_history.clear();

      await db.inventory.bulkAdd(backup.tables.inventory);
      await db.restock_history.bulkAdd(backup.tables.restock_history);
      await db.shopping_items.bulkAdd(backup.tables.shopping_items);

      if (backup.tables.consumption_history && backup.tables.consumption_history.length > 0) {
        await db.consumption_history.bulkAdd(backup.tables.consumption_history);
      }
    },
  );
}
