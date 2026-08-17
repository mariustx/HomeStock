/*
# Remove one-time backfill function

## Purpose
The `assign_existing_data_to_user(uuid)` function was a one-time helper used
right after the first user registered, to assign legacy unowned rows to that
user. That migration is complete and the function is no longer needed.

## Why remove it
The function was SECURITY DEFINER (ran with the table owner's privileges) and
was callable by `anon`, `authenticated`, and many other roles via the REST
API. Exposing a SECURITY DEFINER function that performs unconditional UPDATEs
is a security risk: any caller could reassign unowned rows to themselves.
Removing it eliminates that surface entirely.

## Changes
1. REVOKE EXECUTE on the function from PUBLIC and from the anon and
   authenticated roles explicitly, so no role retains the privilege before
   the drop.
2. DROP FUNCTION public.assign_existing_data_to_user(uuid) — removes the
   function and its SECURITY DEFINER surface permanently.
3. No triggers reference the function (verified). No application code
   calls it after this change.

## Important notes
   - Uses IF EXISTS so re-running is safe.
   - No tables, columns, or data are touched. Existing rows keep their
     already-assigned user_id values.
   - After this migration there are NO SECURITY DEFINER functions in the
     public schema, so none are exposed through the REST API.
*/

REVOKE EXECUTE ON FUNCTION public.assign_existing_data_to_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_existing_data_to_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_existing_data_to_user(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.assign_existing_data_to_user(uuid);
