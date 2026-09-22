import { getProject, type ProjectMeta } from '../registry'
import { ImageWorkbench, ImageUrlPreview } from '../../components/ImageWorkbench'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { canvasFromImage, imageBaseName } from '../../lib/imageCanvas'
import { useImageFile } from '../../lib/useImageSource'

const fallback: ProjectMeta = {
  slug: 'image-compressor',
  title: '圖片壓縮',
  description: '以品質與最長邊壓縮圖片',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-compressor') ?? fallback

export default function Page() {
  const { imgRef, fileName, fileSize, width, height, error, setError, hasImage, onFile } = useImageFile()
  const previewRef = useRef('')
  const [outSize, setOutSize] = useState(0)
  const [outW, setOutW] = useState(0)
  const [outH, setOutH] = useState(0)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [format, setFormat] = useLocalStorage<'image/jpeg' | 'image/webp'>('lab:image-compressor:fmt', 'image/jpeg')
  const [quality, setQuality] = useLocalStorage('lab:image-compressor:q', 0.75)
  const [maxSide, setMaxSide] = useLocalStorage('lab:image-compressor:max', 1920)

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

  async function process() {
    const img = imgRef.current
    if (!img) return
    setBusy(true)
    try {
      const max = clamp(maxSide, 200, 6000)
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const { canvas } = canvasFromImage(img, w, h)
      const q = clamp(quality, 0.1, 0.95)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, format, q))
      if (!blob) throw new Error('壓縮失敗')
      setOutW(w)
      setOutH(h)
      setOutSize(blob.size)
      setPreview(URL.createObjectURL(blob))
      setError('')
    } catch {
      setError('無法壓縮圖片（此瀏覽器可能不支援所選格式）')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!hasImage) return
    void process()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, maxSide, format, hasImage])

  async function handleFile(file: File | null) {
    if (await onFile(file)) void process()
  }

  function download() {
    if (!previewUrl || !hasImage) return
    const ext = format === 'image/webp' ? 'webp' : 'jpg'
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `${imageBaseName(fileName)}-compressed.${ext}`
    a.click()
  }

  const ratio = fileSize > 0 && outSize > 0 ? Math.round((1 - outSize / fileSize) * 100) : null

  return (
    <ImageWorkbench
      meta={meta}
      hint="本機壓縮，調整參數會即時重算；僅本機處理，不會上傳。"
      fileName={fileName}
      fileSize={fileSize}
      width={width}
      height={height}
      outWidth={outW || width}
      outHeight={outH || height}
      error={error}
      hasImage={hasImage}
      busy={busy}
      onFile={(f) => void handleFile(f)}
      onDownload={download}
      downloadLabel="下載"
      preview={<ImageUrlPreview url={previewUrl} />}
      infoExtra={[
        { label: '原始檔案', value: fileSize ? formatBytes(fileSize) : '—' },
        { label: '輸出檔案', value: outSize ? formatBytes(outSize) : '—' },
        {
          label: '壓縮率',
          value: ratio !== null ? `約 ${ratio > 0 ? '-' : '+'}${Math.abs(ratio)}%` : '—',
        },
        { label: '格式', value: format === 'image/webp' ? 'WebP' : 'JPEG' },
        { label: '品質', value: `${Math.round(quality * 100)}%` },
        { label: '最長邊', value: `${maxSide}px` },
      ]}
      controls={
        <>
          <label className="stack">
            <span className="label">輸出格式</span>
            <select
              className="field"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'image/jpeg' | 'image/webp')}
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </label>
          <label className="stack">
            <span className="label">品質 {Math.round(quality * 100)}%</span>
            <input
              type="range"
              min={10}
              max={95}
              value={Math.round(quality * 100)}
              onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.1, 0.95))}
            />
          </label>
          <label className="stack">
            <span className="label">最長邊 {maxSide}px</span>
            <input
              type="range"
              min={200}
              max={6000}
              step={10}
              value={maxSide}
              onChange={(e) => setMaxSide(clamp(Number(e.target.value), 200, 6000))}
            />
          </label>
        </>
      }
    />
  )
}
