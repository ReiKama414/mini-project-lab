import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-rounded',
  title: '圖片圓角',
  description: '套用圓角遮罩並匯出透明 PNG。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-rounded') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
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
      imgRef.current = await loadImageFromFile(file)
      setFileName(file.name)
      setFileSize(file.size)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-rounded.png`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage} onClick={download}>
          下載 PNG
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        圓角外側透明，請用 PNG 下載；JPEG 不保留透明。僅本機處理，不會上傳。
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
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <label className="stack">
            <span className="label">圓角 {radius}px</span>
            <input type="range" min={0} max={300} value={radius} onChange={(e) => setRadius(clamp(Number(e.target.value), 0, 300))} />
          </label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? (
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 12,
                overflow: 'auto',
                maxHeight: 560,
                background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px',
              }}
            >
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