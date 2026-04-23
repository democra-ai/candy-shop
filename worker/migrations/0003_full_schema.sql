-- ============================================================
-- Candy Shop — Full schema port (Postgres → SQLite/D1)
-- ============================================================
-- Adds the tables the frontend's hooks expect on top of the
-- payment tables that landed in 0001. All Postgres-isms get the
-- same translation as before (uuid/jsonb/timestamptz → TEXT).
-- ============================================================

-- ── user_profiles ─────────────────────────────────────────────
-- No FK to auth.users — Worker-level auth puts the user id here.
CREATE TABLE IF NOT EXISTS user_profiles (
  id            TEXT PRIMARY KEY,                 -- user id (session.sub)
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  namespace     TEXT UNIQUE,
  provider      TEXT,                             -- 'guest' | 'github' | 'google'
  email         TEXT,                             -- optional, populated by OAuth
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Extend skills so hooks can insert full records ───────────
-- 0001 only had payment columns. Add the rest the frontend writes.
ALTER TABLE skills ADD COLUMN user_id       TEXT;
ALTER TABLE skills ADD COLUMN color         TEXT;
ALTER TABLE skills ADD COLUMN tags          TEXT DEFAULT '[]';   -- JSON array
ALTER TABLE skills ADD COLUMN install_command TEXT;
ALTER TABLE skills ADD COLUMN skill_md_url  TEXT;
ALTER TABLE skills ADD COLUMN popularity    INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN star_count    INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN avg_rating    REAL DEFAULT 0;
ALTER TABLE skills ADD COLUMN ratings_count INTEGER DEFAULT 0;
ALTER TABLE skills ADD COLUMN is_public     INTEGER DEFAULT 1;   -- SQLite bool
ALTER TABLE skills ADD COLUMN origin        TEXT DEFAULT 'store';
ALTER TABLE skills ADD COLUMN status        TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS skills_user_idx    ON skills (user_id);
CREATE INDEX IF NOT EXISTS skills_category_idx ON skills (category);

-- ── stars ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stars (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  skill_id   TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS stars_skill_idx ON stars (skill_id);
CREATE INDEX IF NOT EXISTS stars_user_idx  ON stars (user_id);

-- ── ratings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  skill_id   TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS ratings_skill_idx ON ratings (skill_id);

-- ── downloads ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS downloads (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,                                    -- nullable (anonymous)
  skill_id   TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS downloads_skill_idx ON downloads (skill_id);

-- ── cravings (marketplace requests) ───────────────────────────
CREATE TABLE IF NOT EXISTS cravings (
  id           TEXT PRIMARY KEY,
  user_id      TEXT,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT,
  tags         TEXT DEFAULT '[]',                     -- JSON array
  budget       TEXT,
  urgency      TEXT DEFAULT 'medium' CHECK (urgency IN ('low','medium','high')),
  status       TEXT DEFAULT 'open' CHECK (status IN ('open','in-progress','fulfilled')),
  emoji        TEXT DEFAULT '🍭',
  match_count  INTEGER DEFAULT 0,
  posted_by    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cravings_status_idx  ON cravings (status);
CREATE INDEX IF NOT EXISTS cravings_created_idx ON cravings (created_at DESC);
