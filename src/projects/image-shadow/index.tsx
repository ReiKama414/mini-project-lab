import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-shadow',
  title: '圖片加陰影',
  description: '為圖片加上投影效果。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-shadow') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
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
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-shadow.png`)
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
        使用 Canvas 陰影 API，陰影會擴大畫布。匯出透明 PNG。僅本機處理，不會上傳。
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
            <span className="label">模糊 {blur}px</span>
            <input type="range" min={0} max={80} value={blur} onChange={(e) => setBlur(clamp(Number(e.target.value), 0, 80))} />
          </label>
          <label className="stack">
            <span className="label">X 位移 {offsetX}px</span>
            <input type="range" min={-60} max={60} value={offsetX} onChange={(e) => setOffsetX(clamp(Number(e.target.value), -60, 60))} />
          </label>
          <label className="stack">
            <span className="label">Y 位移 {offsetY}px</span>
            <input type="range" min={-60} max={60} value={offsetY} onChange={(e) => setOffsetY(clamp(Number(e.target.value), -60, 60))} />
          </label>
          <label className="stack">
            <span className="label">邊距 {pad}px</span>
            <input type="range" min={0} max={120} value={pad} onChange={(e) => setPad(clamp(Number(e.target.value), 0, 120))} />
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