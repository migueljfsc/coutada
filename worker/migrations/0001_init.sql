-- Accounts, anonymous devices and maps (D4, D5, D8). Timestamps are unix seconds.
-- Every table that names a person is on deleteAccount's or deleteDevice's list (D22).

-- ---------------------------------------------------------------------- accounts (pb-D109)

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  -- Lowercased by the application; UNIQUE holds only because every write normalises first.
  email         TEXT NOT NULL UNIQUE,
  -- v2$salt$HMAC(pepper, salt$key); NULL for an account that only signs in with Google.
  password_hash TEXT,
  display_name  TEXT,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER,
  last_seen_at  INTEGER
);

-- id is the SHA-256 of the cookie's token, never the token.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

-- Keyed on the provider's subject, which never changes, not on the address, which can.
CREATE TABLE identities (
  provider   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX identities_user_id ON identities(user_id);

-- A verify token carries the hash to install when it returns; no users row exists before then.
-- email is not a foreign key: a verify token names an address that has no account yet.
CREATE TABLE email_tokens (
  id            TEXT PRIMARY KEY,
  purpose       TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  email         TEXT NOT NULL,
  password_hash TEXT,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX email_tokens_email ON email_tokens(email, purpose);
CREATE INDEX email_tokens_expires_at ON email_tokens(expires_at);

-- --------------------------------------------------------------- anonymous devices (D5)

-- An anonymous identity. It expires 90 days after last_seen_at, with everything it owns.
CREATE TABLE devices (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX devices_last_seen_at ON devices(last_seen_at);

-- One token per browser holding the device; id is the SHA-256 of the cookie's token.
CREATE TABLE device_tokens (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX device_tokens_device_id ON device_tokens(device_id);

-- A single-use code that hands the device to another browser; id is the code's SHA-256.
CREATE TABLE device_transfers (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX device_transfers_device_id ON device_transfers(device_id);
CREATE INDEX device_transfers_expires_at ON device_transfers(expires_at);

-- --------------------------------------------------------------------------- maps (D8)

CREATE TABLE maps (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  owner_device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- The serialised MapDoc (D7), validated by src/doc/schema.ts on every write.
  doc             TEXT NOT NULL,
  -- Optimistic concurrency: a write carries the version it read and is refused on a mismatch.
  version         INTEGER NOT NULL DEFAULT 1,
  share_slug      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  CHECK ((owner_user_id IS NULL) != (owner_device_id IS NULL))
);
CREATE INDEX maps_owner_user_id ON maps(owner_user_id);
CREATE INDEX maps_owner_device_id ON maps(owner_device_id);
CREATE UNIQUE INDEX maps_share_slug ON maps(share_slug) WHERE share_slug IS NOT NULL;
