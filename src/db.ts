import Dexie, { Table } from 'dexie';
import type { InventoryItem, RestockEntry, ShoppingItem } from './types';

class HouseholdDB extends Dexie {
  inventory!: Table<InventoryItem, string>;
  restock_history!: Table<RestockEntry, string>;
  shopping_items!: Table<ShoppingItem, string>;

  constructor() {
    super('HouseholdInventoryDB');

    this.version(1).stores({
      inventory: 'id, product',
      restock_history: 'id, inventory_id, restocked_at, store',
      shopping_items: 'id, created_at',
    });
  }
}

export const db = new HouseholdDB();
