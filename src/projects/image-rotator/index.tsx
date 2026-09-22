import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-rotator',
  title: '圖片旋轉',
  description: '90°／任意角度旋轉並下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-rotator') ?? fallback

function rotatedSize(w: number, h: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    outWidth: Math.max(1, Math.round(w * cos + h * sin)),
    outHeight: Math.max(1, Math.round(w * sin + h * cos)),
  }
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imgRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageFile()
  const [angle, setAngle] = useLocalStorage('lab:image-rotator:angle', 0)

  const deg = clamp(angle, -180, 180)
  const { outWidth, outHeight } = hasImage
    ? rotatedSize(width, height, deg)
    : { outWidth: 0, outHeight: 0 }

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const a = clamp(angle, -180, 180)
    const rad = (a * Math.PI) / 180
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
  }, [angle, imgRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-rotate.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="任意角度旋轉，畫布會擴展以容納內容。僅本機處理。"
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
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {[90, 180, -90].map((d) => (
              <button
                key={d}
                type="button"
                className="btn sm ghost"
                onClick={() => setAngle(clamp(angle + d, -180, 180))}
              >
                {d > 0 ? `+${d}°` : `${d}°`}
              </button>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => setAngle(0)}>
              重置
            </button>
          </div>
          <label className="stack">
            <span className="label">角度 {angle}°</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={angle}
              onChange={(e) => setAngle(clamp(Number(e.target.value), -180, 180))}
            />
          </label>
        </>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[{ label: '角度', value: `${deg}°` }]}
    />
  )
}
