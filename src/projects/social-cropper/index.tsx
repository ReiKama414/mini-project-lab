import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'social-cropper',
  title: '社群裁切',
  description: '依常見社群比例裁切封面圖。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('social-cropper') ?? fallback

const PRESETS: { id: string; label: string; ratio: number }[] = [
  { id: 'ig-sq', label: 'IG 方圖 1:1', ratio: 1 },
  { id: 'ig-port', label: 'IG 直式 4:5', ratio: 4 / 5 },
  { id: 'ig-story', label: '限時動態 9:16', ratio: 9 / 16 },
  { id: 'fb-cover', label: 'FB 封面 16:9', ratio: 16 / 9 },
  { id: 'yt', label: 'YouTube 縮圖 16:9', ratio: 16 / 9 },
  { id: 'li', label: 'LinkedIn 1.91:1', ratio: 1.91 },
  { id: 'x', label: 'X 貼文 16:9', ratio: 16 / 9 },
]

export default function Page() {
  const viewRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [preset, setPreset] = useLocalStorage('lab:social-cropper:preset', 'ig-sq')
  const [offsetX, setOffsetX] = useState(0.5)
  const [offsetY, setOffsetY] = useState(0.5)

  const ratio = PRESETS.find((p) => p.id === preset)?.ratio ?? 1

  function cropRect(iw: number, ih: number) {
    let cw: number, ch: number
    if (iw / ih > ratio) {
      ch = ih
      cw = ih * ratio
    } else {
      cw = iw
      ch = iw / ratio
    }
    const maxX = Math.max(0, iw - cw)
    const maxY = Math.max(0, ih - ch)
    return {
      x: maxX * clamp(offsetX, 0, 1),
      y: maxY * clamp(offsetY, 0, 1),
      w: cw,
      h: ch,
      maxX,
      maxY,
    }
  }

  const redraw = useCallback(() => {
    const img = imgRef.current
    const c = viewRef.current
    if (!img || !c) return
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const r = cropRect(c.width, c.height)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.clearRect(r.x, r.y, r.w, r.h)
    ctx.drawImage(img, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
    ctx.strokeStyle = '#e9a319'
    ctx.lineWidth = Math.max(2, Math.round(Math.min(c.width, c.height) / 400))
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  }, [offsetX, offsetY, ratio])

  useEffect(() => {
    redraw()
  }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setOffsetX(0.5)
      setOffsetY(0.5)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function clientToCanvas(clientX: number, clientY: number) {
    const c = viewRef.current
    if (!c) return { x: 0, y: 0 }
    const rect = c.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * c.width,
      y: ((clientY - rect.top) / rect.height) * c.height,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!hasImage) return
    const p = clientToCanvas(e.clientX, e.clientY)
    dragRef.current = { x: p.x, y: p.y, ox: offsetX, oy: offsetY }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    const img = imgRef.current
    if (!drag || !img) return
    const p = clientToCanvas(e.clientX, e.clientY)
    const r = cropRect(img.naturalWidth, img.naturalHeight)
    if (r.maxX > 0) setOffsetX(clamp(drag.ox + (p.x - drag.x) / r.maxX, 0, 1))
    if (r.maxY > 0) setOffsetY(clamp(drag.oy + (p.y - drag.y) / r.maxY, 0, 1))
  }

  function onPointerUp() {
    dragRef.current = null
  }

  function download() {
    const img = imgRef.current
    if (!img || !hasImage) return
    const r = cropRect(img.naturalWidth, img.naturalHeight)
    const out = document.createElement('canvas')
    out.width = Math.round(r.w)
    out.height = Math.round(r.h)
    out.getContext('2d')!.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, out.width, out.height)
    const name = PRESETS.find((p) => p.id === preset)?.id || 'social'
    downloadCanvas(out, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-${name}.png`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>
          下載裁切
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>依社群比例裁切；可拖曳預覽或用滑桿分別調整水平／垂直位置。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <div className="label">比例預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={`btn sm ${preset === p.id ? 'accent' : 'ghost'}`} onClick={() => setPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="stack">
            <span className="label">水平位置</span>
            <input type="range" min={0} max={100} value={Math.round(offsetX * 100)} onChange={(e) => setOffsetX(clamp(Number(e.target.value) / 100, 0, 1))} />
          </label>
          <label className="stack">
            <span className="label">垂直位置</span>
            <input type="range" min={0} max={100} value={Math.round(offsetY * 100)} onChange={(e) => setOffsetY(clamp(Number(e.target.value) / 100, 0, 1))} />
          </label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽（可拖曳）</div>
          {hasImage ? (
            <canvas
              ref={viewRef}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)', cursor: 'grab', touchAction: 'none' }}
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
