# 現場日報 — Higgsfield移植版（公開中）

**本番URL: https://genba-nippo.higgsfield.app**

`nippo/` (Next.js + Supabase + R2版) を Higgsfield のウェブサイト基盤
(React 19 + TanStack Start / Cloudflare Worker + D1 + R2) に移植し公開したもの。
この `app/` ディレクトリの内容を Higgsfield サイトリポジトリの `app/` に上書きして使う
（デプロイは Higgsfield 側リポジトリへの push + deploy で行う）。

## 移植時の置き換え

- DB: Supabase Postgres → Cloudflare D1 (`migrations/0002_nippo.sql`, `0003_paint.sql`)
- 写真/図面: presigned URL → Workerプロキシ (multipart POST / 認可付きGET)
- 管理者認証: Supabase Auth → `ADMIN_PASSWORD` シークレット + HMAC署名Cookie (`SESSION_SECRET`)
- 写真圧縮: browser-image-compression → Canvas API自前実装 (WebP、非対応環境はJPEG)

## 機能

- 下請けフォーム (`/r/{token}`、ログイン不要・推測不能URL): 業者記憶 / 人数ステッパー /
  工種チップ / 写真圧縮アップロード / 重複警告 / 送信失敗時の下書き再送 / PWA
- **図面色塗り**: 管理側で図面(PDF/画像→PNG化)・縮尺(2点+実寸)・総施工面積を設定すると、
  下請けが図面を指でなぞって塗り、概算面積(m²)を施工面積欄に自動入力できる。
  マスクは `paintmasks/{site}/{report}.png` としてR2に保存、`paint_regions` に面積を記録
- 管理画面 (`/admin`): ダッシュボード / 日報一覧(編集・削除・写真閲覧・CSV) /
  月次集計(現場別・業者別・工種別) / 現場管理(QR発行・A6印刷・終了化・トークン再発行) /
  図面+全塗りの重ね表示と進捗率(塗り済み÷総施工面積、重複は1回だけ集計) /
  業者・工種マスタ / 古い写真の一括削除
- CSVはUTF-8 BOM付き(Excel対応)。全ページnoindex

## シークレット (website_secrets)

- `ADMIN_PASSWORD` — 管理画面のログインパスワード
- `SESSION_SECRET` — セッションCookieの署名鍵
