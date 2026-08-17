/*
# Tracking modes + specification field

## Purpose
Refine the inventory model so each product declares whether it tracks
unopened packages or individual consumed units. Add a descriptive
"specification" field (400 mL, 1 L, AA, 3-ply, Sensitive) that never
affects inventory math but powers comparable-price calculations. This is
additive only — no data is dropped or retyped.

## Modified tables

1. `inventory` — additive columns:
   - `tracking_mode` text, NOT NULL, default 'packages'
     Values: 'packages' (track unopened packages) or 'units' (track individual units).
     The app enforces these two values; no DB enum is used to keep the
     column easy to change later.
   - `specification` text, nullable — descriptive spec (400 g, 700 ml,
     3-ply, AA, E27, Sensitive). Purely informational; never affects
     stock calculations.

   Backfill logic (runs once, idempotent):
   - If units_per_package > 1 AND stock unit is one of the typical
     individual-consumption units (roll, capsule, can, battery, bottle,
     piece, tablet) → set tracking_mode = 'units'. These products were
     clearly modelled as "buy a pack, consume one at a time".
   - Otherwise → 'packages' (the safe default: opening one package
     drops inventory by one).

2. `restock_history` — additive column:
   - `tracking_mode` text, nullable — snapshot of the product's tracking
     mode at restock time. Used by Insights to recompute comparable
     prices correctly regardless of later mode changes.

   Backfill: copies the current tracking_mode of the parent inventory row.

## New tables
None.

## Security
No RLS changes. Existing inventory / restock_history / shopping_items
policies are unchanged and remain anon+authenticated (single-tenant).

## Important notes
   - All column additions use DO $$ ... IF NOT EXISTS guards → idempotent.
   - Backfill UPDATE is guarded by WHERE tracking_mode IS NULL so
     re-running the migration never overwrites a user's explicit choice.
   - No columns dropped, no types changed, no tables renamed.
*/

-- inventory: tracking_mode + specification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'tracking_mode') THEN
    ALTER TABLE inventory ADD COLUMN tracking_mode text NOT NULL DEFAULT 'packages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'specification') THEN
    ALTER TABLE inventory ADD COLUMN specification text;
  END IF;
END $$;

-- Backfill tracking_mode for existing rows that have no explicit mode yet.
-- Individual-units products: pack > 1 and a unit that suggests per-item consumption.
UPDATE inventory
SET tracking_mode = 'units'
WHERE tracking_mode IS NULL
  AND units_per_package > 1
  AND lower(unit) IN ('roll', 'rolls', 'capsule', 'capsules', 'can', 'cans',
                      'battery', 'batteries', 'bottle', 'bottles', 'piece',
                      'pieces', 'tablet', 'tablets');

-- Everything else defaults to packages (already the column default, but
-- make it explicit for any NULLs that remain).
UPDATE inventory
SET tracking_mode = 'packages'
WHERE tracking_mode IS NULL;

-- restock_history: tracking_mode snapshot
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'restock_history' AND column_name = 'tracking_mode') THEN
    ALTER TABLE restock_history ADD COLUMN tracking_mode text;
  END IF;
END $$;

-- Backfill restock_history.tracking_mode from the parent inventory row.
UPDATE restock_history rh
SET tracking_mode = inv.tracking_mode
FROM inventory inv
WHERE rh.tracking_mode IS NULL
  AND rh.inventory_id = inv.id;
