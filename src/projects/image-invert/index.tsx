import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, mapPixels, clampByte, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-invert',
  title: '負片效果',
  description: '反轉圖片顏色。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-invert') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    mapPixels(out, (r, g, b, a) => [clampByte(255 - r), clampByte(255 - g), clampByte(255 - b), a])
  }, [])

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
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
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
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-invert.png`)
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
        依 RGB 通道反轉顏色。僅本機處理，不會上傳。
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