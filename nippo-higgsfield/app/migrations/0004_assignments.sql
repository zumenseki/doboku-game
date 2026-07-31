-- 現場×業者の割り当て。割り当てごとに専用の日報URL(token)を発行する。
-- これにより業者は自分の会社を選ぶ必要がなくなる（URLで確定する）。
CREATE TABLE IF NOT EXISTS site_subs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  sub_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS site_subs_pair_idx ON site_subs(site_id, sub_id);
CREATE INDEX IF NOT EXISTS site_subs_site_idx ON site_subs(site_id);

-- 既存データの移行: すでに日報が出ている「現場×業者」は自動で割り当てておく
-- （旧方式で運用していた分がそのまま使えるようにするため）
INSERT OR IGNORE INTO site_subs (id, site_id, sub_id, token)
SELECT
  lower(hex(randomblob(16))),
  r.site_id,
  r.sub_id,
  substr(replace(replace(hex(randomblob(24)),'0','A'),'1','b'), 1, 21)
FROM (SELECT DISTINCT site_id, sub_id FROM reports) AS r;
