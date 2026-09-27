-- Table definitions for TransactionSimulator.
--
-- Run this BEFORE supabase/rls.sql. Previously this repo had no schema file
-- at all — rls.sql only locked down a `transactions` table that was assumed
-- to already exist, with no record of how it was created. `batches` is new,
-- added when POST /api/process-batch became asynchronous (see
-- docs/FIXES_AND_CHANGES_fa.md): the API Lambda writes a row immediately and
-- the async worker updates it as it processes simulated transactions.

CREATE TABLE IF NOT EXISTS public.transactions (
  id               bigint generated always as identity primary key,
  order_id         text,
  merchant_id      text        not null,
  amount           numeric     not null,
  card_number      text        not null, -- always stored masked (see lambda/shared.js maskCardNumber)
  type             text        not null,
  status           text        not null,
  iso8583_message  jsonb,
  created_at       timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id                  text        primary key, -- crypto.randomUUID() from lambda.js
  status              text        not null default 'queued', -- queued | processing | completed
  total_transactions  integer     not null,
  success_count       integer     not null default 0,
  failure_count       integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

-- ---------------------------------------------------------------------------
-- users — DESIGN ONLY, not yet used by the application.
--
-- Today the app authenticates a single admin whose username + bcrypt password
-- hash come from environment variables (ADMIN_USERNAME / ADMIN_PASSWORD_HASH),
-- so there is no user store. This table is the migration target for moving off
-- the single hardcoded admin toward real, multiple users. See the README
-- "Auth migration path (Cognito)" section for how this fits a Cognito rollout:
-- with Cognito, this table becomes an optional app-side profile/role mirror
-- keyed by the Cognito `sub`, and password_hash is dropped entirely (Cognito
-- owns credentials). Until that work lands, nothing writes or reads this table.
CREATE TABLE IF NOT EXISTS public.users (
  id             uuid        primary key default gen_random_uuid(),
  username       text        not null unique,
  -- Only used in the interim DB-backed-auth step; REMOVED once Cognito owns
  -- credentials (Cognito stores no password in your database).
  password_hash  text,
  -- Cognito subject id, populated after migrating to Cognito. Nullable so the
  -- interim DB-backed step (no Cognito yet) still works.
  cognito_sub    text        unique,
  role           text        not null default 'admin',
  created_at     timestamptz not null default now()
);
