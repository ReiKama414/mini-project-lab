import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-cropper',
  title: '圖片裁切',
  description: '自由框選裁切並下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-cropper') ?? fallback

export default function Page() {
  const viewRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)
  const { imgRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageFile()
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })

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
  }, [crop, imgRef])

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

  async function handleFile(file: File | null) {
    if (!(await onFile(file))) return
    const img = imgRef.current
    if (!img) return
    const w = Math.round(img.naturalWidth * 0.7)
    const h = Math.round(img.naturalHeight * 0.7)
    setCrop({
      x: Math.round((img.naturalWidth - w) / 2),
      y: Math.round((img.naturalHeight - h) / 2),
      w,
      h,
    })
  }

  function download() {
    const img = imgRef.current
    if (!img || !hasImage) return
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(crop.w))
    out.height = Math.max(1, Math.round(crop.h))
    out.getContext('2d')!.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height)
    downloadCanvas(out, `${imageBaseName(fileName)}-crop.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="拖曳裁切框（支援觸控），或用滑桿調整位置與大小。無法還原；僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      outWidth={crop.w}
      outHeight={crop.h}
      error={error}
      hasImage={hasImage}
      onFile={(f) => void handleFile(f)}
      onDownload={download}
      downloadLabel="下載裁切"
      infoExtra={[
        {
          label: '裁切區域',
          value: hasImage ? `${crop.x}, ${crop.y} · ${crop.w}×${crop.h}` : '—',
        },
      ]}
      preview={
        hasImage ? (
          <div className="iw-canvas-wrap">
            <canvas
              ref={viewRef}
              className="iw-canvas"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        ) : (
          <div className="iw-empty">上傳後預覽</div>
        )
      }
      controls={
        hasImage && width > 0 ? (
          <>
            <label className="stack">
              <span className="label">X {crop.x}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, width - crop.w)}
                value={crop.x}
                onChange={(e) => setCrop((c) => ({ ...c, x: clamp(Number(e.target.value), 0, width - c.w) }))}
              />
            </label>
            <label className="stack">
              <span className="label">Y {crop.y}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, height - crop.h)}
                value={crop.y}
                onChange={(e) => setCrop((c) => ({ ...c, y: clamp(Number(e.target.value), 0, height - c.h) }))}
              />
            </label>
            <label className="stack">
              <span className="label">寬 {crop.w}</span>
              <input
                type="range"
                min={20}
                max={width}
                value={crop.w}
                onChange={(e) =>
                  setCrop((c) => {
                    const w = clamp(Number(e.target.value), 20, width)
                    return { ...c, w, x: clamp(c.x, 0, width - w) }
                  })
                }
              />
            </label>
            <label className="stack">
              <span className="label">高 {crop.h}</span>
              <input
                type="range"
                min={20}
                max={height}
                value={crop.h}
                onChange={(e) =>
                  setCrop((c) => {
                    const h = clamp(Number(e.target.value), 20, height)
                    return { ...c, h, y: clamp(c.y, 0, height - h) }
                  })
                }
              />
            </label>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            上傳圖片後可調整裁切框
          </p>
        )
      }
    />
  )
}
