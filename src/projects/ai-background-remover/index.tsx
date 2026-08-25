import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, clampByte, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
const fallback: ProjectMeta = { slug: 'ai-background-remover', title: '啟發式去背', description: '以近白／綠幕或四角洪水填色去除背景。', tier: 'feature', effort: '1～3 天', tags: ['image'] }
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
    if (file.size > IMAGE_MAX_BYTES) { setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`); return }
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
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-nobg.png`)
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
              <button key={id} type="button" className={`btn sm ${mode === id ? 'accent' : 'ghost'}`} onClick={() => setMode(id)}>{label}</button>
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
