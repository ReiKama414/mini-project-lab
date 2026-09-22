import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageUrlPreview } from '../../components/ImageWorkbench'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob, imageBaseName } from '../../lib/imageCanvas'
import { useImageCanvasSource } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-converter',
  title: '圖片格式轉換',
  description: '在 JPG／PNG／WebP 之間轉換',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-converter') ?? fallback

type Fmt = 'image/png' | 'image/jpeg' | 'image/webp'

function canvasForFormat(src: HTMLCanvasElement, fmt: Fmt) {
  if (fmt !== 'image/jpeg') return src
  const tmp = document.createElement('canvas')
  tmp.width = src.width
  tmp.height = src.height
  const ctx = tmp.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tmp.width, tmp.height)
  ctx.drawImage(src, 0, 0)
  return tmp
}

export default function Page() {
  const { srcRef, fileName, fileSize, width, height, error, setError, hasImage, onFile } = useImageCanvasSource()
  const previewRef = useRef('')
  const [busy, setBusy] = useState(false)
  const [fmt, setFmt] = useLocalStorage<Fmt>('lab:image-converter:fmt', 'image/png')
  const [quality, setQuality] = useLocalStorage('lab:image-converter:q', 0.9)
  const [previewUrl, setPreviewUrl] = useState('')
  const [outSize, setOutSize] = useState(0)

  function setPreview(url: string) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreviewUrl(url)
  }

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  async function encodeBlob(src: HTMLCanvasElement) {
    const c = canvasForFormat(src, fmt)
    const q = clamp(quality, 0.1, 1)
    return new Promise<Blob | null>((res) => c.toBlob(res, fmt, q))
  }

  async function refreshPreview() {
    const src = srcRef.current
    if (!src) return
    setBusy(true)
    try {
      const blob = await encodeBlob(src)
      if (!blob) {
        setError('無法轉換（此瀏覽器可能不支援所選格式）')
        return
      }
      setOutSize(blob.size)
      setError('')
      setPreview(URL.createObjectURL(blob))
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file: File | null) {
    if (await onFile(file)) void refreshPreview()
  }

  useEffect(() => {
    if (hasImage) void refreshPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, quality, hasImage])

  async function download() {
    const src = srcRef.current
    if (!src || !hasImage) return
    setBusy(true)
    setError('')
    try {
      const blob = await encodeBlob(src)
      if (!blob) throw new Error('fail')
      const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'
      downloadBlob(blob, `${imageBaseName(fileName)}.${ext}`)
    } catch {
      setError('無法匯出（此瀏覽器可能不支援所選格式）')
    } finally {
      setBusy(false)
    }
  }

  const fmtLabel = fmt === 'image/png' ? 'PNG' : fmt === 'image/webp' ? 'WebP' : 'JPG'

  return (
    <ImageWorkbench
      meta={meta}
      hint="經 Canvas 重編碼；動畫 GIF 只會輸出第一幀，JPEG 會以白底填透明。僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      error={error}
      hasImage={hasImage}
      busy={busy}
      onFile={(f) => void handleFile(f)}
      onDownload={() => void download()}
      downloadLabel="下載"
      preview={<ImageUrlPreview url={previewUrl} />}
      infoExtra={[
        { label: '原始檔案', value: fileSize ? formatBytes(fileSize) : '—' },
        { label: '輸出檔案', value: outSize ? formatBytes(outSize) : '—' },
        { label: '格式', value: fmtLabel },
        { label: '品質', value: fmt === 'image/png' ? '無損' : `${Math.round(quality * 100)}%` },
      ]}
      controls={
        <>
          <div className="label">輸出格式</div>
          <div className="row">
            {([['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] as [Fmt, string][]).map(
              ([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`}
                  disabled={busy}
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
                disabled={busy}
                onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 1))}
              />
            </label>
          )}
        </>
      }
    />
  )
}
