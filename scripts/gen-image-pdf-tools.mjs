/**
 * One-shot generator for image + PDF local-first tools.
 * Run: node scripts/gen-image-pdf-tools.mjs
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

function metaBlock(slug, title, description, tier = 'feature') {
  return `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'

const fallback: ProjectMeta = {
  slug: '${slug}',
  title: '${title}',
  description: '${description}',
  tier: '${tier}',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('${slug}') ?? fallback`
}

/** Shared image upload + canvas preview scaffold pieces */
const IMAGE_IMPORTS = `import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import {
  loadImageFromFile,
  canvasFromImage,
  downloadCanvas,
  mapPixels,
  clampByte,
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
} from '../../lib/imageCanvas'`

function simplePixelTool({
  slug,
  title,
  description,
  controlLabel,
  controlKey,
  defaultVal,
  min,
  max,
  applyExpr,
  extraControls = '',
  extraState = '',
}) {
  return `${metaBlock(slug, title, description)}
${IMAGE_IMPORTS}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [${controlKey}, set${controlKey[0].toUpperCase() + controlKey.slice(1)}] = useLocalStorage('lab:${slug}:${controlKey}', ${defaultVal})
${extraState}

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const v = clamp(${controlKey}, ${min}, ${max})
    ${applyExpr}
  }, [${controlKey}${extraControls ? ', ' + extraControls : ''}])

  useEffect(() => {
    redraw()
  }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (!IMAGE_ACCEPT.split(',').includes(file.type) && !file.type.startsWith('image/')) {
      setError('請上傳 JPG／PNG／WebP／GIF')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`)
      return
    }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      srcRef.current = canvas
      setFileName(file.name)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    const base = fileName.replace(/\\.[^.]+$/, '') || '${slug}'
    downloadCanvas(canvasRef.current, \`\${base}-${slug}.png\`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!hasImage} onClick={() => { srcRef.current = null; setHasImage(false); setFileName(''); setError('') }}>
            清除
          </button>
          <button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>
            下載 PNG
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>圖片僅在瀏覽器本機處理，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <p className="field-hint">單檔上限 {formatBytes(IMAGE_MAX_BYTES)}</p>
          <label className="stack">
            <span className="label">{controlLabel} {${controlKey}}</span>
            <input type="range" min={${min}} max={${max}} value={${controlKey}} onChange={(e) => set${controlKey[0].toUpperCase() + controlKey.slice(1)}(clamp(Number(e.target.value), ${min}, ${max}))} />
          </label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>套用並下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', background: 'var(--bg-muted)', maxHeight: 560 }}>
              <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳圖片後預覽</div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
`
}

// ─── Image tools ───────────────────────────────────────────

write(
  'image-brightness',
  simplePixelTool({
    slug: 'image-brightness',
    title: '圖片亮度調整',
    description: '本機調整圖片亮度並下載 PNG。',
    controlLabel: '亮度',
    controlKey: 'amount',
    defaultVal: 0,
    min: -100,
    max: 100,
    applyExpr: `mapPixels(out, (r, g, b, a) => [clampByte(r + v), clampByte(g + v), clampByte(b + v), a])`,
  }),
)

write(
  'image-contrast',
  simplePixelTool({
    slug: 'image-contrast',
    title: '圖片對比度調整',
    description: '本機調整圖片對比度並下載。',
    controlLabel: '對比',
    controlKey: 'amount',
    defaultVal: 0,
    min: -100,
    max: 100,
    applyExpr: `const f = (259 * (v + 255)) / (255 * (259 - v))
    mapPixels(out, (r, g, b, a) => [clampByte(f * (r - 128) + 128), clampByte(f * (g - 128) + 128), clampByte(f * (b - 128) + 128), a])`,
  }),
)

write(
  'image-saturation',
  simplePixelTool({
    slug: 'image-saturation',
    title: '圖片飽和度調整',
    description: '本機調整色彩飽和度。',
    controlLabel: '飽和度',
    controlKey: 'amount',
    defaultVal: 0,
    min: -100,
    max: 100,
    applyExpr: `const s = 1 + v / 100
    mapPixels(out, (r, g, b, a) => {
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
      return [clampByte(gray + (r - gray) * s), clampByte(gray + (g - gray) * s), clampByte(gray + (b - gray) * s), a]
    })`,
  }),
)

write(
  'image-grayscale',
  `${metaBlock('image-grayscale', '圖片灰階', '將圖片轉為灰階並下載。')}
${IMAGE_IMPORTS}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [strength, setStrength] = useLocalStorage('lab:image-grayscale:strength', 100)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    const t = clamp(strength, 0, 100) / 100
    mapPixels(out, (r, g, b, a) => {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      return [clampByte(r + (gray - r) * t), clampByte(g + (gray - g) * t), clampByte(b + (gray - b) * t), a]
    })
  }, [strength])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      srcRef.current = canvasFromImage(img).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-grayscale.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<div className="row"><button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button></div>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機灰階轉換，不會上傳檔案。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">灰階強度 {strength}%</span><input type="range" min={0} max={100} value={strength} onChange={(e) => setStrength(clamp(Number(e.target.value), 0, 100))} /></label>
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

write(
  'image-invert',
  `${metaBlock('image-invert', '圖片色相反轉', '本機反轉圖片色彩。')}
${IMAGE_IMPORTS}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [amount, setAmount] = useLocalStorage('lab:image-invert:amount', 100)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    const t = clamp(amount, 0, 100) / 100
    mapPixels(out, (r, g, b, a) => [
      clampByte(r + (255 - r - r) * t),
      clampByte(g + (255 - g - g) * t),
      clampByte(b + (255 - b - b) * t),
      a,
    ])
  }, [amount])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(\`檔案過大（上限 \${formatBytes(IMAGE_MAX_BYTES)}）\`); return }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      srcRef.current = canvasFromImage(img).canvas
      setFileName(file.name)
      setHasImage(true)
    } catch { setError('無法讀取圖片'); setHasImage(false) }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-invert.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機色相反轉，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">反轉強度 {amount}%</span><input type="range" min={0} max={100} value={amount} onChange={(e) => setAmount(clamp(Number(e.target.value), 0, 100))} /></label>
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

console.log('phase1 done')
