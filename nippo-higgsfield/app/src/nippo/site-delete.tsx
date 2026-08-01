import * as React from 'react'
import { Button, Input, Label, Modal, ErrorBox } from './ui'
import { jfetch, formatNumber } from './utils'

type Counts = { reportCount: number; photoCount: number; assignmentCount: number }

/**
 * 現場を完全削除するダイアログ。
 * 取り違えると取り返しがつかないので、現場名を一字一句入力させてから消す。
 * 消える件数はダイアログ自身が取りに行くので、一覧からでも詳細からでも同じように使える。
 */
export function DeleteSiteModal({
  site,
  onClose,
  onDeleted,
}: {
  site: { id: string; name: string }
  onClose: () => void
  onDeleted: (name: string) => void
}) {
  const [typed, setTyped] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [counts, setCounts] = React.useState<Counts | null>(null)
  const matches = typed.trim() === site.name

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await jfetch<{
        reportCount: number
        photoCount: number
        assignments: unknown[]
      }>(`/api/admin/site?id=${encodeURIComponent(site.id)}`)
      if (cancelled || !res.ok) return
      setCounts({
        reportCount: res.data.reportCount,
        photoCount: res.data.photoCount,
        assignmentCount: res.data.assignments?.length ?? 0,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [site.id])

  async function remove() {
    setBusy(true)
    setError('')
    const res = await jfetch(
      `/api/admin/site?id=${encodeURIComponent(site.id)}&confirm=${encodeURIComponent(typed.trim())}`,
      { method: 'DELETE' },
    )
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    onDeleted(site.name)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="現場を完全に削除しますか?"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={() => void remove()} disabled={!matches || busy}>
            {busy ? '削除中…' : '完全に削除する'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">
            「{site.name}」の次のデータがすべて消えます。<b>元に戻せません。</b>
          </p>
          <ul className="ml-4 mt-2 list-disc space-y-0.5">
            <li>日報 {counts ? formatNumber(counts.reportCount) : '…'} 件（人数・作業内容・面積・備考）</li>
            <li>写真 {counts ? formatNumber(counts.photoCount) : '…'} 枚</li>
            <li>発行済みの日報URL・QR {counts ? counts.assignmentCount : '…'} 件</li>
            <li>図面と色塗り（進捗率）の記録</li>
          </ul>
        </div>
        <p className="text-sm text-slate-600">
          工事が終わっただけなら、削除ではなく「<b>現場を終了する</b>」をお使いください。
          終了なら日報は残したまま、URLだけ使えなくなります。
        </p>
        <div>
          <Label htmlFor="confirm-name">
            確認のため、現場名「<b className="text-slate-900">{site.name}</b>」を入力してください
          </Label>
          <Input
            id="confirm-name"
            className="mt-1"
            value={typed}
            autoComplete="off"
            placeholder={site.name}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  )
}
