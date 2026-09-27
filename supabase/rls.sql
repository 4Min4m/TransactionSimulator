-- Supabase Row Level Security for the `transactions` table.
--
-- Model: the browser NEVER talks to Supabase directly. Only the Lambda does,
-- using the SERVICE ROLE key (which bypasses RLS). RLS is enabled and locked
-- down so that if the anon/public key ever leaks, it grants no data access.
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI migrations).

-- 1) Turn RLS on. With RLS enabled and no permissive policy, anon/authenticated
--    roles get ZERO rows and cannot write. The service_role bypasses RLS.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2) Force RLS even for the table owner, so nothing slips through.
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

-- 3) Explicitly REVOKE direct grants from the anon and authenticated roles.
--    (Defense in depth; RLS already denies, this removes table privileges too.)
REVOKE ALL ON public.transactions FROM anon, authenticated;

-- No CREATE POLICY statements: we intentionally grant no access to anon /
-- authenticated. The Lambda's service_role key is the only writer/reader.
--
-- IMPORTANT: set the Lambda's SUPABASE_KEY to the *service_role* key
-- (Supabase dashboard -> Project Settings -> API -> service_role secret),
-- NOT the anon key. Keep the service_role key only in server-side secrets.

-- ---------------------------------------------------------------------------
-- Same lockdown for the new `batches` table (added when POST
-- /api/process-batch became asynchronous — see
-- docs/FIXES_AND_CHANGES_fa.md). Run supabase/schema.sql first to create it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.batches FROM anon, authenticated;
