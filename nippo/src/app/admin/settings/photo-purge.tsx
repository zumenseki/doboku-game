'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { countOldPhotos, purgeOldPhotos } from './actions'
import { RETENTION_DAYS } from '@/lib/constants'

export function PhotoPurge() {
  const [pending, setPending] = React.useState(false)
  const [target, setTarget] = React.useState<{ siteCount: number; photoCount: number } | null>(null)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  async function check() {
    setPending(true)
    setError('')
    setMessage('')
    const res = await countOldPhotos()
    setPending(false)
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
    setPending(true)
    setError('')
    const res = await purgeOldPhotos()
    setPending(false)
    if (!res.ok) setError(res.message)
    else setMessage(`${res.data.deleted}枚の写真を削除しました`)
  }

  return (
    <div className="space-y-3">
      <Button variant="destructive" disabled={pending} onClick={check}>
        {pending ? '確認中…' : '削除対象を確認する'}
      </Button>

      {message && (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <ConfirmDialog
        open={target !== null}
        title="写真を一括削除しますか?"
        message={`終了から${RETENTION_DAYS}日を超えた ${target?.siteCount ?? 0} 現場、合計 ${target?.photoCount ?? 0} 枚の写真を削除します。この操作は取り消せません。`}
        confirmLabel="削除する"
        destructive
        onConfirm={purge}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
