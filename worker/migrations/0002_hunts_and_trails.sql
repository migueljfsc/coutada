-- Live hunts and saved trails (D9, D10, D14). Timestamps are unix seconds.

-- Active hunts only: the row is the code index. Ending a hunt deletes it, which frees the code.
CREATE TABLE hunts (
  id             TEXT PRIMARY KEY,
  code           TEXT,
  map_id         TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('montaria', 'salto')),
  host_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  host_device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  CHECK ((host_user_id IS NULL) != (host_device_id IS NULL))
);
CREATE UNIQUE INDEX hunts_code ON hunts(code) WHERE code IS NOT NULL;
CREATE INDEX hunts_map_id ON hunts(map_id);
CREATE INDEX hunts_expires_at ON hunts(expires_at);

-- A person's own trail, saved by them after a hunt; nobody else's is ever stored (D14).
CREATE TABLE trails (
  id              TEXT PRIMARY KEY,
  owner_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  owner_device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  map_id          TEXT REFERENCES maps(id) ON DELETE SET NULL,
  hunt_type       TEXT NOT NULL CHECK (hunt_type IN ('montaria', 'salto')),
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER NOT NULL,
  distance_m      INTEGER NOT NULL,
  -- JSON array of [lon, lat, seconds], simplified to within 5 m.
  line            TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  CHECK ((owner_user_id IS NULL) != (owner_device_id IS NULL))
);
CREATE INDEX trails_owner_user_id ON trails(owner_user_id);
CREATE INDEX trails_owner_device_id ON trails(owner_device_id);
