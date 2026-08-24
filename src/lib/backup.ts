import { db } from '../db';
import type { InventoryItem, RestockEntry, ShoppingItem } from '../types';

// ─── Backup format ───────────────────────────────────────────────────────────

export const BACKUP_FORMAT = 'homestock-backup' as const;
export const BACKUP_VERSION = 1 as const;

export interface BackupTables {
  inventory: InventoryItem[];
  restock_history: RestockEntry[];
  shopping_items: ShoppingItem[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  created_at: string;
  tables: BackupTables;
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Reads all three Dexie tables, serialises them into a HomeStock backup JSON
 * file, then attempts to share it via the Web Share API (Android/PWA).
 *
 * Share flow:
 *   1. Build a `File` object with MIME type `application/json`.
 *   2. Check `navigator.canShare({ files: [file] })` — if true, call
 *      `navigator.share({ files, title, text })` which surfaces the native
 *      Android share sheet (Files, Drive, WhatsApp, etc.).
 *   3. If sharing is unsupported or `canShare` returns false, fall back to a
 *      programmatic `<a download>` click so the browser saves it locally.
 */
export async function exportBackup(): Promise<void> {
  const [inventory, restock_history, shopping_items] = await db.transaction(
    'r',
    [db.inventory, db.restock_history, db.shopping_items],
    async () =>
      Promise.all([
        db.inventory.toArray(),
        db.restock_history.toArray(),
        db.shopping_items.toArray(),
      ]),
  );

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    tables: { inventory, restock_history, shopping_items },
  };

  const json = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(':', '-'); // HH-MM-SS
  const filename = `HomeStock-backup-${dateStr}-${timeStr}.json`;

  // Build a proper File with the correct MIME type so the share sheet and
  // file manager both recognise it as a JSON document.
  const file = new File([json], filename, { type: 'application/json' });

  // Prefer the Web Share API with files (supported on Android Chrome / Safari
  // on iOS 15+). Guard with canShare({ files }) before calling share().
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
        // User dismissed the share sheet — treat as a silent cancellation.
        if (e.name === 'AbortError') return;
        // NotAllowedError = browser dropped the user-gesture token across the
        // async DB read. Fall through to the <a download> fallback silently.
        if (e.name === 'NotAllowedError') {
          /* fall through */
        } else {
          throw e; // Re-throw any unexpected error.
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
    // Revoke the object URL after a short delay to allow the download to start.
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
  if (!isString(it.created_at)) throw new Error(`inventory[${index}].created_at must be a string`);

  return it as unknown as InventoryItem;
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

  return it as unknown as RestockEntry;
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

  if (obj.version !== BACKUP_VERSION) {
    throw new Error(
      `Incompatible backup version (expected ${BACKUP_VERSION}, got ${String(obj.version)}). Please use the current version of HomeStock to restore this file.`,
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

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: obj.created_at as string,
    tables: { inventory, restock_history, shopping_items },
  };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

/**
 * Atomically replaces all three Dexie tables with the contents of `backup`.
 * If any step fails the entire transaction rolls back, leaving existing data
 * intact. Only call this after `importBackup` has already validated the file.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', [db.inventory, db.restock_history, db.shopping_items], async () => {
    await db.inventory.clear();
    await db.restock_history.clear();
    await db.shopping_items.clear();

    await db.inventory.bulkAdd(backup.tables.inventory);
    await db.restock_history.bulkAdd(backup.tables.restock_history);
    await db.shopping_items.bulkAdd(backup.tables.shopping_items);
  });
}
