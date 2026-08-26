import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-cropper',
  title: '圖片裁切',
  description: '自由框選裁切並下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-cropper') ?? fallback

export default function Page() {
  const viewRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [dims, setDims] = useState({ w: 0, h: 0 })

  const redraw = useCallback(() => {
    const img = imgRef.current
    const c = viewRef.current
    if (!img || !c) return
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, c.width, c.height)
    const { x, y, w, h } = crop
    ctx.clearRect(x, y, w, h)
    ctx.drawImage(img, x, y, w, h, x, y, w, h)
    ctx.strokeStyle = '#2a9d8f'
    ctx.lineWidth = Math.max(2, Math.round(c.width / 400))
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }, [crop])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function clientToCanvas(clientX: number, clientY: number) {
    const c = viewRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return {
      x: ((clientX - r.left) / r.width) * c.width,
      y: ((clientY - r.top) / r.height) * c.height,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    const p = clientToCanvas(e.clientX, e.clientY)
    drag.current = { mx: p.x, my: p.y, cx: crop.x, cy: crop.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !imgRef.current) return
    const p = clientToCanvas(e.clientX, e.clientY)
    const dx = p.x - drag.current.mx
    const dy = p.y - drag.current.my
    setCrop((c) => ({
      ...c,
      x: clamp(Math.round(drag.current!.cx + dx), 0, imgRef.current!.naturalWidth - c.w),
      y: clamp(Math.round(drag.current!.cy + dy), 0, imgRef.current!.naturalHeight - c.h),
    }))
  }

  function onPointerUp() {
    drag.current = null
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      imgRef.current = img
      const w = Math.round(img.naturalWidth * 0.7)
      const h = Math.round(img.naturalHeight * 0.7)
      setDims({ w: img.naturalWidth, h: img.naturalHeight })
      setCrop({
        x: Math.round((img.naturalWidth - w) / 2),
        y: Math.round((img.naturalHeight - h) / 2),
        w,
        h,
      })
      setFileName(file.name)
      setFileSize(file.size)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    const img = imgRef.current
    if (!img || !hasImage) return
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(crop.w))
    out.height = Math.max(1, Math.round(crop.h))
    out.getContext('2d')!.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height)
    downloadCanvas(out, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-crop.png`)
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
      <p className="muted" style={{ marginBottom: 12 }}>
        拖曳裁切框（支援觸控），或用滑桿調整位置與大小。無法還原。僅本機處理，不會上傳。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <FileDrop
            accept={IMAGE_ACCEPT}
            maxBytes={IMAGE_MAX_BYTES}
            label="拖放圖片到此，或點擊選擇"
            hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
            onFiles={(files) => void onFile(files[0] ?? null)}
          />
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)}
              {dims.w ? ` · ${dims.w}×${dims.h}` : ''}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          {hasImage && dims.w > 0 && (
            <>
              <label className="stack">
                <span className="label">X {crop.x}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, dims.w - crop.w)}
                  value={crop.x}
                  onChange={(e) => setCrop((c) => ({ ...c, x: clamp(Number(e.target.value), 0, dims.w - c.w) }))}
                />
              </label>
              <label className="stack">
                <span className="label">Y {crop.y}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, dims.h - crop.h)}
                  value={crop.y}
                  onChange={(e) => setCrop((c) => ({ ...c, y: clamp(Number(e.target.value), 0, dims.h - c.h) }))}
                />
              </label>
              <label className="stack">
                <span className="label">寬 {crop.w}</span>
                <input
                  type="range"
                  min={20}
                  max={dims.w}
                  value={crop.w}
                  onChange={(e) =>
                    setCrop((c) => {
                      const w = clamp(Number(e.target.value), 20, dims.w)
                      return { ...c, w, x: clamp(c.x, 0, dims.w - w) }
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="label">高 {crop.h}</span>
                <input
                  type="range"
                  min={20}
                  max={dims.h}
                  value={crop.h}
                  onChange={(e) =>
                    setCrop((c) => {
                      const h = clamp(Number(e.target.value), 20, dims.h)
                      return { ...c, h, y: clamp(c.y, 0, dims.h - h) }
                    })
                  }
                />
              </label>
            </>
          )}
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽（可拖曳）</div>
          {hasImage ? (
            <canvas
              ref={viewRef}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                borderRadius: 12,
                border: '1px solid var(--line)',
                cursor: 'grab',
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