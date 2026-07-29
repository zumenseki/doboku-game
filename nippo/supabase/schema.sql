-- ============================================================
-- 作業日報アプリ スキーマ（MVP）
-- Supabase SQL Editor にそのまま貼り付けて実行する
-- ============================================================

create extension if not exists pgcrypto;

-- 業者マスタ
create table if not exists subs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 工種マスタ
create table if not exists work_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  is_active boolean not null default true
);

-- 現場
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,            -- nanoid(21)。URL識別子
  name text not null,
  address text,
  drawing_key text,                      -- R2オブジェクトキー（図面PDF）
  scale_m_per_px numeric,                -- v2の面積自動計算用（今回は未使用）
  status text not null default 'active' check (status in ('active','closed')),
  opened_on date default current_date,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 日報
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  sub_id uuid not null references subs(id),
  work_date date not null,
  workers int not null check (workers between 1 and 99),
  work_type text not null,               -- 選択値を文字列で保存（「その他」は自由入力）
  area_m2 numeric check (area_m2 >= 0),  -- 任意
  note text,
  created_at timestamptz not null default now()
);
create index if not exists reports_site_date_idx on reports(site_id, work_date);
create index if not exists reports_sub_date_idx on reports(sub_id, work_date);

-- 日報写真
create table if not exists report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  object_key text not null,              -- R2オブジェクトキー
  created_at timestamptz not null default now()
);

-- v2用（テーブルのみ作成。UIは今回作らない）
create table if not exists paint_regions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  page int not null default 1,
  polygon jsonb not null,                -- [{x,y},...] PDF座標系
  area_m2 numeric not null
);

-- ============================================================
-- RLS
--   管理者(authenticated)のみ全権。anon向けポリシーは作らない = 全拒否
--   下請け側の読み書きは Route Handler 内で service_role を用いて実行（RLSバイパス）
-- ============================================================

alter table subs enable row level security;
alter table work_types enable row level security;
alter table sites enable row level security;
alter table reports enable row level security;
alter table report_photos enable row level security;
alter table paint_regions enable row level security;

drop policy if exists admin_all_subs on subs;
drop policy if exists admin_all_work_types on work_types;
drop policy if exists admin_all_sites on sites;
drop policy if exists admin_all_reports on reports;
drop policy if exists admin_all_report_photos on report_photos;
drop policy if exists admin_all_paint_regions on paint_regions;

create policy admin_all_subs on subs for all to authenticated using (true) with check (true);
create policy admin_all_work_types on work_types for all to authenticated using (true) with check (true);
create policy admin_all_sites on sites for all to authenticated using (true) with check (true);
create policy admin_all_reports on reports for all to authenticated using (true) with check (true);
create policy admin_all_report_photos on report_photos for all to authenticated using (true) with check (true);
create policy admin_all_paint_regions on paint_regions for all to authenticated using (true) with check (true);
