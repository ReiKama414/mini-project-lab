import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-resizer',
  title: '圖片縮放',
  description: '依寬高或最長邊縮放圖片。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-resizer') ?? fallback

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'
type Mode = 'exact' | 'maxSide'

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [maxSide, setMaxSide] = useLocalStorage('lab:image-resizer:max', 1920)
  const [mode, setMode] = useLocalStorage<Mode>('lab:image-resizer:mode', 'exact')
  const [keepRatio, setKeepRatio] = useLocalStorage('lab:image-resizer:ratio', true)
  const [fmt, setFmt] = useLocalStorage<Fmt>('lab:image-resizer:fmt', 'image/png')
  const [quality, setQuality] = useLocalStorage('lab:image-resizer:q', 0.92)
  const [orig, setOrig] = useState({ w: 0, h: 0 })

  const targetSize = useCallback(() => {
    const img = imgRef.current
    if (!img) return { w: 1, h: 1 }
    if (mode === 'maxSide') {
      const max = clamp(maxSide, 1, 8000)
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      return {
        w: Math.max(1, Math.round(img.naturalWidth * scale)),
        h: Math.max(1, Math.round(img.naturalHeight * scale)),
      }
    }
    return { w: clamp(width, 1, 8000), h: clamp(height, 1, 8000) }
  }, [mode, maxSide, width, height])

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const { w, h } = targetSize()
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')!
    if (fmt === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
  }, [targetSize, fmt])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

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
      setOrig({ w: img.naturalWidth, h: img.naturalHeight })
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
      setFileName(file.name)
      setFileSize(file.size)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
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

  async function download() {
    if (!canvasRef.current || !hasImage) return
    setBusy(true)
    setError('')
    try {
      redraw()
      const q = clamp(quality, 0.1, 1)
      const blob = await new Promise<Blob | null>((res) => canvasRef.current!.toBlob(res, fmt, q))
      if (!blob) throw new Error('匯出失敗')
      const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'
      downloadBlob(blob, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-resized.${ext}`)
    } catch {
      setError('無法匯出（此瀏覽器可能不支援所選格式）')
    } finally {
      setBusy(false)
    }
  }

  const preview = targetSize()

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage || busy} onClick={() => void download()}>
          {busy ? '處理中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        單邊上限 8000px；JPEG 以白底填補透明。僅本機處理，不會上傳。
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
          {orig.w > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)} · 原始 {orig.w} × {orig.h}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <div className="row">
            <button type="button" className={`btn sm ${mode === 'exact' ? 'accent' : 'ghost'}`} onClick={() => setMode('exact')}>
              寬高
            </button>
            <button type="button" className={`btn sm ${mode === 'maxSide' ? 'accent' : 'ghost'}`} onClick={() => setMode('maxSide')}>
              最長邊
            </button>
          </div>
          {mode === 'exact' ? (
            <>
              <label className="check">
                <input type="checkbox" checked={keepRatio} onChange={() => setKeepRatio(!keepRatio)} />
                鎖定比例
              </label>
              <div className="grid-2">
                <label className="stack">
                  <span className="label">寬度</span>
                  <input className="field" type="number" min={1} max={8000} value={width} onChange={(e) => setW(Number(e.target.value) || 1)} />
                </label>
                <label className="stack">
                  <span className="label">高度</span>
                  <input className="field" type="number" min={1} max={8000} value={height} onChange={(e) => setH(Number(e.target.value) || 1)} />
                </label>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {[25, 50, 75, 100, 150].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn sm ghost"
                    disabled={!orig.w}
                    onClick={() => {
                      setW(Math.max(1, Math.round((orig.w * p) / 100)))
                      if (!keepRatio) setHeight(Math.max(1, Math.round((orig.h * p) / 100)))
                    }}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </>
          ) : (
            <label className="stack">
              <span className="label">最長邊 {maxSide}px</span>
              <input type="range" min={100} max={8000} step={10} value={maxSide} onChange={(e) => setMaxSide(clamp(Number(e.target.value), 100, 8000))} />
            </label>
          )}
          <div className="label">輸出格式</div>
          <div className="row">
            {([['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] as [Fmt, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`} onClick={() => setFmt(id)}>
                {label}
              </button>
            ))}
          </div>
          {fmt !== 'image/png' && (
            <label className="stack">
              <span className="label">品質 {Math.round(quality * 100)}%</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 1))}
              />
            </label>
          )}
          {busy && <p className="field-hint">處理中…</p>}
          <button type="button" className="btn accent" disabled={!hasImage || busy} onClick={() => void download()}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">
            預覽（{preview.w} × {preview.h}）
          </div>
          {hasImage ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560 }}>
              <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
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