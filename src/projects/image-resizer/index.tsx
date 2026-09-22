import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageCanvasPreview } from '../../components/ImageWorkbench'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { downloadBlob, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-resizer',
  title: '圖片縮放',
  description: '依寬高或最長邊縮放圖片',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-resizer') ?? fallback

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'
type Mode = 'exact' | 'maxSide'

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { imgRef, fileName, fileSize, width: srcW, height: srcH, error, setError, hasImage, onFile } =
    useImageFile()
  const [busy, setBusy] = useState(false)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [maxSide, setMaxSide] = useLocalStorage('lab:image-resizer:max', 1920)
  const [mode, setMode] = useLocalStorage<Mode>('lab:image-resizer:mode', 'exact')
  const [keepRatio, setKeepRatio] = useLocalStorage('lab:image-resizer:ratio', true)
  const [fmt, setFmt] = useLocalStorage<Fmt>('lab:image-resizer:fmt', 'image/png')
  const [quality, setQuality] = useLocalStorage('lab:image-resizer:q', 0.92)

  const targetSize = useCallback(() => {
    const img = imgRef.current
    if (!img) return { w: 1, h: 1 }
    if (mode === 'maxSide') {
      const max = clamp(maxSide, 1, 8000)
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      return {
        w: Math.max(1, Math.round(img.naturalWidth * scale)),
        h: Math.max(1, Math.round(img.naturalHeight * scale)),
      }
    }
    return { w: clamp(width, 1, 8000), h: clamp(height, 1, 8000) }
  }, [mode, maxSide, width, height, imgRef])

  const redraw = useCallback(() => {
    const img = imgRef.current
    const out = canvasRef.current
    if (!img || !out) return
    const { w, h } = targetSize()
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')!
    if (fmt === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
  }, [targetSize, fmt, imgRef])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  async function handleFile(file: File | null) {
    if (!(await onFile(file))) return
    const img = imgRef.current
    if (!img) return
    setWidth(img.naturalWidth)
    setHeight(img.naturalHeight)
  }

  function setW(v: number) {
    const w = clamp(v, 1, 8000)
    setWidth(w)
    if (keepRatio && srcW) setHeight(Math.max(1, Math.round((w * srcH) / srcW)))
  }

  function setH(v: number) {
    const h = clamp(v, 1, 8000)
    setHeight(h)
    if (keepRatio && srcH) setWidth(Math.max(1, Math.round((h * srcW) / srcH)))
  }

  async function download() {
    if (!canvasRef.current || !hasImage) return
    setBusy(true)
    setError('')
    try {
      redraw()
      const q = clamp(quality, 0.1, 1)
      const blob = await new Promise<Blob | null>((res) => canvasRef.current!.toBlob(res, fmt, q))
      if (!blob) throw new Error('匯出失敗')
      const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'
      downloadBlob(blob, `${imageBaseName(fileName)}-resized.${ext}`)
    } catch {
      setError('無法匯出（此瀏覽器可能不支援所選格式）')
    } finally {
      setBusy(false)
    }
  }

  const preview = targetSize()
  const fmtLabel = fmt === 'image/png' ? 'PNG' : fmt === 'image/webp' ? 'WebP' : 'JPG'

  return (
    <ImageWorkbench
      meta={meta}
      hint="單邊上限 8000px；JPEG 以白底填補透明。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={srcW}
      height={srcH}
      outWidth={preview.w}
      outHeight={preview.h}
      error={error}
      hasImage={hasImage}
      busy={busy}
      onFile={(f) => void handleFile(f)}
      onDownload={() => void download()}
      downloadLabel="下載"
      preview={<ImageCanvasPreview canvasRef={canvasRef} hasImage={hasImage} />}
      infoExtra={[
        { label: '模式', value: mode === 'exact' ? '寬高' : '最長邊' },
        { label: '鎖定比例', value: keepRatio ? '是' : '否' },
        { label: '格式', value: fmtLabel },
        { label: '品質', value: fmt === 'image/png' ? '無損' : `${Math.round(quality * 100)}%` },
      ]}
      controls={
        <>
          <div className="row">
            <button
              type="button"
              className={`btn sm ${mode === 'exact' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('exact')}
            >
              寬高
            </button>
            <button
              type="button"
              className={`btn sm ${mode === 'maxSide' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('maxSide')}
            >
              最長邊
            </button>
          </div>
          {mode === 'exact' ? (
            <>
              <label className="check">
                <input type="checkbox" checked={keepRatio} onChange={() => setKeepRatio(!keepRatio)} />
                鎖定比例
              </label>
              <div className="grid-2">
                <label className="stack">
                  <span className="label">寬度</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={8000}
                    value={width}
                    onChange={(e) => setW(Number(e.target.value) || 1)}
                  />
                </label>
                <label className="stack">
                  <span className="label">高度</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={8000}
                    value={height}
                    onChange={(e) => setH(Number(e.target.value) || 1)}
                  />
                </label>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {[25, 50, 75, 100, 150].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn sm ghost"
                    disabled={!srcW}
                    onClick={() => {
                      setW(Math.max(1, Math.round((srcW * p) / 100)))
                      if (!keepRatio) setHeight(Math.max(1, Math.round((srcH * p) / 100)))
                    }}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </>
          ) : (
            <label className="stack">
              <span className="label">最長邊 {maxSide}px</span>
              <input
                type="range"
                min={100}
                max={8000}
                step={10}
                value={maxSide}
                onChange={(e) => setMaxSide(clamp(Number(e.target.value), 100, 8000))}
              />
            </label>
          )}
          <div className="label">輸出格式</div>
          <div className="row">
            {([['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] as [Fmt, string][]).map(
              ([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`}
                  onClick={() => setFmt(id)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          {fmt !== 'image/png' && (
            <label className="stack">
              <span className="label">品質 {Math.round(quality * 100)}%</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 1))}
              />
            </label>
          )}
        </>
      }
    />
  )
}
