import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-border',
  title: '圖片加邊框',
  description: '為圖片加上自訂顏色與厚度的邊框。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-border') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
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
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-border.png`)
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
      <p className="muted" style={{ marginBottom: 12 }}>依厚度擴展畫布並填色，不保留 EXIF。僅本機處理，不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <label className="stack">
            <span className="label">邊框厚度 {width}px</span>
            <input type="range" min={0} max={200} value={width} onChange={(e) => setWidth(clamp(Number(e.target.value), 0, 200))} />
          </label>
          <label className="stack">
            <span className="label">邊框顏色</span>
            <div className="row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <input
                className="field mono"
                style={{ width: 120 }}
                value={color}
                maxLength={7}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value)
                }}
              />
            </div>
          </label>
          <button type="button" className="btn accent" disabled={!hasImage} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
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