# 作業日報 Web アプリ（MVP）

下請け業者がスマホから日報（人数・作業内容・施工面積・写真）を直接入力し、
管理者の Excel 手転記を廃止するためのアプリです。

- 下請け側: **ログインなし**。現場ごとの推測不能URL `/r/{token}` のみで到達
- 管理者: Supabase Auth（email/password）で `/admin` にログイン
- 完全無料枠で運用（Supabase Free + Cloudflare R2 Free + Cloudflare Pages / Vercel）

## 技術スタック

| 用途 | 採用 |
| --- | --- |
| フレームワーク | Next.js 16（App Router / TypeScript） |
| スタイル | Tailwind CSS v4 |
| DB / 認証 | Supabase Free（Postgres + Auth）※Storageは使わない |
| ファイル保管 | Cloudflare R2（S3互換 / `@aws-sdk/client-s3`） |
| バリデーション | zod（クライアント・サーバ両方） |
| その他 | nanoid / browser-image-compression / qrcode |

## セットアップ

### 1. 依存インストール

```powershell
cd nippo
npm install
```

### 2. Supabase

1. [supabase.com](https://supabase.com) で新規プロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行（テーブル + RLS）
3. 任意で `supabase/seed.sql` を実行（工種・業者の初期データ）
4. Authentication > Users から管理者アカウントを1つ作成（email/password）
   - Authentication > Providers で **Email** を有効、**新規サインアップは無効**にしておくこと
5. Project Settings > API から URL / anon key / service_role key を控える

### 3. Cloudflare R2

1. バケット `nippo-files` を作成（**パブリックアクセスは無効のまま**）
2. R2 API トークン（Object Read & Write）を発行し、Access Key ID / Secret を控える
3. バケットの CORS を設定（presigned URL へブラウザから直接 PUT するため）

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://<本番ドメイン>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. 環境変数

`.env.example` を `.env.local` にコピーして値を埋める。

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # サーバ専用。クライアント露出禁止
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
NEXT_PUBLIC_APP_URL         # QR/現場URLの組み立てに使用（末尾スラッシュなし）
```

### 5. 起動

```powershell
npm run dev
```

- 管理画面: http://localhost:3000/admin
- 下請け画面: 管理画面で現場を作成すると URL と QR が表示される

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバ |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run typecheck` | 型チェック |
| `npm run icons` | PWAアイコン（192/512）を再生成 |
| `npm run verify:rls` | anonキーで全テーブルが読み書き拒否されることを検証（受け入れ条件） |

## アクセスモデル（重要）

- `token = nanoid(21)`（約126bit）。連番・現場名・日付・地名は一切含めない
- token → 現場の解決は必ずサーバ側（Route Handler / Server Component）。
  クライアントに anon キーで `sites` を読ませない
- 下請け系の DB 書き込みは全てサーバの `service_role` キーで実行（`src/lib/supabase/service.ts`）。
  `server-only` を付けているのでクライアントから import するとビルドが落ちる
- RLS は全テーブルで有効。**anon向けポリシーは一切作らない（=全拒否）**。
  authenticated（管理者）のみ全権
- `sites.status = 'closed'` の現場は受付終了画面（410）を返し、入力不可
- 全ページ noindex（`robots.txt` + metaタグ + `X-Robots-Tag` ヘッダ）

## API（下請け側）

| メソッド / パス | 内容 |
| --- | --- |
| `GET /api/r/{token}` | `{ site: { name }, subs, workTypes }`。不明: 404 / 終了: 410 |
| `GET /api/r/{token}/duplicate?subId=&workDate=` | 同一「現場×業者×日付」の提出有無（送信前の警告用） |
| `POST /api/r/{token}/presign` | 写真の presigned PUT URL（image/webp・2MBまで） |
| `POST /api/r/{token}/reports` | 日報 + 写真の登録 |

管理側の操作は Server Actions（`src/app/admin/**/actions.ts`）で実装。

写真の `objectKey` は `reports/{report_id}/{nanoid}.webp`。`report_id` は送信ごとに
クライアントで採番した UUID を presign と登録の両方に渡すことで、
アップロード先とレコードを一致させている（同一IDでの再送は冪等に扱う）。

## ストレージ運用

- 写真はアップロード前にクライアントで圧縮（長辺1600px / WebP / quality 0.75）
- 図面PDFは管理画面から、10MB上限
- 容量が逼迫したら 管理画面 > 設定 の「古い写真の一括削除」
  （終了から180日を超えた現場の写真をR2ごと削除。日報データ自体は残る）

## デプロイ

### Cloudflare Pages / Workers

Next.js の Node ランタイムをそのまま動かすため
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) を使う。

```powershell
npm i -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

環境変数は Cloudflare のダッシュボード（Secrets）に登録する。
`SUPABASE_SERVICE_ROLE_KEY` と `R2_*` は必ず Secret として登録すること。

### Vercel

リポジトリを接続し、Root Directory に `nippo` を指定。
Environment Variables に上記8個を登録すればそのまま動く。

## 受け入れ条件チェック

- [ ] スマホで `/r/{token}` を開いてから60秒以内に日報を送信できる
- [ ] 無効token・終了現場では一切入力できない（404 / 410）
- [ ] `npm run verify:rls` が全項目 OK（anonキーでは読み書き不可）
- [ ] 写真が圧縮されてR2に保存され、管理画面の日報一覧から閲覧できる
- [ ] 月次CSVがExcelで文字化けせず開ける（UTF-8 BOM付き）

## v2 スコープ（未実装）

- 図面色塗り（pdf.js + canvas ポリゴン → `paint_regions`）
- 面積 = shoelace公式 × `scale_m_per_px`^2、縮尺設定UI
- 進捗率 = Σ `paint_regions.area_m2` ÷ 現場総面積
- 完全オフライン対応（現在は送信失敗時の localStorage 下書き + 再送のみ）

テーブル `paint_regions` と `sites.scale_m_per_px` は作成済みで、UIのみ未実装。
