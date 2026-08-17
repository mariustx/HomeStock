/*
# Create household inventory tables (single-tenant, no auth)

## Purpose
Persist a household storage/inventory between sessions: track products on hand,
auto-generate a shopping list from out-of-stock items, and record restock
history (price + timestamp) so the user can visualise price trends over time.

## New Tables

1. `inventory`
   - `id`              uuid, primary key (default gen_random_uuid())
   - `product`         text, NOT NULL — name of the product (e.g. "Flour")
   - `brand`           text, nullable — brand name (e.g. "Caputo")
   - `variant`         text, nullable — variant/variety (e.g. "Type 00")
   - `unit`            text, NOT NULL — packaging/size (e.g. "1kg", "250ml", "bottle", "pack")
   - `count`           integer, NOT NULL, default 0 — quantity currently on hand
   - `is_on_manual_list` boolean, NOT NULL, default false — manually forced onto shopping list
   - `created_at`      timestamptz, default now()

2. `restock_history`
   - `id`              uuid, primary key (default gen_random_uuid())
   - `inventory_id`    uuid, NOT NULL, references inventory(id) ON DELETE CASCADE
   - `price`           numeric(12,2), nullable — price paid for this restock
   - `restocked_at`    timestamptz, NOT NULL, default now() — when the restock happened
   - `quantity`        integer, NOT NULL, default 1 — how many units were restocked

## Indexes
   - `restock_history_inventory_id_idx` on restock_history(inventory_id) — speeds up per-item price lookups.
   - `restock_history_restocked_at_idx` on restock_history(restocked_at) — speeds up time-series queries.

## Security (RLS)
   - Both tables have RLS ENABLED.
   - No sign-in screen in this app, so the frontend always runs as the `anon` role.
     Every policy therefore lists `TO anon, authenticated` and uses `USING (true)` /
     `WITH CHECK (true)` because the data is intentionally shared/public (single-tenant
     household tracker, not multi-user).
   - Four separate policies per table (SELECT / INSERT / UPDATE / DELETE) — no `FOR ALL`.
   - `restock_history` is scoped only through its own table policies; the FK CASCADE
     handles cleanup when an inventory row is deleted.

## Important notes
   - This migration is idempotent: `CREATE TABLE IF NOT EXISTS` for tables and
     `DROP POLICY IF EXISTS` before every `CREATE POLICY` so re-running is safe.
   - `price` uses numeric(12,2) so monetary values are exact, not floating-point.
   - `restock_history.quantity` is recorded so a restock can add more than one unit
     at once (used by the Restock modal). The Insights chart plots `price` over
     `restocked_at` for a selected inventory item.
*/

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  brand text,
  variant text,
  unit text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  is_on_manual_list boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  price numeric(12,2),
  restocked_at timestamptz NOT NULL DEFAULT now(),
  quantity integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS restock_history_inventory_id_idx
  ON restock_history(inventory_id);
CREATE INDEX IF NOT EXISTS restock_history_restocked_at_idx
  ON restock_history(restocked_at);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_inventory" ON inventory;
CREATE POLICY "anon_select_inventory" ON inventory FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory;
CREATE POLICY "anon_insert_inventory" ON inventory FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_inventory" ON inventory;
CREATE POLICY "anon_update_inventory" ON inventory FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory;
CREATE POLICY "anon_delete_inventory" ON inventory FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_restock_history" ON restock_history;
CREATE POLICY "anon_select_restock_history" ON restock_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_restock_history" ON restock_history;
CREATE POLICY "anon_insert_restock_history" ON restock_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_restock_history" ON restock_history;
CREATE POLICY "anon_update_restock_history" ON restock_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_restock_history" ON restock_history;
CREATE POLICY "anon_delete_restock_history" ON restock_history FOR DELETE
  TO anon, authenticated USING (true);
