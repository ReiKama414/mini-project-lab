import { getProject } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { downloadCanvas, mapPixels, clampByte, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const meta = getProject('image-grayscale')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    mapPixels(out, (r, g, b, a) => {
      const gray = clampByte(0.299 * r + 0.587 * g + 0.114 * b)
      return [gray, gray, gray, a]
    })
  }, [srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-grayscale.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="依 ITU-R BT.601 權重轉灰階；大圖可能較慢。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={onFile}
      onDownload={download}
      downloadLabel="下載 PNG"
      infoExtra={[{ label: '演算法', value: 'ITU-R BT.601' }]}
      controls={<p className="muted" style={{ margin: 0, fontSize: 13 }}>上傳後自動轉為黑白預覽</p>}
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
    />
  )
}
