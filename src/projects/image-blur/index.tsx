import { getProject } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const meta = getProject('image-blur')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()
  const [radius, setRadius] = useLocalStorage('lab:image-blur:radius', 4)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    const r = clamp(radius, 0, 20)
    ctx.filter = r > 0 ? `blur(${r}px)` : 'none'
    ctx.drawImage(src, 0, 0)
    ctx.filter = 'none'
  }, [radius, srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-blur.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="使用 Canvas CSS blur() 近似，非專業級高斯模糊。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={onFile}
      onDownload={download}
      downloadLabel="下載 PNG"
      infoExtra={[{ label: '模糊半徑', value: `${radius}px` }]}
      controls={
        <label className="stack">
          <span className="label">模糊半徑 {radius}px</span>
          <input
            type="range"
            min={0}
            max={20}
            value={radius}
            onChange={(e) => setRadius(clamp(Number(e.target.value), 0, 20))}
          />
        </label>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
    />
  )
}
