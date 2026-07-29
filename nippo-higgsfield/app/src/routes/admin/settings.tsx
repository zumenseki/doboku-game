import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, ErrorBox, SuccessBox } from '../../nippo/ui'
import { jfetch } from '../../nippo/utils'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const [busy, setBusy] = React.useState(false)
  const [target, setTarget] = React.useState<{ siteCount: number; photoCount: number; retentionDays: number } | null>(
    null,
  )
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  async function check() {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await jfetch<{ siteCount: number; photoCount: number; retentionDays: number }>('/api/admin/purge')
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    if (res.data.photoCount === 0) {
      setMessage('削除対象の写真はありません')
      return
    }
    setTarget(res.data)
  }

  async function purge() {
    setTarget(null)
    setBusy(true)
    setError('')
    const res = await jfetch<{ deleted: number }>('/api/admin/purge', { method: 'POST' })
    setBusy(false)
    if (!res.ok) setError(res.message)
    else setMessage(`${res.data.deleted}枚の写真を削除しました`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>古い写真の一括削除</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            終了から180日を超えた現場の写真をストレージから削除します。
            日報のデータ（人数・作業内容・面積・備考）は残るため、集計やCSVには影響しません。
            <br />
            ストレージ容量が逼迫してきたら実行してください。
          </p>
          <Button variant="destructive" disabled={busy} onClick={check}>
            {busy ? '確認中…' : '削除対象を確認する'}
          </Button>
          <SuccessBox>{message}</SuccessBox>
          <ErrorBox>{error}</ErrorBox>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>管理者パスワード</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">
            管理者パスワードの変更はサイトのシークレット設定 (ADMIN_PASSWORD) で行います。
            変更が必要な場合は開発担当者にご連絡ください。
          </p>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={target !== null}
        title="写真を一括削除しますか?"
        message={`終了から${target?.retentionDays ?? 180}日を超えた ${target?.siteCount ?? 0} 現場、合計 ${target?.photoCount ?? 0} 枚の写真を削除します。この操作は取り消せません。`}
        confirmLabel="削除する"
        destructive
        onConfirm={() => void purge()}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
