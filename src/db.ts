import Dexie, { Table } from 'dexie';
import type { InventoryItem, RestockEntry, ShoppingItem, ConsumptionEntry } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class HouseholdDB extends Dexie {
  inventory!: Table<InventoryItem, string>;
  restock_history!: Table<RestockEntry, string>;
  shopping_items!: Table<ShoppingItem, string>;
  consumption_history!: Table<ConsumptionEntry, string>;

  constructor() {
    super('HouseholdInventoryDB');

    this.version(1).stores({
      inventory: 'id, product',
      restock_history: 'id, inventory_id, restocked_at, store',
      shopping_items: 'id, created_at',
    });

    this.version(2)
      .stores({
        inventory: 'id, product',
        restock_history: 'id, inventory_id, restocked_at, store',
        shopping_items: 'id, created_at',
        consumption_history: 'id, inventory_id, opened_at, created_at',
      })
      .upgrade(async (tx) => {
        // Migration: initialize single history entry for existing items with opened_at
        try {
          const inventory = await tx.table('inventory').toArray();
          const consumptionTable = tx.table('consumption_history');
          for (const it of inventory) {
            if (it.opened_at) {
              await consumptionTable.add({
                id: generateId(),
                inventory_id: it.id,
                opened_at: it.opened_at,
                notes: null,
                created_at: it.created_at || it.opened_at || new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          console.error('Failed to migrate opened_at to consumption_history:', e);
        }
      });
  }
}

export const db = new HouseholdDB();
