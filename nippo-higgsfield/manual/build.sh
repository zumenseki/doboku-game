#!/usr/bin/env bash
# マニュアルPDF（管理者編・下請け業者編）のビルド一式
#   1) 本番サイトから画面写真を撮る
#   2) admin.html / sub.html を A4 PDF にレンダリング
#   3) 確認用の縮小画像を出力
#   4) サイトリポジトリの app/public/ に配置して push
# 使い方: TOKEN=<repo token> ADMIN_PW=<管理者パスワード> bash build.sh
set -x
BRANCH=claude/nippo-webapp-mvp-qdfucy
REPO=https://apps-repos.higgsfield.ai/hfu-user3D3USOzHCCHfS66isqb0Xkx63fE/genba-nippo-f29d07d3-b0cc-423a-a2bc-0fe73e4d060f.git
B=https://genba-nippo.higgsfield.app
SITE_ID=2ac64e29-f61a-4b05-8ae7-90c894527a64

cd /home/user
rm -rf xfer site manual manual*.pdf preview && mkdir xfer
curl -sL "https://codeload.github.com/zumenseki/doboku-game/tar.gz/refs/heads/$BRANCH" | tar xz -C xfer
cp -r xfer/doboku-game-*/nippo-higgsfield/manual /home/user/manual
mkdir -p /home/user/manual/shots
# サンドボックスにプリインストール済みの Playwright / Chromium を使う（再ダウンロードしない）
mkdir -p /home/user/node_modules
ln -sfn /usr/local/lib/node_modules/playwright /home/user/node_modules/playwright
ln -sfn /usr/local/lib/node_modules/playwright-core /home/user/node_modules/playwright-core

cat > /home/user/shots.mjs <<EOF
import { chromium } from 'playwright'
import fs from 'node:fs'
const B = '$B'
const PW = process.env.ADMIN_PW
const out = '/home/user/manual/shots'
const browser = await chromium.launch()

