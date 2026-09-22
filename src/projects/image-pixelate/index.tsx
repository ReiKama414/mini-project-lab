import { getProject } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const meta = getProject('image-pixelate')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()
  const [block, setBlock] = useLocalStorage('lab:image-pixelate:block', 12)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    const size = clamp(block, 2, 64)
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    const tw = Math.max(1, Math.floor(src.width / size))
    const th = Math.max(1, Math.floor(src.height / size))
    const tmp = document.createElement('canvas')
    tmp.width = tw
    tmp.height = th
    const tctx = tmp.getContext('2d')!
    tctx.imageSmoothingEnabled = false
    tctx.drawImage(src, 0, 0, tw, th)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, out.width, out.height)
  }, [block, srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-pixelate.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="整圖縮放再放大形成像素格；若需局部請用馬賽克工具。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={onFile}
      onDownload={download}
      downloadLabel="下載 PNG"
      infoExtra={[{ label: '像素格', value: `${block}px` }]}
      controls={
        <label className="stack">
          <span className="label">像素格 {block}px</span>
          <input
            type="range"
            min={2}
            max={64}
            value={block}
            onChange={(e) => setBlock(clamp(Number(e.target.value), 2, 64))}
          />
        </label>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
    />
  )
}
