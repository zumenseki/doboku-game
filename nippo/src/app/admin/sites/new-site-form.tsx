'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { QrCode } from '@/components/qr-code'
import { CopyButton } from '@/components/copy-button'
import { createSite } from './actions'

/** 新規作成 → URLとQRを即時表示（§6） */
export function NewSiteForm({ appUrl }: { appUrl: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState('')
  const [created, setCreated] = React.useState<{ id: string; token: string; name: string } | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const url = created ? `${base}/r/${created.token}` : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>現場を新規作成</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <form
          ref={formRef}
          action={(fd) => {
            setError('')
            const name = String(fd.get('name') ?? '')
            startTransition(async () => {
              const res = await createSite(fd)
              if (!res.ok) {
                setError(res.message)
                return
              }
              setCreated({ id: res.data!.id, token: res.data!.token, name })
              formRef.current?.reset()
              router.refresh()
            })
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <Label htmlFor="site-name">現場名</Label>
            <Input id="site-name" name="name" required maxLength={120} className="mt-1" />
          </div>
          <div className="min-w-56 flex-1">
            <Label htmlFor="site-address">住所（任意）</Label>
            <Input id="site-address" name="address" maxLength={200} className="mt-1" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? '作成中…' : '作成してQRを表示'}
          </Button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {created && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              「{created.name}」を作成しました。下のURL/QRを業者に配布してください。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="rounded-lg bg-white p-2">
                <QrCode value={url} size={160} />
              </div>
              <div className="min-w-64 flex-1 space-y-2">
                <code className="block break-all rounded bg-white px-2 py-1.5 text-xs text-slate-800">
                  {url}
                </code>
                <div className="flex flex-wrap gap-2">
                  <CopyButton size="sm" variant="outline" text={url}>
                    URLをコピー
                  </CopyButton>
                  <Link href={`/admin/sites/${created.id}/print`} target="_blank">
                    <Button size="sm" variant="outline">
                      A6印刷ビュー
                    </Button>
                  </Link>
                  <Link href={`/admin/sites/${created.id}`}>
                    <Button size="sm" variant="ghost">
                      現場の詳細へ
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
