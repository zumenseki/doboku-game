/**
 * 写真のクライアント圧縮 (依存ライブラリなし)。
 * 長辺1600px / WebP quality 0.75。WebPエンコード非対応ブラウザ(iOS Safariの一部)は
 * JPEG 0.75 にフォールバックする。
 */

const MAX_EDGE = 1600
const QUALITY = 0.75

async function loadBitmap(file: File): Promise<{ draw: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  try {
    const bitmap = await createImageBitmap(file)
    return { draw: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() }
  } catch {
    // createImageBitmapが対応しない形式は <img> 経由でデコード
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('decode failed'))
        el.src = url
      })
      return {
        draw: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      }
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressPhoto(file: File): Promise<File> {
  const { draw, width, height, cleanup } = await loadBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.drawImage(draw, 0, 0, w, h)

    let blob = await toBlob(canvas, 'image/webp', QUALITY)
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', QUALITY)
    }
    if (!blob) throw new Error('encode failed')
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `photo.${ext}`, { type: blob.type })
  } finally {
    cleanup()
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
