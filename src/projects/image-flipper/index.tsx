import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadCanvas, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-flipper',
  title: '圖片翻轉',
  description: '水平／垂直翻轉圖片',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-flipper') ?? fallback

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()
  const [hFlip, setHFlip] = useLocalStorage('lab:image-flipper:h', false)
  const [vFlip, setVFlip] = useLocalStorage('lab:image-flipper:v', false)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.save()
    ctx.translate(hFlip ? out.width : 0, vFlip ? out.height : 0)
    ctx.scale(hFlip ? -1 : 1, vFlip ? -1 : 1)
    ctx.drawImage(src, 0, 0)
    ctx.restore()
  }, [hFlip, vFlip, srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-flip.png`)
  }

  const flipLabel =
    hFlip && vFlip ? '水平＋垂直' : hFlip ? '水平' : vFlip ? '垂直' : '無'

  return (
    <ImageWorkbench
      meta={meta}
      hint="水平／垂直翻轉，可疊加。僅本機處理。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      onFile={(file) => void onFile(file)}
      onDownload={download}
      controls={
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn sm ${hFlip ? 'accent' : 'ghost'}`}
            onClick={() => setHFlip(!hFlip)}
          >
            水平翻轉
          </button>
          <button
            type="button"
            className={`btn sm ${vFlip ? 'accent' : 'ghost'}`}
            onClick={() => setVFlip(!vFlip)}
          >
            垂直翻轉
          </button>
        </div>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[
        { label: '水平翻轉', value: hFlip ? '是' : '否' },
        { label: '垂直翻轉', value: vFlip ? '是' : '否' },
        { label: '翻轉模式', value: flipLabel },
      ]}
    />
  )
}
