-- ============================================================
-- Candy Shop — Payments schema (SQLite/D1 port)
-- ============================================================
-- Postgres → SQLite translation notes
--   uuid            → TEXT (UUIDv4 string)
--   jsonb           → TEXT (JSON stored as string; use json() in queries)
--   timestamptz     → TEXT (ISO-8601 string; DEFAULT (datetime('now')))
--   enum CHECKs     → CHECK (col IN (...)) constraints preserved
--   RLS             → dropped (Worker is the only writer; service-role analog)
--   RPC (PL/pgSQL)  → reimplemented in TypeScript in the Worker
-- ============================================================

-- ── Skills (subset needed by the payment flow) ──────────────
-- Created by the frontend's skill-creator today. Here we only keep
-- the columns the checkout route reads to price a purchase.
CREATE TABLE IF NOT EXISTS skills (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  category        TEXT,
  pricing_model   TEXT NOT NULL DEFAULT 'free'
                    CHECK (pricing_model IN ('free', 'one_time', 'per_call', 'subscription')),
  price_amount    INTEGER NOT NULL DEFAULT 0,          -- cents
  price_currency  TEXT NOT NULL DEFAULT 'usd',
  stripe_price_id TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS skills_pricing_idx ON skills (pricing_model);

-- ── Purchases — one row per completed Stripe payment ────────
CREATE TABLE IF NOT EXISTS purchases (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  skill_id      TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('stripe', 'x402')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  amount        INTEGER NOT NULL DEFAULT 0,            -- cents
  currency      TEXT NOT NULL DEFAULT 'usd',
  external_id   TEXT,                                   -- Stripe payment_intent id
  metadata      TEXT DEFAULT '{}',                      -- JSON string
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT
);

CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id);
CREATE INDEX IF NOT EXISTS purchases_skill_idx ON purchases (skill_id);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases (status);

-- ── Entitlements — granted access rights per user/skill ─────
CREATE TABLE IF NOT EXISTS entitlements (
  user_id         TEXT NOT NULL,
  skill_id        TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('permanent', 'subscription', 'per_call')),
  granted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,                                 -- for 'subscription'
  remaining_calls INTEGER,                              -- for 'per_call'
  provider        TEXT NOT NULL CHECK (provider IN ('stripe', 'x402')),
  purchase_id     TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS entitlements_user_idx ON entitlements (user_id);

-- ── Checkout sessions — in-flight Stripe sessions ───────────
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  provider            TEXT NOT NULL CHECK (provider IN ('stripe', 'x402')),
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'completed', 'expired', 'cancelled')),
  skill_ids           TEXT NOT NULL,                    -- JSON array of skill ids
  total_amount        INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'usd',
  stripe_session_id   TEXT UNIQUE,
  metadata            TEXT DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at          TEXT
);

CREATE INDEX IF NOT EXISTS checkout_sessions_user_idx ON checkout_sessions (user_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_stripe_idx ON checkout_sessions (stripe_session_id);
