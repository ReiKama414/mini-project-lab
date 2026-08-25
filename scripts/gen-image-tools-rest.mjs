/**
 * Remaining image tools generator
 * Run: node scripts/gen-image-tools-rest.mjs
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

function meta(slug, title, description) {
  return `import { getProject, type ProjectMeta } from '../registry'
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

const fallback: ProjectMeta = {
  slug: '${slug}',
  title: '${title}',
  description: '${description}',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('${slug}') ?? fallback`
}

// image-blur
write('image-blur', `${meta('image-blur', '圖片模糊', '本機高斯近似模糊。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [radius, setRadius] = useLocalStorage('lab:image-blur:radius', 4)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    const r = clamp(radius, 0, 20)
    ctx.filter = r > 0 ? \`blur(\${r}px)\` : 'none'
    ctx.drawImage(src, 0, 0)
    ctx.filter = 'none'
  }, [radius])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-blur.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機模糊處理，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">模糊半徑 {radius}px</span><input type="range" min={0} max={20} value={radius} onChange={(e) => setRadius(clamp(Number(e.target.value), 0, 20))} /></label>
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

// image-sharpen
write('image-sharpen', `${meta('image-sharpen', '圖片銳化', '本機卷積銳化濾鏡。')}

function sharpenCanvas(src: HTMLCanvasElement, out: HTMLCanvasElement, amount: number) {
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const a = clamp(amount, 0, 100) / 100
  if (a <= 0) return
  const w = src.width
  const h = src.height
  const img = ctx.getImageData(0, 0, w, h)
  const srcData = new Uint8ClampedArray(img.data)
  const d = img.data
  const k = [
    0, -a, 0,
    -a, 1 + 4 * a, -a,
    0, -a, 0,
  ]
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0
      let ki = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4
          const kv = k[ki++]!
          r += srcData[i]! * kv
          g += srcData[i + 1]! * kv
          b += srcData[i + 2]! * kv
        }
      }
      const i = (y * w + x) * 4
      d[i] = clampByte(r)
      d[i + 1] = clampByte(g)
      d[i + 2] = clampByte(b)
    }
  }
  ctx.putImageData(img, 0, 0)
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [amount, setAmount] = useLocalStorage('lab:image-sharpen:amount', 40)

  const redraw = useCallback(() => {
    if (!srcRef.current || !canvasRef.current) return
    sharpenCanvas(srcRef.current, canvasRef.current, amount)
  }, [amount])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-sharpen.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機銳化，大型圖可能稍慢。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">銳化強度 {amount}</span><input type="range" min={0} max={100} value={amount} onChange={(e) => setAmount(clamp(Number(e.target.value), 0, 100))} /></label>
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

// image-pixelate
write('image-pixelate', `${meta('image-pixelate', '圖片像素化', '馬賽克式像素化效果。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [block, setBlock] = useLocalStorage('lab:image-pixelate:block', 12)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    const size = clamp(block, 2, 64)
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    const tw = Math.max(1, Math.floor(src.width / size))
    const th = Math.max(1, Math.floor(src.height / size))
    const tmp = document.createElement('canvas')
    tmp.width = tw
    tmp.height = th
    const tctx = tmp.getContext('2d')!
    tctx.imageSmoothingEnabled = false
    tctx.drawImage(src, 0, 0, tw, th)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, out.width, out.height)
  }, [block])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-pixelate.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機像素化，適合打碼預覽。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">區塊大小 {block}px</span><input type="range" min={2} max={64} value={block} onChange={(e) => setBlock(clamp(Number(e.target.value), 2, 64))} /></label>
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

// image-rotator
write('image-rotator', `${meta('image-rotator', '圖片旋轉', '旋轉 90°／任意角度並下載。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [angle, setAngle] = useLocalStorage('lab:image-rotator:angle', 0)

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const deg = clamp(angle, -180, 180)
    const rad = (deg * Math.PI) / 180
    const w = img.naturalWidth
    const h = img.naturalHeight
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    out.width = Math.max(1, Math.round(w * cos + h * sin))
    out.height = Math.max(1, Math.round(w * sin + h * cos))
    const ctx = out.getContext('2d')!
    ctx.clearRect(0, 0, out.width, out.height)
    ctx.translate(out.width / 2, out.height / 2)
    ctx.rotate(rad)
    ctx.drawImage(img, -w / 2, -h / 2)
  }, [angle])

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
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-rotate.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機旋轉，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="row">
            {[90, 180, -90].map((d) => (
              <button key={d} type="button" className="btn sm ghost" onClick={() => setAngle(clamp(angle + d, -180, 180))}>{d > 0 ? \`+\${d}°\` : \`\${d}°\`}</button>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => setAngle(0)}>重設</button>
          </div>
          <label className="stack"><span className="label">角度 {angle}°</span><input type="range" min={-180} max={180} value={angle} onChange={(e) => setAngle(clamp(Number(e.target.value), -180, 180))} /></label>
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

// image-flipper
write('image-flipper', `${meta('image-flipper', '圖片翻轉', '水平／垂直翻轉圖片。')}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [hFlip, setHFlip] = useLocalStorage('lab:image-flipper:h', false)
  const [vFlip, setVFlip] = useLocalStorage('lab:image-flipper:v', false)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.save()
    ctx.translate(hFlip ? out.width : 0, vFlip ? out.height : 0)
    ctx.scale(hFlip ? -1 : 1, vFlip ? -1 : 1)
    ctx.drawImage(src, 0, 0)
    ctx.restore()
  }, [hFlip, vFlip])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-flip.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機翻轉，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="check"><input type="checkbox" checked={hFlip} onChange={() => setHFlip(!hFlip)} />水平翻轉</label>
          <label className="check"><input type="checkbox" checked={vFlip} onChange={() => setVFlip(!vFlip)} />垂直翻轉</label>
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

console.log('rest phase A done')
