-- 1つの日報に複数の作業内容を持たせる (作業ごとの人数つき)。
-- reports.workers は合計人数、reports.work_type は表示用のまとめ文字列として残す
-- （既存の一覧・CSV・ダッシュボードをそのまま動かすため）。内訳の正はこのテーブル。
CREATE TABLE IF NOT EXISTS report_work_items (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  workers INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS report_work_items_report_idx ON report_work_items(report_id);
CREATE INDEX IF NOT EXISTS report_work_items_type_idx ON report_work_items(work_type);

-- 既存の日報を「作業1件」の内訳として移行する
INSERT INTO report_work_items (id, report_id, work_type, workers, sort_order)
SELECT lower(hex(randomblob(16))), r.id, r.work_type, r.workers, 0
FROM reports r
WHERE NOT EXISTS (SELECT 1 FROM report_work_items i WHERE i.report_id = r.id);
