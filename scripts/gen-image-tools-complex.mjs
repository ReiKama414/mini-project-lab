/**
 * Complex image tools
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectsDir = path.join(root, 'src', 'projects')

function write(slug, content) {
  const dir = path.join(projectsDir, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.tsx'), content.trimStart())
  console.log('wrote', slug)
}

write('image-mosaic', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = { slug: 'image-mosaic', title: '馬賽克遮蔽', description: '在圖片上塗抹馬賽克區塊。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('image-mosaic') ?? fallback

type Rect = { x: number; y: number; w: number; h: number }

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [block, setBlock] = useLocalStorage('lab:image-mosaic:block', 16)
  const [brush, setBrush] = useLocalStorage('lab:image-mosaic:brush', 48)
  const [rects, setRects] = useState<Rect[]>([])
  const drawing = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const size = clamp(block, 4, 64)
    for (const r of rects) {
      const x0 = Math.max(0, Math.floor(r.x))
      const y0 = Math.max(0, Math.floor(r.y))
      const x1 = Math.min(src.width, Math.ceil(r.x + r.w))
      const y1 = Math.min(src.height, Math.ceil(r.y + r.h))
      for (let y = y0; y < y1; y += size) {
        for (let x = x0; x < x1; x += size) {
          const sw = Math.min(size, x1 - x)
          const sh = Math.min(size, y1 - y)
          const sample = ctx.getImageData(x, y, 1, 1).data
          ctx.fillStyle = \`rgb(\${sample[0]},\${sample[1]},\${sample[2]})\`
          ctx.fillRect(x, y, sw, sh)
        }
      }
    }
  }, [rects, block])

  useEffect(() => { redraw() }, [redraw])

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const sx = c.width / rect.width
    const sy = c.height / rect.height
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    drawing.current = true
    start.current = canvasPos(e)
  }
  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current || !start.current) return
    const p = canvasPos(e)
    const b = clamp(brush, 8, 200)
    setRects((prev) => [...prev, { x: p.x - b / 2, y: p.y - b / 2, w: b, h: b }])
  }
  function onUp() {
    drawing.current = false
    start.current = null
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setRects([])
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-mosaic.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<div className="row"><button type="button" className="btn sm ghost" disabled={!rects.length} onClick={() => setRects([])}>清除馬賽克</button><button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button></div>}>
      <p className="muted" style={{ marginBottom: 12 }}>在預覽上拖曳塗抹馬賽克，僅本機處理。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">筆刷 {brush}px</span><input type="range" min={8} max={200} value={brush} onChange={(e) => setBrush(clamp(Number(e.target.value), 8, 200))} /></label>
          <label className="stack"><span className="label">馬賽克格 {block}px</span><input type="range" min={4} max={64} value={block} onChange={(e) => setBlock(clamp(Number(e.target.value), 4, 64))} /></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽（按住拖曳塗抹）</div>
          {hasImage ? (
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid var(--line)', borderRadius: 12, cursor: 'crosshair', touchAction: 'none' }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} />
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-cropper', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = { slug: 'image-cropper', title: '圖片裁切', description: '自由裁切圖片區域並下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('image-cropper') ?? fallback

export default function Page() {
  const viewRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const drag = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)

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

  useEffect(() => { redraw() }, [redraw])

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = viewRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      imgRef.current = img
      const w = Math.round(img.naturalWidth * 0.7)
      const h = Math.round(img.naturalHeight * 0.7)
      setCrop({ x: Math.round((img.naturalWidth - w) / 2), y: Math.round((img.naturalHeight - h) / 2), w, h })
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    const img = imgRef.current
    if (!img || !hasImage) return
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(crop.w))
    out.height = Math.max(1, Math.round(crop.h))
    out.getContext('2d')!.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height)
    downloadCanvas(out, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-crop.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載裁切</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>拖曳選取框移動，使用滑桿調整大小。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          {hasImage && imgRef.current && (
            <>
              <label className="stack"><span className="label">X {crop.x}</span><input type="range" min={0} max={Math.max(0, imgRef.current.naturalWidth - crop.w)} value={crop.x} onChange={(e) => setCrop((c) => ({ ...c, x: clamp(Number(e.target.value), 0, imgRef.current!.naturalWidth - c.w) }))} /></label>
              <label className="stack"><span className="label">Y {crop.y}</span><input type="range" min={0} max={Math.max(0, imgRef.current.naturalHeight - crop.h)} value={crop.y} onChange={(e) => setCrop((c) => ({ ...c, y: clamp(Number(e.target.value), 0, imgRef.current!.naturalHeight - c.h) }))} /></label>
              <label className="stack"><span className="label">寬 {crop.w}</span><input type="range" min={20} max={imgRef.current.naturalWidth} value={crop.w} onChange={(e) => setCrop((c) => { const w = clamp(Number(e.target.value), 20, imgRef.current!.naturalWidth); return { ...c, w, x: clamp(c.x, 0, imgRef.current!.naturalWidth - w) } })} /></label>
              <label className="stack"><span className="label">高 {crop.h}</span><input type="range" min={20} max={imgRef.current.naturalHeight} value={crop.h} onChange={(e) => setCrop((c) => { const h = clamp(Number(e.target.value), 20, imgRef.current!.naturalHeight); return { ...c, h, y: clamp(c.y, 0, imgRef.current!.naturalHeight - h) } })} /></label>
            </>
          )}
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽（拖曳移動選取框）</div>
          {hasImage ? (
            <canvas
              ref={viewRef}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)', cursor: 'move' }}
              onMouseDown={(e) => { const p = pos(e); drag.current = { mx: p.x, my: p.y, cx: crop.x, cy: crop.y } }}
              onMouseMove={(e) => {
                if (!drag.current || !imgRef.current) return
                const p = pos(e)
                const dx = p.x - drag.current.mx
                const dy = p.y - drag.current.my
                setCrop((c) => ({
                  ...c,
                  x: clamp(Math.round(drag.current!.cx + dx), 0, imgRef.current!.naturalWidth - c.w),
                  y: clamp(Math.round(drag.current!.cy + dy), 0, imgRef.current!.naturalHeight - c.h),
                }))
              }}
              onMouseUp={() => { drag.current = null }}
              onMouseLeave={() => { drag.current = null }}
            />
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('social-cropper', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = { slug: 'social-cropper', title: '社群裁切', description: '依常見社群比例裁切封面圖。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
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
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [preset, setPreset] = useLocalStorage('lab:social-cropper:preset', 'ig-sq')
  const [offset, setOffset] = useState(0.5)

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
    const maxX = iw - cw
    const maxY = ih - ch
    const t = clamp(offset, 0, 1)
    return { x: maxX * t, y: maxY * t, w: cw, h: ch }
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
    ctx.lineWidth = 3
    ctx.strokeRect(r.x, r.y, r.w, r.h)
  }, [offset, ratio])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setOffset(0.5)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
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
    downloadCanvas(out, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-\${name}.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載裁切</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>依社群比例置中裁切，可用滑桿微調位置。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="label">比例預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={\`btn sm \${preset === p.id ? 'accent' : 'ghost'}\`} onClick={() => setPreset(p.id)}>{p.label}</button>
            ))}
          </div>
          <label className="stack"><span className="label">位置偏移</span><input type="range" min={0} max={100} value={Math.round(offset * 100)} onChange={(e) => setOffset(clamp(Number(e.target.value) / 100, 0, 1))} /></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? <canvas ref={viewRef} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('exif-cleaner', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, copyText } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import exifr from 'exifr'

const fallback: ProjectMeta = { slug: 'exif-cleaner', title: 'EXIF 清除器', description: '檢視並清除圖片 EXIF 後重新匯出。', tier: 'feature', effort: '1～3 天', tags: ['utility', 'security'] }
const meta = getProject('exif-cleaner') ?? fallback

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [exif, setExif] = useState<Record<string, unknown> | null>(null)
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null)
  const [origSize, setOrigSize] = useState(0)

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      setOrigSize(file.size)
      setFileName(file.name)
      const data = await exifr.parse(file).catch(() => null)
      setExif(data && typeof data === 'object' ? (data as Record<string, unknown>) : null)
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('匯出失敗')
      setCleanBlob(blob)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(blob))
    } catch {
      setError('無法處理圖片')
      setCleanBlob(null)
    }
  }

  const entries = exif ? Object.entries(exif).slice(0, 40) : []

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!cleanBlob} onClick={() => cleanBlob && downloadBlob(cleanBlob, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-no-exif.jpg\`)}>
          下載已清除
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>透過重繪 Canvas 去除 EXIF／GPS 等中繼資料，僅本機處理。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName} · {formatBytes(origSize)}{cleanBlob ? \` → \${formatBytes(cleanBlob.size)}\` : ''}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="label">偵測到的 EXIF</div>
          {entries.length ? (
            <div className="stack" style={{ maxHeight: 320, overflow: 'auto', fontSize: 13 }}>
              {entries.map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="muted">{k}</span>
                  <span className="mono" style={{ textAlign: 'right', wordBreak: 'break-all' }}>{String(v)}</span>
                </div>
              ))}
              <button type="button" className="btn sm ghost" onClick={() => void copyText(JSON.stringify(exif, null, 2))}>複製 JSON</button>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{fileName ? '未偵測到 EXIF 或已為乾淨圖' : '上傳後顯示'}</p>
          )}
          <button type="button" className="btn accent" disabled={!cleanBlob} onClick={() => cleanBlob && downloadBlob(cleanBlob, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-no-exif.jpg\`)}>下載無 EXIF JPG</button>
        </div>
        <div className="panel stack">
          <div className="label">清除後預覽</div>
          {preview ? <img src={preview} alt="preview" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

console.log('complex A done')
