import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-rounded',
  title: '圖片圓角',
  description: '套用圓角遮罩並匯出透明 PNG',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-rounded') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imgRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageFile()
  const [radius, setRadius] = useLocalStorage('lab:image-rounded:radius', 48)

  const appliedRadius = hasImage ? clamp(radius, 0, Math.min(width, height) / 2) : clamp(radius, 0, 300)

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
  }, [radius, imgRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-rounded.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="圓角外側透明，請用 PNG 下載；JPEG 不保留透明。僅本機處理。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={(file) => void onFile(file)}
      onDownload={download}
      controls={
        <label className="stack">
          <span className="label">圓角 {radius}px</span>
          <input
            type="range"
            min={0}
            max={300}
            value={radius}
            onChange={(e) => setRadius(clamp(Number(e.target.value), 0, 300))}
          />
        </label>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[{ label: '圓角', value: `${Math.round(appliedRadius)}px` }]}
    />
  )
}
