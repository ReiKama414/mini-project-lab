/**
 * batch-watermark, ai-background-remover, image-collage
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

write('batch-watermark', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import JSZip from 'jszip'

const fallback: ProjectMeta = { slug: 'batch-watermark', title: '批次浮水印', description: '為多張圖片一次加上浮水印並打包下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('batch-watermark') ?? fallback

const TEXT_MAX = 80
const MAX_FILES = 30

function applyWatermark(canvas: HTMLCanvasElement, text: string, opacity: number, size: number, angle: number, color: string) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.save()
  ctx.globalAlpha = clamp(opacity, 5, 80) / 100
  ctx.fillStyle = color
  ctx.font = \`600 \${clamp(size, 12, 120)}px "Noto Sans TC", "Microsoft JhengHei", sans-serif\`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(w / 2, h / 2)
  ctx.rotate((clamp(angle, -90, 90) * Math.PI) / 180)
  const gap = Math.max(120, size * 5)
  const diag = Math.sqrt(w * w + h * h)
  for (let y = -diag; y < diag; y += gap) {
    for (let x = -diag; x < diag; x += gap) ctx.fillText(text, x, y)
  }
  ctx.restore()
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useLocalStorage('lab:batch-watermark:text', '僅供核對使用')
  const [opacity, setOpacity] = useLocalStorage('lab:batch-watermark:opacity', 28)
  const [fontSize, setFontSize] = useLocalStorage('lab:batch-watermark:size', 28)
  const [angle, setAngle] = useLocalStorage('lab:batch-watermark:angle', -30)
  const [color, setColor] = useLocalStorage('lab:batch-watermark:color', '#1a2e28')

  function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(\`「\${f.name}」超過 \${formatBytes(IMAGE_MAX_BYTES)}\`)
        return
      }
    }
    setError('')
    setFiles(arr)
  }

  async function processZip() {
    if (!files.length || !isNonEmpty(text)) return
    setBusy(true)
    setError('')
    try {
      const zip = new JSZip()
      const line = limitText(text.trim(), TEXT_MAX)
      for (const file of files) {
        const img = await loadImageFromFile(file)
        const { canvas } = canvasFromImage(img)
        applyWatermark(canvas, line, opacity, fontSize, angle, color)
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) zip.file(\`\${file.name.replace(/\\.[^.]+$/, '')}-wm.png\`, blob)
      }
      const out = await zip.generateAsync({ type: 'blob' })
      downloadBlob(out, 'batch-watermark.zip')
    } catch {
      setError('處理失敗，請重試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!files.length || !isNonEmpty(text) || busy} onClick={() => void processZip()}>{busy ? '處理中…' : '下載 ZIP'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>一次最多 {MAX_FILES} 張，全部在瀏覽器本機處理。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">選擇多張圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => onFiles(e.target.files)} /></label>
        {files.length > 0 && <p className="muted" style={{ margin: 0 }}>已選 {files.length} 張 · {formatBytes(files.reduce((n, f) => n + f.size, 0))}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">浮水印文字</label>
          <input className={\`field\${!isNonEmpty(text) ? ' is-invalid' : ''}\`} value={text} maxLength={TEXT_MAX} onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))} />
          <div className="field-meta"><span>{!isNonEmpty(text) ? '請輸入文字' : ' '}</span><span>{charCount(text)} / {TEXT_MAX}</span></div>
        </div>
        <div className="grid-2">
          <label className="stack"><span className="label">透明度 {opacity}%</span><input type="range" min={5} max={80} value={opacity} onChange={(e) => setOpacity(clamp(Number(e.target.value), 5, 80))} /></label>
          <label className="stack"><span className="label">字級 {fontSize}px</span><input type="range" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(clamp(Number(e.target.value), 12, 120))} /></label>
          <label className="stack"><span className="label">角度 {angle}°</span><input type="range" min={-90} max={90} value={angle} onChange={(e) => setAngle(clamp(Number(e.target.value), -90, 90))} /></label>
          <label className="stack"><span className="label">顏色</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        <ul className="stack" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {files.map((f) => <li key={f.name + f.size}>{f.name} · {formatBytes(f.size)}</li>)}
        </ul>
        <button type="button" className="btn accent" disabled={!files.length || !isNonEmpty(text) || busy} onClick={() => void processZip()}>{busy ? '處理中…' : '套用並下載 ZIP'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('ai-background-remover', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, clampByte, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = { slug: 'ai-background-remover', title: 'AI 去背（啟發式）', description: '以近白／綠幕或四角洪水填色去除背景。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('ai-background-remover') ?? fallback

type Mode = 'white' | 'green' | 'flood'

function removeBg(canvas: HTMLCanvasElement, mode: Mode, tolerance: number) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const w = canvas.width
  const h = canvas.height
  const tol = clamp(tolerance, 5, 120)

  const near = (i: number, r: number, g: number, b: number) =>
    Math.abs(d[i]! - r) <= tol && Math.abs(d[i + 1]! - g) <= tol && Math.abs(d[i + 2]! - b) <= tol

  if (mode === 'white') {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]! > 255 - tol && d[i + 1]! > 255 - tol && d[i + 2]! > 255 - tol) d[i + 3] = 0
    }
  } else if (mode === 'green') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
      if (g > r + 30 && g > b + 30 && g > 80) d[i + 3] = 0
    }
  } else {
    const visited = new Uint8Array(w * h)
    const queue: number[] = []
    const seeds = [0, w - 1, (h - 1) * w, h * w - w]
    for (const s of seeds) {
      queue.push(s)
      visited[s] = 1
    }
    const sample = (idx: number) => [d[idx * 4]!, d[idx * 4 + 1]!, d[idx * 4 + 2]!] as const
    while (queue.length) {
      const p = queue.pop()!
      const [sr, sg, sb] = sample(seeds[0]!)
      const i = p * 4
      if (!near(i, sr, sg, sb) && !near(i, d[0]!, d[1]!, d[2]!)) continue
      // compare to corner average
      const cr = clampByte((d[0]! + d[(w - 1) * 4]! + d[(h - 1) * w * 4]! + d[((h * w - 1) * 4)]!) / 4)
      const cg = clampByte((d[1]! + d[(w - 1) * 4 + 1]! + d[(h - 1) * w * 4 + 1]! + d[((h * w - 1) * 4) + 1]!) / 4)
      const cb = clampByte((d[2]! + d[(w - 1) * 4 + 2]! + d[(h - 1) * w * 4 + 2]! + d[((h * w - 1) * 4) + 2]!) / 4)
      if (!near(i, cr, cg, cb)) continue
      d[i + 3] = 0
      const x = p % w
      const y = (p / w) | 0
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (visited[ni]) continue
        visited[ni] = 1
        queue.push(ni)
      }
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
  const [mode, setMode] = useLocalStorage<Mode>('lab:ai-bg:mode', 'white')
  const [tolerance, setTolerance] = useLocalStorage('lab:ai-bg:tol', 32)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    removeBg(out, mode, tolerance)
  }, [mode, tolerance])

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
    downloadCanvas(canvasRef.current, \`\${fileName.replace(/\\.[^.]+$/, '') || 'image'}-nobg.png\`)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>下載 PNG</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>啟發式去背（近白／綠幕／四角洪水），非深度學習模型。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">上傳圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => onFile(e.target.files?.[0] ?? null)} /></label>
          {fileName && <p className="muted" style={{ fontSize: 13, margin: 0 }}>{fileName}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="row">
            {([['white', '近白背景'], ['green', '綠幕'], ['flood', '四角洪水']] as [Mode, string][]).map(([id, label]) => (
              <button key={id} type="button" className={\`btn sm \${mode === id ? 'accent' : 'ghost'}\`} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>
          <label className="stack"><span className="label">容差 {tolerance}</span><input type="range" min={5} max={120} value={tolerance} onChange={(e) => setTolerance(clamp(Number(e.target.value), 5, 120))} /></label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>下載透明 PNG</button>
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

write('image-collage', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = { slug: 'image-collage', title: '圖片拼貼', description: '多圖拼成網格拼貼並下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('image-collage') ?? fallback

const MAX_FILES = 12

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgsRef = useRef<HTMLImageElement[]>([])
  const [names, setNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const [cols, setCols] = useLocalStorage('lab:image-collage:cols', 2)
  const [gap, setGap] = useLocalStorage('lab:image-collage:gap', 12)
  const [cell, setCell] = useLocalStorage('lab:image-collage:cell', 400)
  const [bg, setBg] = useLocalStorage('lab:image-collage:bg', '#ffffff')

  const redraw = useCallback(() => {
    const imgs = imgsRef.current
    const out = canvasRef.current
    if (!imgs.length || !out) return
    const c = clamp(cols, 1, 4)
    const g = clamp(gap, 0, 60)
    const s = clamp(cell, 120, 800)
    const rows = Math.ceil(imgs.length / c)
    out.width = c * s + (c + 1) * g
    out.height = rows * s + (rows + 1) * g
    const ctx = out.getContext('2d')!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, out.width, out.height)
    imgs.forEach((img, i) => {
      const col = i % c
      const row = (i / c) | 0
      const x = g + col * (s + g)
      const y = g + row * (s + g)
      const scale = Math.max(s / img.naturalWidth, s / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const sx = (dw - s) / 2 / scale
      const sy = (dh - s) / 2 / scale
      ctx.drawImage(img, sx, sy, s / scale, s / scale, x, y, s, s)
    })
  }, [cols, gap, cell, bg])

  useEffect(() => { redraw() }, [redraw, names])

  async function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) { setError(\`「\${f.name}」過大\`); return }
    }
    try {
      setError('')
      imgsRef.current = await Promise.all(arr.map((f) => loadImageFromFile(f)))
      setNames(arr.map((f) => f.name))
    } catch { setError('無法讀取部分圖片') }
  }

  function download() {
    if (!canvasRef.current || !names.length) return
    redraw()
    downloadCanvas(canvasRef.current, 'collage.png')
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!names.length} onClick={download}>下載拼貼</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>最多 {MAX_FILES} 張，網格置中裁切拼貼。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack"><span className="label">選擇圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => onFiles(e.target.files)} /></label>
          {names.length > 0 && <p className="muted" style={{ margin: 0 }}>已選 {names.length} 張</p>}
          {error && <p className="field-error">{error}</p>}
          <label className="stack"><span className="label">欄數 {cols}</span><input type="range" min={1} max={4} value={cols} onChange={(e) => setCols(clamp(Number(e.target.value), 1, 4))} /></label>
          <label className="stack"><span className="label">格寬 {cell}px</span><input type="range" min={120} max={800} value={cell} onChange={(e) => setCell(clamp(Number(e.target.value), 120, 800))} /></label>
          <label className="stack"><span className="label">間距 {gap}px</span><input type="range" min={0} max={60} value={gap} onChange={(e) => setGap(clamp(Number(e.target.value), 0, 60))} /></label>
          <label className="stack"><span className="label">背景色</span><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
          <button type="button" className="btn accent" disabled={!names.length} onClick={download}>下載</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {names.length ? <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>上傳後預覽</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

console.log('done batch watermark etc')
