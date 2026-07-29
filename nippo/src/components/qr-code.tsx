'use client'
import * as React from 'react'
import QRCode from 'qrcode'

/** URLからQRコード画像（data URL）を生成して表示する */
export function QrCode({ value, size = 220, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => setSrc(''))
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return <div style={{ width: size, height: size }} className={className} aria-hidden />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="現場QRコード" width={size} height={size} className={className} />
}
