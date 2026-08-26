import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-compressor',
  title: '圖片壓縮',
  description: '以品質與最長邊壓縮圖片。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-compressor') ?? fallback

export default function Page() {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [origSize, setOrigSize] = useState(0)
  const [outSize, setOutSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [format, setFormat] = useLocalStorage<'image/jpeg' | 'image/webp'>('lab:image-compressor:fmt', 'image/jpeg')
  const [quality, setQuality] = useLocalStorage('lab:image-compressor:q', 0.75)
  const [maxSide, setMaxSide] = useLocalStorage('lab:image-compressor:max', 1920)

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
      setOutSize(blob.size)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
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

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      setOrigSize(file.size)
      setFileName(file.name)
      imgRef.current = await loadImageFromFile(file)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    if (!previewUrl || !hasImage) return
    const ext = format === 'image/webp' ? 'webp' : 'jpg'
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `${fileName.replace(/\.[^.]+$/, '') || 'image'}-compressed.${ext}`
    a.click()
  }

  const ratio = origSize > 0 && outSize > 0 ? Math.round((1 - outSize / origSize) * 100) : null

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage || busy} onClick={download}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>本機壓縮，調整參數會即時重算。不會上傳。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <FileDrop
            accept={IMAGE_ACCEPT}
            maxBytes={IMAGE_MAX_BYTES}
            label="拖放圖片到此，或點擊選擇"
            hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
            onFiles={(files) => void onFile(files[0] ?? null)}
          />
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · 原始 {formatBytes(origSize)}
              {outSize ? ` → ${formatBytes(outSize)}` : ''}
              {ratio !== null ? `（約 ${ratio > 0 ? '-' : '+'}${Math.abs(ratio)}%）` : ''}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <label className="stack">
            <span className="label">輸出格式</span>
            <select className="field" value={format} onChange={(e) => setFormat(e.target.value as 'image/jpeg' | 'image/webp')}>
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
            <input type="range" min={200} max={6000} step={10} value={maxSide} onChange={(e) => setMaxSide(clamp(Number(e.target.value), 200, 6000))} />
          </label>
          {busy && <p className="field-hint">處理中…</p>}
          <button type="button" className="btn accent" disabled={!hasImage || busy} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {previewUrl ? (
            <img src={previewUrl} alt="preview" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>
              上傳後預覽
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
