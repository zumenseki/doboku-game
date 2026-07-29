import * as React from 'react'

/**
 * URLからQRコード画像を生成して表示する。
 * `qrcode` パッケージはクライアント側でのみ動的importする (SSR安全)。
 */
export function QrCode({
  value,
  size = 220,
  className,
}: {
  value: string
  size?: number
  className?: string
}) {
  const [src, setSrc] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
      )
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
  return <img src={src} alt="現場QRコード" width={size} height={size} className={className} />
}
