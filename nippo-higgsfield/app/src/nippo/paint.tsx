import * as React from 'react'
import { Button } from './ui'
import { cn, formatNumber } from './utils'

/**
 * 図面色塗りキャンバス (スマホ前提・フルスクリーン)。
 * 1本指: 塗る / 2本指: 移動・拡大縮小。
 * 面積 = 塗られたピクセル数 × (縮尺m ÷ マスク幅px)^2 の概算。
 */

const MASK_MAX_WIDTH = 1400
const PAINT_COLOR = 'rgba(232, 51, 51, 1)'

type Stroke = { mode: 'draw' | 'erase'; size: number; points: { x: number; y: number }[] }
type View = { s: number; tx: number; ty: number }

export type PaintResult = { blob: Blob; areaM2: number; width: number; height: number }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

export function PaintScreen({
  drawingUrl,
  prevMaskUrls,
  scaleMPerUnit,
  onConfirm,
  onClose,
}: {
  drawingUrl: string
  prevMaskUrls: string[]
  scaleMPerUnit: number
  onConfirm: (result: PaintResult) => void
  onClose: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [tool, setTool] = React.useState<'draw' | 'erase'>('draw')
  const [brush, setBrush] = React.useState<'S' | 'M' | 'L'>('M')
  const [area, setArea] = React.useState(0)
  const [strokeCount, setStrokeCount] = React.useState(0)
  const [confirming, setConfirming] = React.useState(false)

  // 再レンダリング不要の描画状態は ref に持つ
  const stateRef = React.useRef<{
    drawing: HTMLImageElement | null
    prevMasks: HTMLImageElement[]
    mask: HTMLCanvasElement | null
    maskScale: number
    view: View
    strokes: Stroke[]
    current: Stroke | null
    pointers: Map<number, { x: number; y: number }>
    pinch: { dist: number; mid: { x: number; y: number }; view: View } | null
  }>({
    drawing: null,
    prevMasks: [],
    mask: null,
    maskScale: 1,
    view: { s: 1, tx: 0, ty: 0 },
    strokes: [],
    current: null,
    pointers: new Map(),
    pinch: null,
  })

  const brushPx = (b: 'S' | 'M' | 'L', imgW: number) =>
    ({ S: imgW / 60, M: imgW / 30, L: imgW / 15 })[b]

  const repaint = React.useCallback(() => {
    const canvas = canvasRef.current
    const st = stateRef.current
    if (!canvas || !st.drawing || !st.mask) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    const { s, tx, ty } = st.view
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(st.drawing, 0, 0)
    // 塗り済み (他日報) は薄く表示
    ctx.globalAlpha = 0.3
    for (const m of st.prevMasks) {
      ctx.drawImage(m, 0, 0, st.drawing.width, st.drawing.height)
    }
    // 今回の塗り
    ctx.globalAlpha = 0.45
    ctx.drawImage(st.mask, 0, 0, st.drawing.width, st.drawing.height)
    ctx.globalAlpha = 1
  }, [])

  // 初期化
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const drawing = await loadImage(drawingUrl)
        const prevMasks: HTMLImageElement[] = []
        for (const url of prevMaskUrls) {
          try {
            prevMasks.push(await loadImage(url))
          } catch {
            /* 個別のマスク読込失敗は無視 */
          }
        }
        if (cancelled) return
        const st = stateRef.current
        st.drawing = drawing
        st.prevMasks = prevMasks
        const maskW = Math.min(MASK_MAX_WIDTH, drawing.width)
        const mask = document.createElement('canvas')
        mask.width = maskW
        mask.height = Math.round((drawing.height / drawing.width) * maskW)
        st.mask = mask
        st.maskScale = maskW / drawing.width

        const wrap = wrapRef.current
        const canvas = canvasRef.current
        if (wrap && canvas) {
          const rect = wrap.getBoundingClientRect()
          const dpr = window.devicePixelRatio || 1
          canvas.width = Math.round(rect.width * dpr)
          canvas.height = Math.round(rect.height * dpr)
          canvas.style.width = `${rect.width}px`
          canvas.style.height = `${rect.height}px`
          const s = Math.min(rect.width / drawing.width, rect.height / drawing.height) * 0.98
          st.view = {
            s,
            tx: (rect.width - drawing.width * s) / 2,
            ty: (rect.height - drawing.height * s) / 2,
          }
        }
        setStatus('ready')
        requestAnimationFrame(repaint)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawingUrl, prevMaskUrls, repaint])

  function toImage(px: number, py: number): { x: number; y: number } {
    const { s, tx, ty } = stateRef.current.view
    return { x: (px - tx) / s, y: (py - ty) / s }
  }

  function drawSegment(stroke: Stroke, from: { x: number; y: number }, to: { x: number; y: number }) {
    const st = stateRef.current
    const ctx = st.mask?.getContext('2d')
    if (!ctx) return
    const k = st.maskScale
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = PAINT_COLOR
    ctx.lineWidth = stroke.size * k
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x * k, from.y * k)
    ctx.lineTo(to.x * k + 0.01, to.y * k + 0.01)
    ctx.stroke()
  }

  function replayStrokes() {
    const st = stateRef.current
    const ctx = st.mask?.getContext('2d')
    if (!ctx || !st.mask) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, st.mask.width, st.mask.height)
    for (const stroke of st.strokes) {
      for (let i = 0; i < stroke.points.length; i++) {
        drawSegment(stroke, stroke.points[Math.max(0, i - 1)], stroke.points[i])
      }
    }
  }

  const recomputeArea = React.useCallback(() => {
    const st = stateRef.current
    if (!st.mask) return
    const ctx = st.mask.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const data = ctx.getImageData(0, 0, st.mask.width, st.mask.height).data
    let count = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 96) count++
    }
    const mPerPx = scaleMPerUnit / st.mask.width
    setArea(count * mPerPx * mPerPx)
  }, [scaleMPerUnit])

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const st = stateRef.current
    if (status !== 'ready') return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    st.pointers.set(e.pointerId, p)

    if (st.pointers.size === 1 && st.drawing) {
      const stroke: Stroke = {
        mode: tool,
        size: brushPx(brush, st.drawing.width),
        points: [toImage(p.x, p.y)],
      }
      st.current = stroke
      st.strokes.push(stroke)
      drawSegment(stroke, stroke.points[0], stroke.points[0])
      requestAnimationFrame(repaint)
    } else if (st.pointers.size === 2) {
      // 2本指になったら描きかけの線は取り消してパン/ズームへ
      if (st.current) {
        st.strokes.pop()
        st.current = null
        replayStrokes()
      }
      const pts = [...st.pointers.values()]
      st.pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        view: { ...st.view },
      }
      requestAnimationFrame(repaint)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const st = stateRef.current
    if (!st.pointers.has(e.pointerId)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    st.pointers.set(e.pointerId, p)

    if (st.pointers.size === 1 && st.current) {
      const img = toImage(p.x, p.y)
      const last = st.current.points[st.current.points.length - 1]
      if (Math.hypot(img.x - last.x, img.y - last.y) < 1) return
      st.current.points.push(img)
      drawSegment(st.current, last, img)
      requestAnimationFrame(repaint)
    } else if (st.pointers.size === 2 && st.pinch) {
      const pts = [...st.pointers.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const base = st.pinch.view
      const factor = Math.min(8, Math.max(0.2, dist / Math.max(1, st.pinch.dist)))
      const s = base.s * factor
      // pinch中心を基準に拡大し、中点の移動分だけ平行移動
      st.view = {
        s,
        tx: mid.x - ((st.pinch.mid.x - base.tx) / base.s) * s,
        ty: mid.y - ((st.pinch.mid.y - base.ty) / base.s) * s,
      }
      requestAnimationFrame(repaint)
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const st = stateRef.current
    st.pointers.delete(e.pointerId)
    if (st.current && st.pointers.size === 0) {
      st.current = null
      setStrokeCount(st.strokes.length)
      recomputeArea()
    }
    if (st.pointers.size < 2) st.pinch = null
  }

  function undo() {
    const st = stateRef.current
    st.strokes.pop()
    replayStrokes()
    setStrokeCount(st.strokes.length)
    recomputeArea()
    requestAnimationFrame(repaint)
  }

  function clearAll() {
    const st = stateRef.current
    st.strokes = []
    replayStrokes()
    setStrokeCount(0)
    setArea(0)
    requestAnimationFrame(repaint)
  }

  function resetView() {
    const st = stateRef.current
    const wrap = wrapRef.current
    if (!st.drawing || !wrap) return
    const rect = wrap.getBoundingClientRect()
    const s = Math.min(rect.width / st.drawing.width, rect.height / st.drawing.height) * 0.98
    st.view = {
      s,
      tx: (rect.width - st.drawing.width * s) / 2,
      ty: (rect.height - st.drawing.height * s) / 2,
    }
    requestAnimationFrame(repaint)
  }

  async function confirm() {
    const st = stateRef.current
    if (!st.mask || strokeCount === 0) return
    setConfirming(true)
    const blob = await new Promise<Blob | null>((resolve) => st.mask!.toBlob(resolve, 'image/png'))
    setConfirming(false)
    if (!blob) return
    onConfirm({ blob, areaM2: Math.round(area * 10) / 10, width: st.mask.width, height: st.mask.height })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 text-white">
        <p className="mr-auto text-sm font-semibold">施工範囲を塗る</p>
        <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
          閉じる
        </button>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        {status === 'loading' && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            図面を読み込み中…
          </p>
        )}
        {status === 'error' && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-300">
            図面を読み込めませんでした。電波の良い場所でお試しください。
          </p>
        )}
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <p className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-[11px] text-white">
          1本指で塗る / 2本指で移動・拡大{stateRef.current.prevMasks.length > 0 && '（薄い赤=塗り済み）'}
        </p>
      </div>

      <div className="space-y-2 bg-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center gap-2">
          <ToolButton active={tool === 'draw'} onClick={() => setTool('draw')} label="ペン" />
          <ToolButton active={tool === 'erase'} onClick={() => setTool('erase')} label="消しゴム" />
          <span className="mx-1 h-6 w-px bg-slate-600" />
          {(['S', 'M', 'L'] as const).map((b) => (
            <ToolButton key={b} active={brush === b} onClick={() => setBrush(b)} label={b} narrow />
          ))}
          <span className="mx-1 h-6 w-px bg-slate-600" />
          <ToolButton onClick={undo} label="戻す" disabled={strokeCount === 0} />
          <ToolButton onClick={clearAll} label="全消し" disabled={strokeCount === 0} />
          <ToolButton onClick={resetView} label="全体表示" />
        </div>
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-white">
            <span className="text-xs text-slate-400">概算面積</span>{' '}
            <span className="text-xl font-bold tabular-nums">{formatNumber(area, 1)}</span>{' '}
            <span className="text-sm">m²</span>
          </p>
          <Button size="lg" disabled={strokeCount === 0 || confirming} onClick={() => void confirm()}>
            この面積を使う
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  disabled,
  narrow,
}: {
  active?: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  narrow?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg py-2 text-sm font-medium disabled:opacity-40',
        narrow ? 'px-3' : 'px-3.5',
        active ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-200',
      )}
    >
      {label}
    </button>
  )
}
