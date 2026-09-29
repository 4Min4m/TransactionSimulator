-- Row Level Security lockdown.
--
-- Model: the browser NEVER talks to Supabase directly. Only the Lambdas do,
-- with the service_role key (which bypasses RLS) read from AWS Secrets
-- Manager at runtime. RLS is enabled with no permissive policies, and table
-- grants are revoked, so a leaked anon/public key grants no data access.
--
-- Run after supabase/schema.sql.

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions FROM anon, authenticated;

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.batches FROM anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;

-- Intentionally no CREATE POLICY statements.
