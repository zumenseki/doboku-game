-- 初期マスタデータ（任意）。Supabase SQL Editor で実行する。
insert into work_types (name, display_order) values
  ('掘削', 10),
  ('埋戻し', 20),
  ('残土処理', 30),
  ('路盤工', 40),
  ('舗装工', 50),
  ('型枠工', 60),
  ('鉄筋工', 70),
  ('コンクリート打設', 80),
  ('土工', 90),
  ('片付け・清掃', 100)
on conflict (name) do nothing;

insert into subs (name, display_order) values
  ('サンプル建設', 10),
  ('サンプル工業', 20)
on conflict (name) do nothing;
