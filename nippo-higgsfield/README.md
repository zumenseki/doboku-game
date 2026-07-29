# 現場日報 — Higgsfield移植版

`nippo/` (Next.js + Supabase + R2版) を Higgsfield のウェブサイト基盤
(React 19 + TanStack Start / Cloudflare Worker + D1 + R2) に移植したもの。
この `app/` ディレクトリの内容を Higgsfield サイトリポジトリの `app/` に上書きして使う。

- DB: Supabase Postgres → Cloudflare D1 (migrations/0002_nippo.sql)
- 写真/図面: presigned URL → Workerプロキシ (multipart POST / 認可付きGET)
- 管理者認証: Supabase Auth → ADMIN_PASSWORD シークレット + HMAC署名Cookie
- 写真圧縮: browser-image-compression → Canvas API自前実装 (WebP、非対応環境はJPEG)
- 機能は同一: 下請けフォーム / ダッシュボード / 日報一覧 / 集計 / CSV(BOM付き) /
  現場管理(QR・A6印刷・図面・終了化・トークン再発行) / マスタCRUD / 写真一括削除
