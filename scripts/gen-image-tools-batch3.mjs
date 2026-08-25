/**
 * Image tools batch 3: border, rounded, shadow, resizer, converter, compressor, mosaic, cropper, etc.
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

const head = (slug, title, description, extraImports = '') => `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import {
  loadImageFromFile,
  canvasFromImage,
  downloadCanvas,
  downloadBlob,
  mapPixels,
  clampByte,
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
} from '../../lib/imageCanvas'
${extraImports}
const fallback: ProjectMeta = {
  slug: '${slug}',
  title: '${title}',
  description: '${description}',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('${slug}') ?? fallback`

write('image-border', `${head('image-border', '圖片加邊框', '為圖片加上自訂顏色與寬度邊框。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [width, setWidth] = useLocalStorage('lab:image-border:width', 24)
  const [color, setColor] = useLocalStorage('lab:image-border:color', '#1a2e28')

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const b = clamp(width, 0, 200)
    out.width = img.naturalWidth + b * 2
    out.height = img.naturalHeight + b * 2
    const ctx = out.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(img, b, b)
  }, [width, color])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-border.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機加邊框，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">邊框寬度 {width}px</span><input type="range" min={0} max={200} value={width} onChange={(e) => setWidth(clamp(Number(e.target.value), 0, 200))} /></label>
          <label className="stack"><span className="label">邊框顏色</span><div className="row"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><input className="field mono" style={{ width: 120 }} value={color} maxLength={7} onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value) }} /></div></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560 }}><canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} /></div> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-rounded', `${head('image-rounded', '圖片圓角', '為圖片加上圓角並輸出 PNG。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [radius, setRadius] = useLocalStorage('lab:image-rounded:radius', 48)

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const w = img.naturalWidth
    const h = img.naturalHeight
    out.width = w
    out.height = h
    const r = clamp(radius, 0, Math.min(w, h) / 2)
    const ctx = out.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.arcTo(w, 0, w, h, r)
    ctx.arcTo(w, h, 0, h, r)
    ctx.arcTo(0, h, 0, 0, r)
    ctx.arcTo(0, 0, w, 0, r)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, 0, 0)
  }, [radius])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-rounded.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>圓角會輸出透明 PNG 背景。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">圓角 {radius}px</span><input type="range" min={0} max={300} value={radius} onChange={(e) => setRadius(clamp(Number(e.target.value), 0, 300))} /></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560, background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px' }}><canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} /></div> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-shadow', `${head('image-shadow', '圖片加陰影', '為圖片加上陰影效果。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [blur, setBlur] = useLocalStorage('lab:image-shadow:blur', 24)
  const [offsetX, setOffsetX] = useLocalStorage('lab:image-shadow:ox', 12)
  const [offsetY, setOffsetY] = useLocalStorage('lab:image-shadow:oy', 12)
  const [pad, setPad] = useLocalStorage('lab:image-shadow:pad', 40)

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const p = clamp(pad, 0, 120)
    out.width = img.naturalWidth + p * 2
    out.height = img.naturalHeight + p * 2
    const ctx = out.getContext('2d')!
    ctx.clearRect(0, 0, out.width, out.height)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = clamp(blur, 0, 80)
    ctx.shadowOffsetX = clamp(offsetX, -60, 60)
    ctx.shadowOffsetY = clamp(offsetY, -60, 60)
    ctx.drawImage(img, p, p)
  }, [blur, offsetX, offsetY, pad])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-shadow.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機陰影合成，輸出透明 PNG。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">模糊 {blur}px</span><input type="range" min={0} max={80} value={blur} onChange={(e) => setBlur(clamp(Number(e.target.value), 0, 80))} /></label>
          <label className="stack"><span className="label">X 偏移 {offsetX}px</span><input type="range" min={-60} max={60} value={offsetX} onChange={(e) => setOffsetX(clamp(Number(e.target.value), -60, 60))} /></label>
          <label className="stack"><span className="label">Y 偏移 {offsetY}px</span><input type="range" min={-60} max={60} value={offsetY} onChange={(e) => setOffsetY(clamp(Number(e.target.value), -60, 60))} /></label>
          <label className="stack"><span className="label">邊距 {pad}px</span><input type="range" min={0} max={120} value={pad} onChange={(e) => setPad(clamp(Number(e.target.value), 0, 120))} /></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560, background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px' }}><canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} /></div> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-resizer', `${head('image-resizer', '圖片縮放', '依寬高或比例縮放圖片。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [keepRatio, setKeepRatio] = useLocalStorage('lab:image-resizer:ratio', true)
  const [orig, setOrig] = useState({ w: 0, h: 0 })

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const w = clamp(width, 1, 8000)
    const h = clamp(height, 1, 8000)
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
  }, [width, height])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      imgRef.current = img
      setOrig({ w: img.naturalWidth, h: img.naturalHeight })
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function setW(v: number) {
    const w = clamp(v, 1, 8000)
    setWidth(w)
    if (keepRatio && orig.w) setHeight(Math.max(1, Math.round((w * orig.h) / orig.w)))
  }
  function setH(v: number) {
    const h = clamp(v, 1, 8000)
    setHeight(h)
    if (keepRatio && orig.h) setWidth(Math.max(1, Math.round((h * orig.w) / orig.h)))
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-resized.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機縮放，單邊上限 8000px。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {orig.w > 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>原始：{orig.w} × {orig.h}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="check"><input type="checkbox" checked={keepRatio} onChange={() => setKeepRatio(!keepRatio)} />鎖定比例</label>
          <div className="grid-2">
            <label className="stack"><span className="label">寬度</span><input className="field" type="number" min={1} max={8000} value={width} onChange={(e) => setW(Number(e.target.value) || 1)} /></label>
            <label className="stack"><span className="label">高度</span><input className="field" type="number" min={1} max={8000} value={height} onChange={(e) => setH(Number(e.target.value) || 1)} /></label>
          </div>
          <div className="row">
            {[25, 50, 75, 100, 150].map((p) => (
              <button key={p} type="button" className="btn sm ghost" disabled={!orig.w} onClick={() => { setW(Math.max(1, Math.round(orig.w * p / 100))); if (!keepRatio) setHeight(Math.max(1, Math.round(orig.h * p / 100))) }}>{p}%</button>
            ))}
          </div>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽（{width} × {height}）</div>
          {hasImage ? <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560 }}><canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} /></div> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-converter', `${head('image-converter', '圖片格式轉換', '在 JPG／PNG／WebP 之間轉換。')}

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [fmt, setFmt] = useLocalStorage<Fmt>('lab:image-converter:fmt', 'image/png')
  const [quality, setQuality] = useLocalStorage('lab:image-converter:q', 0.9)
  const [previewUrl, setPreviewUrl] = useState('')
  const [outSize, setOutSize] = useState(0)

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      canvasRef.current = canvas
      setFileName(file.name)
      setHasImage(true)
      await refreshPreview(canvas)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  async function refreshPreview(canvas?: HTMLCanvasElement | null) {
    const c = canvas ?? canvasRef.current
    if (!c) return
    const q = clamp(quality, 0.1, 1)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, fmt, q))
    if (!blob) return
    setOutSize(blob.size)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(blob))
  }

  useEffect(() => {
    if (hasImage) void refreshPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, quality, hasImage])

  function download() {
    const c = canvasRef.current
    if (!c || !hasImage) return
    const q = clamp(quality, 0.1, 1)
    const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'
    c.toBlob((blob) => {
      if (!blob) return
      downloadBlob(blob, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}.\${ext}\`)
    }, fmt, q)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機格式轉換，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="label">輸出格式</div>
          <div className="row">
            {([['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] as [Fmt, string][]).map(([id, label]) => (
              <button key={id} type="button" className={\`btn sm \${fmt === id ? 'accent' : 'ghost'}\`} onClick={() => setFmt(id)}>{label}</button>
            ))}
          </div>
          {fmt !== 'image/png' && (
            <label className="stack"><span className="label">品質 {Math.round(quality * 100)}%</span><input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 1))} /></label>
          )}
          {outSize > 0 && <p className="field-hint">預估大小：{formatBytes(outSize)}</p>}
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {previewUrl ? <img src={previewUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('image-compressor', `${head('image-compressor', '圖片壓縮', '以品質與最長邊壓縮圖片。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [origSize, setOrigSize] = useState(0)
  const [outSize, setOutSize] = useState(0)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [quality, setQuality] = useLocalStorage('lab:image-compressor:q', 0.75)
  const [maxSide, setMaxSide] = useLocalStorage('lab:image-compressor:max', 1920)

  async function process(file: File) {
    const img = await loadImageFromFile(file)
    const max = clamp(maxSide, 200, 6000)
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const { canvas } = canvasFromImage(img, w, h)
    canvasRef.current = canvas
    const q = clamp(quality, 0.1, 0.95)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))
    if (!blob) throw new Error('壓縮失敗')
    setOutSize(blob.size)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(blob))
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      setOrigSize(file.size)
      setFileName(file.name)
      setHasImage(true)
      await process(file)
    } catch { setError('無法壓縮圖片'); setHasImage(false) }
  }

  useEffect(() => {
    // re-process when settings change if we have canvas
    const c = canvasRef.current
    if (!c || !hasImage) return
    const q = clamp(quality, 0.1, 0.95)
    c.toBlob((blob) => {
      if (!blob) return
      setOutSize(blob.size)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
    }, 'image/jpeg', q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality])

  function download() {
    const c = canvasRef.current
    if (!c || !hasImage) return
    c.toBlob((blob) => {
      if (!blob) return
      downloadBlob(blob, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-compressed.jpg\`)
    }, 'image/jpeg', clamp(quality, 0.1, 0.95))
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 JPG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機壓縮為 JPG，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName} · 原始 {formatBytes(origSize)}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">品質 {Math.round(quality * 100)}%</span><input type="range" min={10} max={95} value={Math.round(quality * 100)} onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 0.95))} /></label>
          <label className="stack"><span className="label">最長邊 {maxSide}px</span><input type="range" min={200} max={6000} step={10} value={maxSide} onChange={(e) => setMaxSide(clamp(Number(e.target.value), 200, 6000))} /></label>
          <p className="field-hint">變更最長邊請重新上傳以套用縮放。壓縮後約 {outSize ? formatBytes(outSize) : '—'}</p>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {previewUrl ? <img src={previewUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

console.log('batch3 done')
