import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-rotator',
  title: '圖片旋轉',
  description: '90°／任意角度旋轉並下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-rotator') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
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
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-rotate.png`)
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
        任意角度旋轉，畫布會擴展以容納內容。僅本機處理，不會上傳。
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
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {[90, 180, -90].map((d) => (
              <button key={d} type="button" className="btn sm ghost" onClick={() => setAngle(clamp(angle + d, -180, 180))}>
                {d > 0 ? `+${d}°` : `${d}°`}
              </button>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => setAngle(0)}>
              重置
            </button>
          </div>
          <label className="stack">
            <span className="label">角度 {angle}°</span>
            <input type="range" min={-180} max={180} value={angle} onChange={(e) => setAngle(clamp(Number(e.target.value), -180, 180))} />
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