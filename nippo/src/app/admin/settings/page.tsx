import { PhotoPurge } from './photo-purge'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { RETENTION_DAYS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>古い写真の一括削除</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            終了から{RETENTION_DAYS}日を超えた現場の写真をストレージから削除します。
            日報のデータ（人数・作業内容・面積・備考）は残るため、集計やCSVには影響しません。
            <br />
            無料枠のストレージ容量が逼迫してきたら実行してください。
          </p>
          <PhotoPurge />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>管理者アカウント</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">
            管理者の追加・パスワード変更は Supabase ダッシュボードの Authentication &gt; Users
            から行ってください。
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
