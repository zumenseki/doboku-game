// anonキー単体でどのテーブルも読み書きできないことを検証する（§12 受け入れ条件）。
// 実行: node --env-file=.env.local scripts/verify-rls.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

const TABLES = ['subs', 'work_types', 'sites', 'reports', 'report_photos', 'paint_regions']

const SAMPLE_INSERT = {
  subs: { name: `rls-test-${Date.now()}` },
  work_types: { name: `rls-test-${Date.now()}` },
  sites: { token: 'rlstest0123456789012', name: 'rls-test' },
  reports: {
    site_id: '00000000-0000-4000-8000-000000000000',
    sub_id: '00000000-0000-4000-8000-000000000000',
    work_date: '2000-01-01',
    workers: 1,
    work_type: 'rls-test',
  },
  report_photos: { report_id: '00000000-0000-4000-8000-000000000000', object_key: 'rls-test' },
  paint_regions: {
    report_id: '00000000-0000-4000-8000-000000000000',
    polygon: [],
    area_m2: 0,
  },
}

let failed = 0

for (const table of TABLES) {
  // SELECT: 行が返らなければOK（RLSで全拒否されると空配列になる）
  const read = await supabase.from(table).select('*').limit(1)
  const readBlocked = read.error !== null || (read.data ?? []).length === 0
  report(`${table} SELECT`, readBlocked, read.error?.message ?? `${(read.data ?? []).length} 行返却`)

  // INSERT: エラーになればOK
  const write = await supabase.from(table).insert(SAMPLE_INSERT[table])
  report(`${table} INSERT`, write.error !== null, write.error?.message ?? '書き込めてしまいました')
}

function report(label, ok, detail) {
  if (ok) {
    console.log(`  OK   ${label.padEnd(26)} ${detail}`)
  } else {
    failed++
    console.log(`  NG   ${label.padEnd(26)} ${detail}`)
  }
}

console.log('')
if (failed > 0) {
  console.error(`${failed} 件のチェックに失敗しました。RLSポリシーを確認してください。`)
  process.exit(1)
}
console.log('anonキーでは全テーブルの読み書きが拒否されています（RLS OK）')
