import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-converter',
  title: '圖片格式轉換',
  description: '在 JPG／PNG／WebP 之間轉換。',
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewRef = useRef('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasImage, setHasImage] = useState(false)
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
    const src = canvasRef.current
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

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      const img = await loadImageFromFile(file)
      canvasRef.current = canvasFromImage(img).canvas
      setFileName(file.name)
      setFileSize(file.size)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  useEffect(() => {
    if (hasImage) void refreshPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, quality, hasImage])

  async function download() {
    const src = canvasRef.current
    if (!src || !hasImage) return
    setBusy(true)
    setError('')
    try {
      const blob = await encodeBlob(src)
      if (!blob) throw new Error('fail')
      const ext = fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'
      downloadBlob(blob, `${fileName.replace(/\.[^.]+$/, '') || 'image'}.${ext}`)
    } catch {
      setError('無法匯出（此瀏覽器可能不支援所選格式）')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage || busy} onClick={() => void download()}>
          {busy ? '處理中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        經 Canvas 重編碼；動畫 GIF 只會輸出第一幀，JPEG 會以白底填透明。本機處理，不會上傳。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)}
              {outSize ? ` → ${formatBytes(outSize)}` : ''}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <div className="label">輸出格式</div>
          <div className="row">
            {([['image/png', 'PNG'], ['image/jpeg', 'JPG'], ['image/webp', 'WebP']] as [Fmt, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`} disabled={busy} onClick={() => setFmt(id)}>
                {label}
              </button>
            ))}
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
          {busy && <p className="field-hint">處理中…</p>}
          <button type="button" className="btn accent" disabled={!hasImage || busy} onClick={() => void download()}>
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
