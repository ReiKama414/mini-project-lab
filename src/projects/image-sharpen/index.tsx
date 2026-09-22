import { getProject } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadCanvas, clampByte, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const meta = getProject('image-sharpen')!

function sharpenCanvas(src: HTMLCanvasElement, out: HTMLCanvasElement, amount: number) {
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const a = clamp(amount, 0, 100) / 100
  if (a <= 0) return
  const w = src.width
  const h = src.height
  const img = ctx.getImageData(0, 0, w, h)
  const srcData = new Uint8ClampedArray(img.data)
  const d = img.data
  const k = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0
      let g = 0
      let b = 0
      let ki = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4
          const kv = k[ki++]!
          r += srcData[i]! * kv
          g += srcData[i + 1]! * kv
          b += srcData[i + 2]! * kv
        }
      }
      const i = (y * w + x) * 4
      d[i] = clampByte(r)
      d[i + 1] = clampByte(g)
      d[i + 2] = clampByte(b)
    }
  }
  ctx.putImageData(img, 0, 0)
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { srcRef, fileName, fileSize, width, height, error, hasImage, onFile } = useImageCanvasSource()
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useLocalStorage('lab:image-sharpen:amount', 40)

  const redraw = useCallback(() => {
    if (!srcRef.current || !canvasRef.current) return
    setBusy(true)
    requestAnimationFrame(() => {
      try {
        if (srcRef.current && canvasRef.current) sharpenCanvas(srcRef.current, canvasRef.current, amount)
      } finally {
        setBusy(false)
      }
    })
  }, [amount, srcRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  function download() {
    if (!canvasRef.current || !hasImage || busy) return
    downloadCanvas(canvasRef.current, `${imageBaseName(fileName)}-sharpen.png`)
  }

  return (
    <ImageWorkbench
      meta={meta}
      hint="簡易 3×3 卷積銳化，非專業 Unsharp Mask；大圖處理會變慢。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      busy={busy}
      onFile={onFile}
      onDownload={download}
      downloadLabel="下載 PNG"
      infoExtra={[
        { label: '銳化強度', value: String(amount) },
        { label: '演算法', value: '3×3 卷積' },
      ]}
      controls={
        <label className="stack">
          <span className="label">銳化強度 {amount}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(clamp(Number(e.target.value), 0, 100))}
          />
        </label>
      }
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
    />
  )
}
