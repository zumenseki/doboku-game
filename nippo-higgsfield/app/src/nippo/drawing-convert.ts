/**
 * 管理画面 (PC) 側での図面変換。
 * PDF → pdf.js で1ページ目をレンダリング / 画像 → 縮小、いずれもPNG化する。
 * 下請けのスマホでは pdf.js を読み込まず、このPNGだけを使う。
 */

const TARGET_WIDTH = 2000

export type ConvertedDrawing = { png: Blob; width: number; height: number }

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG変換に失敗しました')
  return blob
}

async function fromPdf(file: File): Promise<ConvertedDrawing> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(4, TARGET_WIDTH / base.width)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  void doc.destroy()

  return { png: await canvasToPng(canvas), width: canvas.width, height: canvas.height }
}

async function fromImage(file: File): Promise<ConvertedDrawing> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('画像を読み込めませんでした'))
      el.src = url
    })
    const scale = Math.min(1, TARGET_WIDTH / img.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { png: await canvasToPng(canvas), width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function convertDrawing(file: File): Promise<ConvertedDrawing> {
  if (file.type === 'application/pdf') return fromPdf(file)
  if (file.type.startsWith('image/')) return fromImage(file)
  throw new Error('PDFまたは画像ファイルを選択してください')
}
