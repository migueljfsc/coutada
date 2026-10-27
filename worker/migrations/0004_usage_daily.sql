-- Everybody's use, anonymously (D26, pb-D119): one number per UTC day per event. It names no
-- person, device, map or hunt, so it is off deleteAccount's list; the sweep keeps 400 days.
CREATE TABLE usage_daily (
  day   TEXT NOT NULL,
  event TEXT NOT NULL,
  n     INTEGER NOT NULL,
  PRIMARY KEY (day, event)
) WITHOUT ROWID;
