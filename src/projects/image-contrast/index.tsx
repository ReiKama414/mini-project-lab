import { getProject } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, mapPixels, clampByte, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const meta = getProject('image-contrast')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()
  const [amount, setAmount] = useLocalStorage('lab:image-contrast:amount', 0)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    const v = clamp(amount, -100, 100)
    const f = (259 * (v + 255)) / (255 * (259 - v))
    mapPixels(out, (r, g, b, a) => [
      clampByte(f * (r - 128) + 128),
      clampByte(f * (g - 128) + 128),
      clampByte(f * (b - 128) + 128),
      a,
    ])
  }, [amount, srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-contrast.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="以對比公式調整像素，非專業調色；大圖可能較慢。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={onFile}
      onDownload={download}
      downloadLabel="下載 PNG"
      infoExtra={[{ label: '對比', value: String(amount) }]}
      controls={
        <label className="stack">
          <span className="label">對比 {amount}</span>
          <input
            type="range"
            min={-100}
            max={100}
            value={amount}
            onChange={(e) => setAmount(clamp(Number(e.target.value), -100, 100))}
          />
        </label>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
    />
  )
}
