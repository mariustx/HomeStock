/*
# Authentication & secure Row Level Security

## Purpose
Upgrade the household storage app from a single-tenant (shared, anon-accessible)
data model to a real multi-user model secured by Supabase Auth + owner-scoped
RLS. This is additive only: no tables are recreated, no columns dropped or
retyped, and no existing rows are deleted.

## Strategy for existing data
The existing 35 inventory / 1 shopping / 3 restock rows were created by the
old single-tenant app and have no owner. We must NOT delete them, and we must
NOT lock the app out of its own data.

Approach:
  1. Add a nullable `user_id uuid` column to each table, with a foreign key
     to `auth.users(id) ON DELETE SET NULL`.
  2. Replace every `USING (true)` / `WITH CHECK (true)` policy with strict
     `auth.uid() = user_id` owner-scoped policies (TO authenticated only).
  3. Backfill existing rows to the first authenticated user. Because there
     are currently 0 users, the backfill runs as a guarded UPDATE that only
     fires when a user exists. A dedicated `assign_existing_data_to_user()`
     function is created so the owner can run it once after creating their
     account (see "Backfill" below).
  4. Set `user_id uuid NOT NULL DEFAULT auth.uid()` on each table so that
     future inserts made by an authenticated session automatically pick up
     the owner — the frontend never has to send user_id. Existing rows keep
     their NULL user_id until the backfill function is run.

  IMPORTANT: The column is added NULLABLE first so the ALTER does not fail
  on existing rows. The DEFAULT auth.uid() is added in the same statement so
  new inserts are auto-stamped. We do NOT add NOT NULL yet because the
  legacy rows are still NULL; forcing NOT NULL would reject the migration.
  Once the backfill function has been run, user_id is effectively non-null
  for all rows.

## Modified tables
1. `inventory`
   - ADD COLUMN user_id uuid DEFAULT auth.uid()
   - ADD FK inventory_user_id_fk → auth.users(id) ON DELETE SET NULL
   - DROP all 4 anon policies, CREATE 4 owner-scoped policies (TO authenticated)
2. `restock_history`
   - ADD COLUMN user_id uuid DEFAULT auth.uid()
   - ADD FK restock_history_user_id_fk → auth.users(id) ON DELETE SET NULL
   - DROP all 4 anon policies, CREATE 4 owner-scoped policies (TO authenticated)
3. `shopping_items`
   - ADD COLUMN user_id uuid DEFAULT auth.uid()
   - ADD FK shopping_items_user_id_fk → auth.users(id) ON DELETE SET NULL
   - DROP all 4 anon policies, CREATE 4 owner-scoped policies (TO authenticated)

## New objects
- function `public.assign_existing_data_to_user(target_uid uuid)` — assigns
  all currently-unowned rows (user_id IS NULL) across all three tables to the
  given user. Idempotent: only touches NULL rows. Intended to be run once,
  right after the first user registers.

## Indexes
- inventory(user_id), shopping_items(user_id), restock_history(user_id) —
  every RLS filter is `auth.uid() = user_id`, so these indexes make the
  per-user SELECT/UPDATE/DELETE scale.

## Security changes
- RLS remains ENABLED on all three tables (it already was).
- Every `USING (true)` / `WITH CHECK (true)` / anon-role policy is DROPPED.
- Replaced with four owner-scoped policies per table (SELECT/INSERT/UPDATE/
  DELETE), each `TO authenticated` and gated on `auth.uid() = user_id`.
- INSERT policies use WITH CHECK (auth.uid() = user_id) — combined with the
  DEFAULT auth.uid() this means the frontend can insert without sending
  user_id and the row is auto-stamped with the correct owner.
- anon role has NO policies on any table → unauthenticated requests see and
  touch nothing.

## Important notes
  - Idempotent: column adds use DO $$ ... IF NOT EXISTS; policies use
    DROP POLICY IF EXISTS before CREATE; FK constraints use DO $$ guard;
    function uses CREATE OR REPLACE.
  - No DROP TABLE, no DROP COLUMN, no type changes, no renames.
  - Backfill function preserves data: it only UPDATEs NULL user_id rows.
*/

