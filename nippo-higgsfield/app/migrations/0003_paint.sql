-- 図面色塗り機能 (v2): 総施工面積・図面画像・縮尺
-- SQLiteのADD COLUMNは冪等でないため、このマイグレーションは一度だけ適用される前提。
ALTER TABLE sites ADD COLUMN total_area_m2 REAL;
ALTER TABLE sites ADD COLUMN drawing_image_key TEXT;
ALTER TABLE sites ADD COLUMN scale_m_per_unit REAL;

CREATE INDEX IF NOT EXISTS paint_regions_report_idx ON paint_regions(report_id);
