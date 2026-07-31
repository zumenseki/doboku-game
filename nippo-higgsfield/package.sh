#!/usr/bin/env bash
# 引き継ぎ用パッケージ（ZIP）を作り、サイトに配置する。
#   中身: アプリ一式のソース / DB定義 / マニュアル原稿 / マニュアルPDF / 説明書
# 使い方: TOKEN=<repo token> bash package.sh
set -x
BRANCH=claude/nippo-webapp-mvp-qdfucy
REPO=https://apps-repos.higgsfield.ai/hfu-user3D3USOzHCCHfS66isqb0Xkx63fE/genba-nippo-f29d07d3-b0cc-423a-a2bc-0fe73e4d060f.git

cd /home/user
rm -rf pkg site xfer && mkdir -p xfer pkg/genba-nippo-package/pdf
curl -sL "https://codeload.github.com/zumenseki/doboku-game/tar.gz/refs/heads/$BRANCH" | tar xz -C xfer
SRC=$(ls -d xfer/doboku-game-*/nippo-higgsfield)

# ソースとマニュアル原稿
cp -r "$SRC/app"    pkg/genba-nippo-package/app
cp -r "$SRC/manual" pkg/genba-nippo-package/manual
cp "$SRC/PACKAGE.md" pkg/genba-nippo-package/README.md
# 不要物を除去（依存関係・ビルド成果物・撮影済みの画面写真）
rm -rf pkg/genba-nippo-package/app/node_modules \
       pkg/genba-nippo-package/app/dist \
       pkg/genba-nippo-package/app/.wrangler \
       pkg/genba-nippo-package/manual/shots
# 公開サイト側の配布物（PDF/ZIP）はソースに含めない
rm -f pkg/genba-nippo-package/app/public/manual*.pdf \
      pkg/genba-nippo-package/app/public/genba-nippo-package.zip

# 最新のマニュアルPDFをサイトリポジトリから取得して同梱
git -c http.extraHeader="Authorization: token $TOKEN" clone --depth 1 "$REPO" site
cp site/app/public/manual-admin.pdf "pkg/genba-nippo-package/pdf/現場日報_管理者編.pdf"
cp site/app/public/manual-sub.pdf   "pkg/genba-nippo-package/pdf/現場日報_下請け業者編.pdf"

# ZIP化（日本語ファイル名をUTF-8で保存）
cd /home/user/pkg
zip -qr -UN=UTF8 /home/user/genba-nippo-package.zip genba-nippo-package
cd /home/user
ls -la genba-nippo-package.zip
unzip -l genba-nippo-package.zip | tail -5
unzip -l genba-nippo-package.zip | wc -l

# サイトへ配置
cp /home/user/genba-nippo-package.zip site/app/public/genba-nippo-package.zip
cd site
git config user.email "agent@higgsfield.ai" && git config user.name "Higgsfield Agent"
git add -A && git commit -m "引き継ぎ用パッケージ(ZIP)を同梱" | tail -1
git -c http.extraHeader="Authorization: token $TOKEN" push origin main 2>&1 | tail -1
echo PACKAGE_DONE