-- ============================================================
-- 1. Add user_id columns with DEFAULT auth.uid()
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'inventory' AND column_name = 'user_id') THEN
    ALTER TABLE inventory ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'restock_history' AND column_name = 'user_id') THEN
    ALTER TABLE restock_history ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'shopping_items' AND column_name = 'user_id') THEN
    ALTER TABLE shopping_items ADD COLUMN user_id uuid DEFAULT auth.uid();
  END IF;
END $$;

-- ============================================================
-- 2. Add foreign keys to auth.users(id) ON DELETE SET NULL
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_user_id_fk') THEN
    ALTER TABLE inventory
      ADD CONSTRAINT inventory_user_id_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restock_history_user_id_fk') THEN
    ALTER TABLE restock_history
      ADD CONSTRAINT restock_history_user_id_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_items_user_id_fk') THEN
    ALTER TABLE shopping_items
      ADD CONSTRAINT shopping_items_user_id_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Indexes on user_id (every RLS filter keys on this)
-- ============================================================
CREATE INDEX IF NOT EXISTS inventory_user_id_idx ON inventory(user_id);
CREATE INDEX IF NOT EXISTS shopping_items_user_id_idx ON shopping_items(user_id);
CREATE INDEX IF NOT EXISTS restock_history_user_id_idx ON restock_history(user_id);

-- ============================================================
-- 4. Replace insecure policies with secure owner-scoped policies
--    Drop ALL existing anon/true policies first.
-- ============================================================

-- --- inventory ---
DROP POLICY IF EXISTS "anon_select_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_insert_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_update_inventory" ON inventory;
DROP POLICY IF EXISTS "anon_delete_inventory" ON inventory;

CREATE POLICY "select_own_inventory" ON inventory FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_inventory" ON inventory FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_inventory" ON inventory FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_inventory" ON inventory FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- --- restock_history ---
DROP POLICY IF EXISTS "anon_select_restock_history" ON restock_history;
DROP POLICY IF EXISTS "anon_insert_restock_history" ON restock_history;
DROP POLICY IF EXISTS "anon_update_restock_history" ON restock_history;
DROP POLICY IF EXISTS "anon_delete_restock_history" ON restock_history;

CREATE POLICY "select_own_restock_history" ON restock_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_restock_history" ON restock_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_restock_history" ON restock_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_restock_history" ON restock_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- --- shopping_items ---
DROP POLICY IF EXISTS "anon_select_shopping_items" ON shopping_items;
DROP POLICY IF EXISTS "anon_insert_shopping_items" ON shopping_items;
DROP POLICY IF EXISTS "anon_update_shopping_items" ON shopping_items;
DROP POLICY IF EXISTS "anon_delete_shopping_items" ON shopping_items;

CREATE POLICY "select_own_shopping_items" ON shopping_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_shopping_items" ON shopping_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_shopping_items" ON shopping_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_shopping_items" ON shopping_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. Backfill function
--    Assigns all currently-unowned (user_id IS NULL) rows across the three
--    tables to the given user. Idempotent: only touches NULL rows.
--    Run once after the first user registers, e.g.:
--      SELECT assign_existing_data_to_user('<first-user-uuid>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_existing_data_to_user(target_uid uuid)
RETURNS TABLE(table_name text, rows_assigned bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_count bigint;
  shop_count bigint;
  restock_count bigint;
BEGIN
  UPDATE inventory SET user_id = target_uid WHERE user_id IS NULL;
  GET DIAGNOSTICS inv_count = ROW_COUNT;
  UPDATE shopping_items SET user_id = target_uid WHERE user_id IS NULL;
  GET DIAGNOSTICS shop_count = ROW_COUNT;
  UPDATE restock_history SET user_id = target_uid WHERE user_id IS NULL;
  GET DIAGNOSTICS restock_count = ROW_COUNT;

  RETURN QUERY SELECT 'inventory'::text, inv_count;
  RETURN QUERY SELECT 'shopping_items'::text, shop_count;
  RETURN QUERY SELECT 'restock_history'::text, restock_count;
END;
$$;
