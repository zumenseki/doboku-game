'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'nippo_install_dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * 「ホーム画面に追加」誘導バナー（§8）。
 * 一度閉じたら再表示しない（localStorage）。
 * Android/Chrome は beforeinstallprompt、iOS Safari は手順を案内する。
 */
export function InstallPrompt() {
  const [visible, setVisible] = React.useState(false)
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = React.useState(false)

  // Service Worker の登録（インストール可能条件を満たすため。キャッシュはしない）
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 失敗しても機能に影響しない */
      })
    }
  }, [])

  React.useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      return
    }
    if (isStandalone()) return

    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
    setIsIos(ios)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS には beforeinstallprompt がないため、少し遅らせて案内を出す
    const timer = ios ? window.setTimeout(() => setVisible(true), 3000) : undefined

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* noop */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-20 mx-auto max-w-md px-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-900">ホーム画面に追加すると便利です</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {isIos
            ? '画面下の「共有」→「ホーム画面に追加」でアプリのように開けます。'
            : '次回からワンタップでこの現場の日報を開けます。'}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={dismiss}>
            閉じる
          </Button>
          {!isIos && deferred && (
            <Button
              size="sm"
              onClick={async () => {
                await deferred.prompt()
                await deferred.userChoice.catch(() => null)
                dismiss()
              }}
            >
              追加する
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
