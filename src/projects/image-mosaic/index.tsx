import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-mosaic',
  title: '馬賽克遮蔽',
  description: '在圖片上塗抹馬賽克區塊。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-mosaic') ?? fallback

type Stroke = { points: { x: number; y: number }[]; brush: number }

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [block, setBlock] = useLocalStorage('lab:image-mosaic:block', 16)
  const [brush, setBrush] = useLocalStorage('lab:image-mosaic:brush', 48)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const drawing = useRef(false)
  const strokeIdx = useRef(-1)
  const lastAdd = useRef(0)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const size = clamp(block, 4, 64)
    const cover = new Set<string>()
    for (const stroke of strokes) {
      const b = clamp(stroke.brush, 8, 200)
      for (const p of stroke.points) {
        const x0 = Math.max(0, Math.floor(p.x - b / 2))
        const y0 = Math.max(0, Math.floor(p.y - b / 2))
        const x1 = Math.min(src.width, Math.ceil(p.x + b / 2))
        const y1 = Math.min(src.height, Math.ceil(p.y + b / 2))
        for (let y = y0; y < y1; y += size) {
          for (let x = x0; x < x1; x += size) {
            const key = `${x},${y}`
            if (cover.has(key)) continue
            cover.add(key)
            const sw = Math.min(size, x1 - x)
            const sh = Math.min(size, y1 - y)
            const sample = ctx.getImageData(x, y, 1, 1).data
            ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`
            ctx.fillRect(x, y, sw, sh)
          }
        }
      }
    }
  }, [strokes, block])

  useEffect(() => {
    redraw()
  }, [redraw])

  function canvasPos(clientX: number, clientY: number) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * c.width,
      y: ((clientY - rect.top) / rect.height) * c.height,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = canvasPos(e.clientX, e.clientY)
    const stroke: Stroke = { points: [p], brush: clamp(brush, 8, 200) }
    setStrokes((prev) => {
      strokeIdx.current = prev.length
      return [...prev, stroke]
    })
    lastAdd.current = performance.now()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || strokeIdx.current < 0) return
    const now = performance.now()
    if (now - lastAdd.current < 28) return
    lastAdd.current = now
    const p = canvasPos(e.clientX, e.clientY)
    const idx = strokeIdx.current
    setStrokes((prev) => {
      const next = prev.slice()
      const cur = next[idx]
      if (!cur) return prev
      next[idx] = { ...cur, points: [...cur.points, p] }
      return next
    })
  }

  function onPointerUp() {
    drawing.current = false
    strokeIdx.current = -1
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setStrokes([])
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-mosaic.png`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
            復原
          </button>
          <button type="button" className="btn sm ghost" disabled={!strokes.length} onClick={() => setStrokes([])}>
            清除
          </button>
          <button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>
            下載 PNG
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>按住拖曳塗抹（支援觸控，已節流）；可復原筆劃。僅本機處理。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {strokes.length} 筆劃
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <label className="stack">
            <span className="label">筆刷 {brush}px</span>
            <input type="range" min={8} max={200} value={brush} onChange={(e) => setBrush(clamp(Number(e.target.value), 8, 200))} />
          </label>
          <label className="stack">
            <span className="label">馬賽克格 {block}px</span>
            <input type="range" min={4} max={64} value={block} onChange={(e) => setBlock(clamp(Number(e.target.value), 4, 64))} />
          </label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? (
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                border: '1px solid var(--line)',
                borderRadius: 12,
                cursor: 'crosshair',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>
              上傳後預覽
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
