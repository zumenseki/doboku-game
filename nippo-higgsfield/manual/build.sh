#!/usr/bin/env bash
# マニュアルPDFのビルド一式（Higgsfieldサンドボックスで実行する想定）
#   1) 本番サイトから画面写真を撮る
#   2) index.html を A4 PDF にレンダリング
#   3) 確認用の縮小画像を出力
#   4) サイトリポジトリの app/public/manual.pdf に配置して push
# 使い方: TOKEN=<repo token> bash build.sh
set -x
BRANCH=claude/nippo-webapp-mvp-qdfucy
REPO=https://apps-repos.higgsfield.ai/hfu-user3D3USOzHCCHfS66isqb0Xkx63fE/genba-nippo-f29d07d3-b0cc-423a-a2bc-0fe73e4d060f.git
B=https://genba-nippo.higgsfield.app
SITE_ID=2ac64e29-f61a-4b05-8ae7-90c894527a64
SUB_TOKEN=z_Cf-pnZyPHTpT_cVpB2y

cd /home/user
rm -rf xfer site manual manual.pdf preview && mkdir xfer
curl -sL "https://codeload.github.com/zumenseki/doboku-game/tar.gz/refs/heads/$BRANCH" | tar xz -C xfer
cp -r xfer/doboku-game-*/nippo-higgsfield/manual /home/user/manual
mkdir -p /home/user/manual/shots
npm i playwright >/dev/null 2>&1
npx playwright install chromium --only-shell >/dev/null 2>&1

cat > /home/user/shots.mjs <<EOF
import { chromium } from 'playwright'
import fs from 'node:fs'
const B = '$B'
const PW = process.env.ADMIN_PW
const SITE = '$SITE_ID'
const out = '/home/user/manual/shots'
const browser = await chromium.launch()
const m = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, locale:'ja-JP', hasTouch:true, isMobile:true })
const p = await m.newPage()
await p.addInitScript(() => localStorage.setItem('nippo_install_dismissed','1'))
await p.goto(\`\${B}/r/$SUB_TOKEN\`, { waitUntil:'networkidle' }); await p.waitForTimeout(1200)
await p.screenshot({ path:\`\${out}/m1-form.png\` })
await p.getByRole('button',{name:'業者を選択'}).click(); await p.waitForTimeout(500)
await p.screenshot({ path:\`\${out}/m2-subpicker.png\` })
await p.getByRole('button',{name:'テスト建設'}).click(); await p.waitForTimeout(300)
await p.getByRole('button',{name:'1人増やす'}).click(); await p.getByRole('button',{name:'1人増やす'}).click()
await p.getByRole('button',{name:'掘削',exact:true}).click(); await p.waitForTimeout(300)
await p.evaluate(()=>window.scrollTo(0,360)); await p.waitForTimeout(400)
await p.screenshot({ path:\`\${out}/m3-worktype.png\` })
await p.getByText('図面を塗って面積を測る').click()
await p.getByText('施工範囲を塗る').waitFor({timeout:20000}); await p.waitForTimeout(2600)
const box = await p.locator('canvas').boundingBox()
const cx = box.x+box.width/2, cy = box.y+box.height/2
await p.mouse.move(cx-70,cy-20); await p.mouse.down()
for (let i=0;i<=22;i++){ await p.mouse.move(cx-70+i*6, cy-20+Math.sin(i/3.5)*26); await p.waitForTimeout(12) }
await p.mouse.up(); await p.waitForTimeout(700)
await p.screenshot({ path:\`\${out}/m4-paint.png\` })
await p.getByRole('button',{name:'この面積を使う'}).click(); await p.waitForTimeout(600)
await p.evaluate(()=>window.scrollTo(0,400)); await p.waitForTimeout(400)
await p.screenshot({ path:\`\${out}/m5-area.png\` })
await p.evaluate(()=>window.scrollTo(0,99999)); await p.waitForTimeout(400)
await p.screenshot({ path:\`\${out}/m6-photo.png\` })
const d = await browser.newContext({ viewport:{width:1280,height:900}, deviceScaleFactor:2, locale:'ja-JP' })
const a0 = await d.newPage()
await a0.goto(\`\${B}/admin\`, { waitUntil:'networkidle' }); await a0.waitForTimeout(1200)
await a0.screenshot({ path:\`\${out}/a0-login.png\` })
await d.request.post(\`\${B}/api/admin/session\`, { data:{ password: PW } })
const a = await d.newPage()
const shot = async (path,file,full=false,wait=2200) => { await a.goto(\`\${B}\${path}\`,{waitUntil:'networkidle'}); await a.waitForTimeout(wait); await a.screenshot({path:\`\${out}/\${file}\`,fullPage:full}) }
await shot('/admin','a1-dashboard.png',false)
await shot('/admin/reports','a2-reports.png',false)
await shot('/admin/summary','a3-summary.png',false)
await shot('/admin/sites','a4-sites.png',false)
await shot(\`/admin/site/$SITE_ID\`,'a5-sitedetail.png',false,3500)
await shot('/admin/subs','a6-subs.png',false)
await shot('/admin/work-types','a7-worktypes.png',false)
await shot('/admin/settings','a8-settings.png',false)
await a.goto(\`\${B}/admin/site/$SITE_ID\`,{waitUntil:'networkidle'}); await a.waitForTimeout(3500)
await a.evaluate(()=>window.scrollTo(0, 620)); await a.waitForTimeout(900)
await a.screenshot({path:\`\${out}/a5b-progress.png\`})
await shot(\`/admin/print/$SITE_ID\`,'a9-print.png',false,2500)
await browser.close()
console.log('SHOTS', fs.readdirSync(out).length)
EOF
node /home/user/shots.mjs

# スクショをJPEGに落としてPDFを軽くする
cd /home/user/manual/shots
for f in *.png; do
  convert "$f" -quality 78 "${f%.png}.jpg" && rm "$f"
done
cd /home/user
sed -i 's/\.png"/.jpg"/g' /home/user/manual/index.html

cat > /home/user/pdf.mjs <<'EOF'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('file:///home/user/manual/index.html', { waitUntil:'networkidle' })
await page.waitForTimeout(1500)
await page.pdf({
  path: '/home/user/manual.pdf',
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:8pt;color:#94a3b8;font-family:sans-serif;padding:0 15mm;display:flex;justify-content:space-between;"><span>現場日報 操作マニュアル</span><span class="pageNumber"></span></div>',
  margin: { top:'16mm', bottom:'18mm', left:'15mm', right:'15mm' },
})
await browser.close()
console.log('PDF_OK')
EOF
node /home/user/pdf.mjs
ls -la /home/user/manual.pdf

# 確認用の縮小画像
mkdir -p /home/user/preview
pdftoppm -jpeg -r 30 /home/user/manual.pdf /home/user/preview/p 2>/dev/null || \
  convert -density 40 /home/user/manual.pdf -quality 55 -resize 240x /home/user/preview/p-%02d.jpg
ls /home/user/preview | head -30

# サイトへ配置
git -c http.extraHeader="Authorization: token $TOKEN" clone --depth 1 "$REPO" site
cp /home/user/manual.pdf site/app/public/manual.pdf
cd site
git config user.email "agent@higgsfield.ai" && git config user.name "Higgsfield Agent"
git add -A && git commit -m "操作マニュアル(PDF)を同梱" | tail -1
git -c http.extraHeader="Authorization: token $TOKEN" push origin main 2>&1 | tail -1
echo BUILD_DONE
