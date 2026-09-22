import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-shadow',
  title: '圖片加陰影',
  description: '為圖片加上投影效果',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-shadow') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imgRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageFile()
  const [blur, setBlur] = useLocalStorage('lab:image-shadow:blur', 24)
  const [offsetX, setOffsetX] = useLocalStorage('lab:image-shadow:ox', 12)
  const [offsetY, setOffsetY] = useLocalStorage('lab:image-shadow:oy', 12)
  const [pad, setPad] = useLocalStorage('lab:image-shadow:pad', 40)

  const p = clamp(pad, 0, 120)
  const outWidth = hasImage ? width + p * 2 : 0
  const outHeight = hasImage ? height + p * 2 : 0

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const padding = clamp(pad, 0, 120)
    out.width = img.naturalWidth + padding * 2
    out.height = img.naturalHeight + padding * 2
    const ctx = out.getContext('2d')!
    ctx.clearRect(0, 0, out.width, out.height)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = clamp(blur, 0, 80)
    ctx.shadowOffsetX = clamp(offsetX, -60, 60)
    ctx.shadowOffsetY = clamp(offsetY, -60, 60)
    ctx.drawImage(img, padding, padding)
  }, [blur, offsetX, offsetY, pad, imgRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-shadow.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="使用 Canvas 陰影 API，陰影會擴大畫布匯出透明 PNG。僅本機處理。"
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
            <span className="label">模糊 {blur}px</span>
            <input
              type="range"
              min={0}
              max={80}
              value={blur}
              onChange={(e) => setBlur(clamp(Number(e.target.value), 0, 80))}
            />
          </label>
          <label className="stack">
            <span className="label">X 位移 {offsetX}px</span>
            <input
              type="range"
              min={-60}
              max={60}
              value={offsetX}
              onChange={(e) => setOffsetX(clamp(Number(e.target.value), -60, 60))}
            />
          </label>
          <label className="stack">
            <span className="label">Y 位移 {offsetY}px</span>
            <input
              type="range"
              min={-60}
              max={60}
              value={offsetY}
              onChange={(e) => setOffsetY(clamp(Number(e.target.value), -60, 60))}
            />
          </label>
          <label className="stack">
            <span className="label">邊距 {pad}px</span>
            <input
              type="range"
              min={0}
              max={120}
              value={pad}
              onChange={(e) => setPad(clamp(Number(e.target.value), 0, 120))}
            />
          </label>
        </>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[
        { label: '模糊', value: `${clamp(blur, 0, 80)}px` },
        { label: 'X 位移', value: `${clamp(offsetX, -60, 60)}px` },
        { label: 'Y 位移', value: `${clamp(offsetY, -60, 60)}px` },
        { label: '邊距', value: `${p}px` },
      ]}
    />
  )
}
