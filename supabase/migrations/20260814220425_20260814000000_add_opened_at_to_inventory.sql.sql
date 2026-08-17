/*
# Add opened_at column to inventory

## Purpose
Track when an inventory item was first "opened" (i.e. when the user first
decreased its stock via the minus button). This lets the UI show "Opened on
<date>" on inventory cards and lets users manually set or clear the date
from the edit modal.

## Changes
1. New column: `inventory.opened_at` (timestamptz, nullable)
   - NULL means the item has never been opened (or the date was cleared).
   - Set automatically to NOW() whenever count decreases (minus button).
   - NOT modified when count increases (plus button) or stays the same.
   - Can be set/cleared manually from the edit modal.

2. Trigger: `set_opened_at_on_decrease`
   - BEFORE UPDATE trigger on inventory.
   - Fires only when NEW.count < OLD.count (stock decreased).
   - Sets NEW.opened_at = NOW().
   - If the user manually set opened_at in the same UPDATE, the trigger
     does NOT override it — it only auto-sets when opened_at is still NULL
     OR the user didn't explicitly include opened_at in the update payload.
   - In practice: the minus-button path updates only { count }, so opened_at
     is NULL in the payload → trigger sets it to NOW(). The modal edit path
     explicitly includes opened_at in the payload → trigger respects it.

## Security
- No RLS policy changes. The existing inventory policies already allow
  anon + authenticated full CRUD. The new column is covered by those
  existing UPDATE policies automatically.

## Important notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ for the column add
  and DROP ... IF EXISTS for the trigger/function.
- The trigger function uses a guard: only set opened_at when the count
  actually decreased AND opened_at wasn't explicitly provided in the update.
  This ensures the plus button (count increase) never touches opened_at,
  and manual edits from the modal are respected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'opened_at'
  ) THEN
    ALTER TABLE inventory ADD COLUMN opened_at timestamptz;
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_opened_at_on_decrease ON inventory;
DROP FUNCTION IF EXISTS set_opened_at_on_decrease();

CREATE FUNCTION set_opened_at_on_decrease()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when stock actually decreased
  IF NEW.count < OLD.count THEN
    -- Only auto-set if the update payload didn't explicitly include opened_at.
    -- Supabase's PostgREST sends only the columns present in the .update() call,
    -- so columns not in the payload arrive as NULL (for nullable columns) in NEW.
    -- If the caller explicitly set opened_at (including to NULL to clear it),
    -- we detect that by checking whether opened_at was in the SET list.
    -- Since we can't easily distinguish "not in payload" from "set to NULL",
    -- we use this rule: if NEW.opened_at IS NULL and OLD.opened_at IS NULL,
    -- this is the first time it's being opened — set it to NOW().
    -- If NEW.opened_at IS NOT NULL, the caller set it — respect that.
    -- If NEW.opened_at IS NULL but OLD.opened_at IS NOT NULL, the caller
    -- is clearing it — respect that (leave as NULL).
    IF NEW.opened_at IS NULL AND OLD.opened_at IS NULL THEN
      NEW.opened_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_opened_at_on_decrease
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION set_opened_at_on_decrease();