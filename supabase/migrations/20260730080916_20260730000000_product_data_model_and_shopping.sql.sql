/*
# Product data model + automatic shopping list

## Purpose
Refactor the household inventory into a richer product model where stock is
tracked in consumed units (rolls, cans, bottles, kg, tablets…) while purchases
happen in real-world packages (packs, trays, bundles…). Add automatic
low/out-of-stock shopping list generation and support shopping-only items that
do not create inventory products.

## Modified tables

1. `inventory` — additive columns only (no drops, no type changes):
   - `package_size`      text, nullable — descriptive size (e.g. "400 g", "700 ml")
   - `purchase_package`  text, nullable — how the item is normally bought (e.g. "Pack", "Tray")
   - `units_per_package` integer, NOT NULL, default 1 — how many stock units are in one purchase package
   - `min_stock`         integer, NOT NULL, default 0 — threshold for the auto shopping list
   - `notes`             text, nullable — free-text notes
   Existing rows keep their data; new columns get safe defaults.

2. `restock_history` — additive columns only:
   - `packages_purchased` integer, nullable — how many packages were bought (kept nullable for legacy rows)
   - `store`              text, nullable — where the purchase was made
   - `notes`              text, nullable — free-text purchase notes
   Existing `quantity` column now means "units added to stock" (= packages × units_per_package unless overridden).

## New tables

1. `shopping_items` — shopping-only items that do NOT create inventory products:
   - `id`          uuid, primary key
   - `product`     text, NOT NULL
   - `brand`       text, nullable
   - `variant`     text, nullable
   - `notes`       text, nullable
   - `is_done`     boolean, NOT NULL, default false — mark as purchased/checked off
   - `created_at`  timestamptz, default now()

## Security (RLS)
   - `shopping_items` gets RLS ENABLED with four anon+authenticated policies
     (single-tenant, no auth) matching the existing tables.
   - Existing inventory / restock_history policies are unchanged.

## Important notes
   - This migration is idempotent: column additions use DO $$ ... IF NOT EXISTS
     guards, the table uses CREATE TABLE IF NOT EXISTS, and policies use
     DROP POLICY IF EXISTS before CREATE.
   - No data is dropped or retyped. Existing inventory rows become valid
     products with min_stock=0 and units_per_package=1, so current behaviour
     (restocking adds the entered number of units) is preserved.
*/

-- inventory: additive columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'package_size') THEN
    ALTER TABLE inventory ADD COLUMN package_size text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'purchase_package') THEN
    ALTER TABLE inventory ADD COLUMN purchase_package text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'units_per_package') THEN
    ALTER TABLE inventory ADD COLUMN units_per_package integer NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'min_stock') THEN
    ALTER TABLE inventory ADD COLUMN min_stock integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'notes') THEN
    ALTER TABLE inventory ADD COLUMN notes text;
  END IF;
END $$;

-- restock_history: additive columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'restock_history' AND column_name = 'packages_purchased') THEN
    ALTER TABLE restock_history ADD COLUMN packages_purchased integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'restock_history' AND column_name = 'store') THEN
    ALTER TABLE restock_history ADD COLUMN store text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'restock_history' AND column_name = 'notes') THEN
    ALTER TABLE restock_history ADD COLUMN notes text;
  END IF;
END $$;

-- shopping_items: shopping-only items
CREATE TABLE IF NOT EXISTS shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  brand text,
  variant text,
  notes text,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_shopping_items" ON shopping_items;
CREATE POLICY "anon_select_shopping_items" ON shopping_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_shopping_items" ON shopping_items;
CREATE POLICY "anon_insert_shopping_items" ON shopping_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_shopping_items" ON shopping_items;
CREATE POLICY "anon_update_shopping_items" ON shopping_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_shopping_items" ON shopping_items;
CREATE POLICY "anon_delete_shopping_items" ON shopping_items FOR DELETE
  TO anon, authenticated USING (true);
