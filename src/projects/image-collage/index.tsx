import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
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

function revokeAll(urls: string[]) {
  for (const u of urls) {
    if (u) URL.revokeObjectURL(u)
  }
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgsRef = useRef<HTMLImageElement[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cols, setCols] = useLocalStorage('lab:image-collage:cols', 2)
  const [gap, setGap] = useLocalStorage('lab:image-collage:gap', 12)
  const [cell, setCell] = useLocalStorage('lab:image-collage:cell', 400)
  const [bg, setBg] = useLocalStorage('lab:image-collage:bg', '#ffffff')
  const [dragOver, setDragOver] = useState<number | null>(null)
  const previewsRef = useRef<string[]>([])
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    return () => {
      revokeAll(previewsRef.current)
    }
  }, [])

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
  }, [redraw, files])

  async function onFiles(list: File[]) {
    const arr = list.slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(`「${f.name}」過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
        return
      }
    }
    setBusy(true)
    try {
      setError('')
      const loaded = await Promise.all(arr.map((f) => loadImageFromFile(f)))
      revokeAll(previewsRef.current)
      imgsRef.current = loaded
      setPreviews(arr.map((f) => URL.createObjectURL(f)))
      setFiles(arr)
    } catch {
      setError('無法讀取部分圖片')
      revokeAll(previewsRef.current)
      imgsRef.current = []
      setPreviews([])
      setFiles([])
    } finally {
      setBusy(false)
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setFiles((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })
    setPreviews((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item ?? '')
      return next
    })
    const imgs = [...imgsRef.current]
    if (from < imgs.length && to < imgs.length) {
      const [item] = imgs.splice(from, 1)
      imgs.splice(to, 0, item!)
      imgsRef.current = imgs
    }
  }

  function move(i: number, dir: -1 | 1) {
    reorder(i, i + dir)
  }

  function download() {
    if (!canvasRef.current || !files.length) return
    redraw()
    downloadCanvas(canvasRef.current, 'collage.png')
  }

  const totalSize = files.reduce((n, f) => n + f.size, 0)

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!files.length || busy} onClick={download}>
          下載拼貼
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        最多 {MAX_FILES} 張；每格置中裁切（cover），非完整縮放。可拖曳列表調整順序。本機處理，不會上傳。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <FileDrop
            accept={IMAGE_ACCEPT}
            maxBytes={IMAGE_MAX_BYTES}
            multiple
            maxFiles={MAX_FILES}
            disabled={busy}
            label="拖放圖片到此，或點擊選擇（可多選）"
            hint={`單張上限 ${formatBytes(IMAGE_MAX_BYTES)} · 最多 ${MAX_FILES} 張`}
            onFiles={(picked) => void onFiles(picked)}
          />
          {files.length > 0 && (
            <p className="muted" style={{ margin: 0 }}>
              已選 {files.length} 張 · {formatBytes(totalSize)}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          {busy && <p className="field-hint">讀取中…</p>}
          <div className="stack" style={{ gap: 8 }}>
            {files.map((f, i) => (
              <div
                key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                className="row"
                draggable={!busy}
                onDragStart={() => {
                  dragFrom.current = i
                }}
                onDragEnd={() => {
                  dragFrom.current = null
                  setDragOver(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(i)
                }}
                onDragLeave={() => {
                  setDragOver((cur) => (cur === i ? null : cur))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = dragFrom.current
                  setDragOver(null)
                  if (from == null) return
                  reorder(from, i)
                  dragFrom.current = null
                }}
                style={{
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  padding: '6px 4px',
                  borderRadius: 8,
                  border: dragOver === i ? '1px dashed var(--accent, #888)' : '1px solid transparent',
                  cursor: busy ? 'default' : 'grab',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
                  {previews[i] ? (
                    <img
                      src={previews[i]}
                      alt={f.name}
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: 'cover',
                        border: '1px solid var(--line)',
                        borderRadius: 4,
                        background: '#fff',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        border: '1px dashed var(--line)',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {i + 1}. {f.name}
                  </span>
                </div>
                <div className="row">
                  <button type="button" className="btn sm ghost" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={busy || i === files.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    下移
                  </button>
                </div>
              </div>
            ))}
          </div>
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
          <button type="button" className="btn accent" disabled={!files.length || busy} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {files.length ? (
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
