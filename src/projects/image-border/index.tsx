import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-border',
  title: '圖片加邊框',
  description: '為圖片加上自訂顏色與厚度的邊框',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-border') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imgRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageFile()
  const [borderWidth, setBorderWidth] = useLocalStorage('lab:image-border:width', 24)
  const [color, setColor] = useLocalStorage('lab:image-border:color', '#1a2e28')

  const b = clamp(borderWidth, 0, 200)
  const outWidth = hasImage ? width + b * 2 : 0
  const outHeight = hasImage ? height + b * 2 : 0

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const pad = clamp(borderWidth, 0, 200)
    out.width = img.naturalWidth + pad * 2
    out.height = img.naturalHeight + pad * 2
    const ctx = out.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(img, pad, pad)
  }, [borderWidth, color, imgRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-border.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="依厚度擴展畫布並填色，不保留 EXIF。僅本機處理。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      outWidth={outWidth}
      outHeight={outHeight}
      error={error}
      hasImage={hasImage}
      onFile={(file) => void onFile(file)}
      onDownload={download}
      controls={
        <>
          <label className="stack">
            <span className="label">邊框厚度 {borderWidth}px</span>
            <input
              type="range"
              min={0}
              max={200}
              value={borderWidth}
              onChange={(e) => setBorderWidth(clamp(Number(e.target.value), 0, 200))}
            />
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
        </>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[
        { label: '邊框厚度', value: `${b}px` },
        { label: '邊框顏色', value: <span className="mono">{color}</span> },
      ]}
    />
  )
}