// 管理者セッション（トークンの取得にも使う）
const d = await browser.newContext({ viewport:{width:1280,height:900}, deviceScaleFactor:2, locale:'ja-JP' })
await d.request.post(\`\${B}/api/admin/session\`, { data:{ password: PW } })

// 撮影に使う現場を選ぶ。「業者が割り当ててあり、図面・縮尺・総面積が揃っている現場」でないと
// 色塗り画面が撮れないため、条件を満たすものを自動で探す（SITE_IDの指定があればそれを優先）。
const preferred = '$SITE_ID'
const asgAll = await (await d.request.get(\`\${B}/api/admin/assignments?status=all\`)).json()
const candidates = [...new Set((asgAll.rows ?? []).map((r) => r.site_id))]
const ordered = candidates.includes(preferred) ? [preferred, ...candidates] : candidates
let SITE = null, TOKEN = null
for (const id of ordered) {
  const detail = await (await d.request.get(\`\${B}/api/admin/site?id=\${id}\`)).json()
  const s = detail.site ?? {}
  if (!s.drawing_image_key || !s.scale_m_per_unit || s.total_area_m2 == null) continue
  const token = (asgAll.rows ?? []).find((r) => r.site_id === id)?.token
  if (!token) continue
  SITE = id; TOKEN = token
  console.log('DEMO_SITE', s.name, s.status)
  break
}
if (!SITE) throw new Error('撮影に使える現場がありません（業者の割り当て＋図面・縮尺・総施工面積が必要）')

// ---------- 下請け（スマホ） ----------
const m = await browser.newContext({ viewport:{width:390,height:780}, deviceScaleFactor:2, locale:'ja-JP', hasTouch:true, isMobile:true })
const p = await m.newPage()
await p.addInitScript(() => { localStorage.setItem('nippo_install_dismissed','1'); localStorage.clear() })
await p.goto(\`\${B}/r/\${TOKEN}\`, { waitUntil:'networkidle' }); await p.waitForTimeout(1400)
await p.screenshot({ path:\`\${out}/m1-form.png\` })
await p.getByRole('button',{name:'1人増やす'}).click(); await p.getByRole('button',{name:'1人増やす'}).click()
// 工種は現場ごとに変わるので、登録されている先頭の作業内容を選ぶ
const site = await (await p.request.get(\`\${B}/api/rsite?token=\${TOKEN}\`)).json()
const WT = site.workTypes?.[0]
if (!WT) throw new Error('作業内容（工種）が1件も登録されていません')
await p.getByRole('button',{name:WT,exact:true}).first().click(); await p.waitForTimeout(300)
await p.evaluate(()=>window.scrollTo(0,300)); await p.waitForTimeout(400)
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
await p.evaluate(()=>window.scrollTo(0,330)); await p.waitForTimeout(400)
await p.screenshot({ path:\`\${out}/m5-area.png\` })
await p.evaluate(()=>window.scrollTo(0,99999)); await p.waitForTimeout(400)
await p.screenshot({ path:\`\${out}/m6-photo.png\` })

// ---------- 管理（PC） ----------
const anon = await browser.newContext({ viewport:{width:1280,height:900}, deviceScaleFactor:2, locale:'ja-JP' })
const a0 = await anon.newPage()
await a0.goto(\`\${B}/admin\`, { waitUntil:'networkidle' }); await a0.waitForTimeout(1200)
await a0.screenshot({ path:\`\${out}/a0-login.png\` })

const a = await d.newPage()
const shot = async (path,file,wait=2400) => { await a.goto(\`\${B}\${path}\`,{waitUntil:'networkidle'}); await a.waitForTimeout(wait); await a.screenshot({path:\`\${out}/\${file}\`}) }
await shot('/admin','a1-dashboard.png')
await shot('/admin/reports','a2-reports.png')
await shot('/admin/summary','a3-summary.png')
await shot('/admin/sites','a4-sites.png')
await shot(\`/admin/site/\${SITE}\`,'a5-sitedetail.png',3600)
await shot('/admin/subs','a6-subs.png')
await shot('/admin/work-types','a7-worktypes.png')
await shot('/admin/settings','a8-settings.png')
await shot('/admin/assignments','a10-assignments.png',3000)
// 業者ごと表示に切り替えて撮影
await a.selectOption('#gb','sub'); await a.waitForTimeout(1500)
await a.screenshot({ path:\`\${out}/a11-bysub.png\` })
// 業者マスタの「現場に割当」モーダル
await a.goto(\`\${B}/admin/subs\`,{waitUntil:'networkidle'}); await a.waitForTimeout(2500)
await a.getByRole('button',{ name:/現場に割当/ }).first().click()
await a.getByText(/を現場に割り当てる/).waitFor({timeout:15000}); await a.waitForTimeout(1800)
await a.screenshot({ path:\`\${out}/a12-subsites.png\` })
// 現場詳細の割り当てパネル（拡大）
await a.goto(\`\${B}/admin/site/\${SITE}\`,{waitUntil:'networkidle'}); await a.waitForTimeout(3600)
await a.screenshot({ path:\`\${out}/a13-assignpanel.png\`, clip:{x:0,y:110,width:1280,height:430} })
// 図面と進捗
await a.evaluate(()=>window.scrollTo(0, 700)); await a.waitForTimeout(900)
await a.screenshot({ path:\`\${out}/a5b-progress.png\` })
// A6印刷ビュー
await a.goto(\`\${B}/admin/print/\${SITE}\`,{waitUntil:'networkidle'}); await a.waitForTimeout(2600)
await a.screenshot({ path:\`\${out}/a9-print.png\` })
await browser.close()
console.log('SHOTS', fs.readdirSync(out).length)
EOF
node /home/user/shots.mjs

# 撮影に失敗したまま先へ進むと「画像のないPDF」を本番に上書きしてしまう。
# 想定枚数(20)に足りなければここで止める。
SHOTS=$(ls /home/user/manual/shots/*.png 2>/dev/null | wc -l)
if [ "$SHOTS" -lt 20 ]; then
  echo "BUILD_ABORT: 画面写真が $SHOTS 枚しかありません（20枚必要）。PDFは作らず終了します。"
  exit 1
fi

# スクショをJPEGに落としてPDFを軽くする
cd /home/user/manual/shots
for f in *.png; do
  convert "$f" -quality 78 "${f%.png}.jpg" && rm "$f"
done
cd /home/user
sed -i 's/\.png"/.jpg"/g' /home/user/manual/admin.html /home/user/manual/sub.html

cat > /home/user/pdf.mjs <<'EOF'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const foot = (title) => '<div style="width:100%;font-size:8pt;color:#94a3b8;font-family:sans-serif;padding:0 15mm;display:flex;justify-content:space-between;"><span>' + title + '</span><span class="pageNumber"></span></div>'
const books = [
  { src: 'admin.html', out: '/home/user/manual-admin.pdf', title: '現場日報 管理者マニュアル' },
  { src: 'sub.html',   out: '/home/user/manual-sub.pdf',   title: '現場日報 下請け業者マニュアル' },
]
for (const b of books) {
  const page = await browser.newPage()
  await page.goto('file:///home/user/manual/' + b.src, { waitUntil:'networkidle' })
  await page.waitForTimeout(1500)
  await page.pdf({
    path: b.out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>', footerTemplate: foot(b.title),
    margin: { top:'16mm', bottom:'18mm', left:'15mm', right:'15mm' },
  })
  await page.close()
  console.log('PDF_OK', b.out)
}
await browser.close()
EOF
node /home/user/pdf.mjs
ls -la /home/user/manual-admin.pdf /home/user/manual-sub.pdf

# 確認用の縮小画像
mkdir -p /home/user/preview
pdftoppm -jpeg -r 30 /home/user/manual-admin.pdf /home/user/preview/admin
pdftoppm -jpeg -r 30 /home/user/manual-sub.pdf /home/user/preview/sub
ls /home/user/preview | wc -l

# サイトへ配置
git -c http.extraHeader="Authorization: token $TOKEN" clone --depth 1 "$REPO" site
cp /home/user/manual-admin.pdf site/app/public/manual-admin.pdf
cp /home/user/manual-sub.pdf site/app/public/manual-sub.pdf
cd site
git config user.email "agent@higgsfield.ai" && git config user.name "Higgsfield Agent"
git add -A && git commit -m "操作マニュアルを更新（現場×業者の割り当て方式）" | tail -1
git -c http.extraHeader="Authorization: token $TOKEN" push origin main 2>&1 | tail -1
echo BUILD_DONE
