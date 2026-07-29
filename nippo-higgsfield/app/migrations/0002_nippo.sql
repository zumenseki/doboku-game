-- 作業日報アプリ スキーマ (D1/SQLite)。全て追加的 (IF NOT EXISTS)。
CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS work_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  drawing_key TEXT,
  scale_m_per_px REAL,
  status TEXT NOT NULL DEFAULT 'active',
  opened_on TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  sub_id TEXT NOT NULL,
  work_date TEXT NOT NULL,
  workers INTEGER NOT NULL,
  work_type TEXT NOT NULL,
  area_m2 REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS reports_site_date_idx ON reports(site_id, work_date);
CREATE INDEX IF NOT EXISTS reports_sub_date_idx ON reports(sub_id, work_date);

CREATE TABLE IF NOT EXISTS report_photos (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS report_photos_report_idx ON report_photos(report_id);

-- v2用 (UIは未実装)
CREATE TABLE IF NOT EXISTS paint_regions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  polygon TEXT NOT NULL,
  area_m2 REAL NOT NULL
);

-- 工種の初期データ
INSERT OR IGNORE INTO work_types (id, name, display_order) VALUES
  ('wt-0001-seed', '掘削', 10),
  ('wt-0002-seed', '埋戻し', 20),
  ('wt-0003-seed', '残土処理', 30),
  ('wt-0004-seed', '路盤工', 40),
  ('wt-0005-seed', '舗装工', 50),
  ('wt-0006-seed', '型枠工', 60),
  ('wt-0007-seed', '鉄筋工', 70),
  ('wt-0008-seed', 'コンクリート打設', 80),
  ('wt-0009-seed', '土工', 90),
  ('wt-0010-seed', '片付け・清掃', 100);
