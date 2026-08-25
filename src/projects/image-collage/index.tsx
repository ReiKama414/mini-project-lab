import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-collage',
  title: '圖片拼貼',
  description: '多圖拼成網格拼貼並下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-collage') ?? fallback

const MAX_FILES = 12

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgsRef = useRef<HTMLImageElement[]>([])
  const [names, setNames] = useState<string[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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

  useEffect(() => {
    redraw()
  }, [redraw, names])

  async function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(`「${f.name}」過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
        return
      }
    }
    setBusy(true)
    try {
      setError('')
      imgsRef.current = await Promise.all(arr.map((f) => loadImageFromFile(f)))
      setNames(arr.map((f) => f.name))
      setTotalSize(arr.reduce((n, f) => n + f.size, 0))
    } catch {
      setError('無法讀取部分圖片')
      imgsRef.current = []
      setNames([])
      setTotalSize(0)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!canvasRef.current || !names.length) return
    redraw()
    downloadCanvas(canvasRef.current, 'collage.png')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!names.length || busy} onClick={download}>
          下載拼貼
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        最多 {MAX_FILES} 張；每格置中裁切（cover），非完整縮放。本機處理，不會上傳。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">選擇圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} multiple disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
          </label>
          {names.length > 0 && (
            <p className="muted" style={{ margin: 0 }}>
              已選 {names.length} 張 · {formatBytes(totalSize)}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          {busy && <p className="field-hint">讀取中…</p>}
          <label className="stack">
            <span className="label">欄數 {cols}</span>
            <input type="range" min={1} max={4} value={cols} onChange={(e) => setCols(clamp(Number(e.target.value), 1, 4))} />
          </label>
          <label className="stack">
            <span className="label">格寬 {cell}px</span>
            <input type="range" min={120} max={800} value={cell} onChange={(e) => setCell(clamp(Number(e.target.value), 120, 800))} />
          </label>
          <label className="stack">
            <span className="label">間距 {gap}px</span>
            <input type="range" min={0} max={60} value={gap} onChange={(e) => setGap(clamp(Number(e.target.value), 0, 60))} />
          </label>
          <label className="stack">
            <span className="label">背景色</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
          <button type="button" className="btn accent" disabled={!names.length || busy} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {names.length ? (
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--line)' }} />
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
