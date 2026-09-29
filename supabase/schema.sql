-- Table definitions for TransactionSimulator.
--
-- Safe to re-run: every statement is idempotent, so the same file both
-- creates a fresh database and upgrades an existing one. Run it BEFORE
-- supabase/rls.sql.

-- ---------------------------------------------------------------------------
-- transactions — one row per authorization attempt (approved or declined).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id               bigint generated always as identity primary key,
  order_id         text,
  merchant_id      text        not null,
  amount           numeric(14, 2) not null,
  card_number      text        not null, -- always masked, see lambda/pan.js maskCardNumber
  type             text        not null,
  status           text        not null,
  iso8583_message  jsonb,                -- masked 0100 request + 0110 response
  created_at       timestamptz not null default now()
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS batch_id           text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency           text not null default 'USD';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS card_scheme        text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS response_code      text; -- ISO 8583 field 39
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS authorization_code text; -- ISO 8583 field 38
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS processing_ms      numeric(10, 3);

-- Idempotency key. The database, not the application, guarantees that a
-- retried request (or a redelivered SQS message) can never create a second
-- payment for the same order. Rows with a NULL order_id (from older versions)
-- do not conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_merchant_order_uidx
  ON public.transactions (merchant_id, order_id);

CREATE INDEX IF NOT EXISTS transactions_created_at_idx
  ON public.transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_batch_status_idx
  ON public.transactions (batch_id, status)
  WHERE batch_id IS NOT NULL;

-- A stored PAN must be masked. Enforced here as a last line of defence in
-- case an application bug ever tried to write a full card number.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_card_number_masked') THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_card_number_masked
      CHECK (card_number = '****' OR card_number ~ '^[0-9]{4}-\*{4}-\*{4}-[0-9]{4}$') NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- batches — progress/result of an asynchronous load test.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batches (
  id                  text        primary key, -- crypto.randomUUID() from lambda.js
  status              text        not null default 'queued', -- queued | processing | completed | failed
  total_transactions  integer     not null,
  success_count       integer     not null default 0,
  failure_count       integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS merchant_id  text;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS total_amount numeric(14, 2);

-- ---------------------------------------------------------------------------
-- users — DESIGN ONLY, not used by the application yet.
--
-- Today a single admin authenticates with credentials from the environment
-- (ADMIN_USERNAME / ADMIN_PASSWORD_HASH). This table is the migration target
-- for multiple users; with Amazon Cognito it becomes an app-side profile/role
-- mirror keyed by the Cognito `sub`, and password_hash is dropped.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id             uuid        primary key default gen_random_uuid(),
  username       text        not null unique,
  password_hash  text,
  cognito_sub    text        unique,
  role           text        not null default 'admin',
  created_at     timestamptz not null default now()
);
