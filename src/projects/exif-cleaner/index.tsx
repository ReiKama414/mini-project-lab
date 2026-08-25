import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, copyText } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import exifr from 'exifr'

const fallback: ProjectMeta = {
  slug: 'exif-cleaner',
  title: 'EXIF 清除器',
  description: '檢視並清除圖片 EXIF 後重新匯出。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility', 'security'],
}
const meta = getProject('exif-cleaner') ?? fallback

function pickMime(file: File): { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: string; quality?: number } {
  const t = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (t === 'image/png' || name.endsWith('.png')) return { mime: 'image/png', ext: 'png' }
  if (t === 'image/webp' || name.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp', quality: 0.92 }
  return { mime: 'image/jpeg', ext: 'jpg', quality: 0.92 }
}

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [exif, setExif] = useState<Record<string, unknown> | null>(null)
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null)
  const [outExt, setOutExt] = useState('jpg')
  const [origSize, setOrigSize] = useState(0)
  const [note, setNote] = useState('')

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    setBusy(true)
    setError('')
    setNote('')
    try {
      setOrigSize(file.size)
      setFileName(file.name)
      const data = await exifr.parse(file).catch(() => null)
      setExif(data && typeof data === 'object' ? (data as Record<string, unknown>) : null)
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      const fmt = pickMime(file)
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, fmt.mime, fmt.quality),
      )
      if (!blob) throw new Error('匯出失敗')
      setCleanBlob(blob)
      setOutExt(fmt.ext)
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      if (fmt.mime === 'image/png') setNote('以 PNG 重繪匯出，可保留透明並去除 EXIF。')
      else if (fmt.mime === 'image/webp') setNote('以 WebP 重繪匯出並去除 EXIF。')
      else setNote('以 JPEG 重繪匯出並去除 EXIF（有損壓縮）。')
    } catch {
      setError('無法處理圖片')
      setCleanBlob(null)
    } finally {
      setBusy(false)
    }
  }

  const entries = exif ? Object.entries(exif).slice(0, 40) : []
  const outName = `${fileName.replace(/\.[^.]+$/, '') || 'image'}-no-exif.${outExt}`

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn sm accent"
          disabled={!cleanBlob || busy}
          onClick={() => cleanBlob && downloadBlob(cleanBlob, outName)}
        >
          下載已清除
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        透過 Canvas 重繪去除 EXIF／GPS。PNG 會以 PNG 匯出以保留透明；JPEG／WebP 依原格式輸出。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(origSize)}
              {cleanBlob ? ` → ${formatBytes(cleanBlob.size)}` : ''}
            </p>
          )}
          {busy && <p className="field-hint">處理中…</p>}
          {note && <p className="field-hint">{note}</p>}
          {error && <p className="field-error">{error}</p>}
          <div className="label">偵測到的 EXIF</div>
          {entries.length ? (
            <div className="stack" style={{ maxHeight: 320, overflow: 'auto', fontSize: 13 }}>
              {entries.map(([k, v]) => (
                <div key={k} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="muted">{k}</span>
                  <span className="mono" style={{ textAlign: 'right', wordBreak: 'break-all' }}>
                    {String(v)}
                  </span>
                </div>
              ))}
              <button type="button" className="btn sm ghost" onClick={() => void copyText(JSON.stringify(exif, null, 2))}>
                複製 JSON
              </button>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{fileName ? '未偵測到 EXIF 或已為乾淨圖' : '上傳後顯示'}</p>
          )}
          <button type="button" className="btn accent" disabled={!cleanBlob || busy} onClick={() => cleanBlob && downloadBlob(cleanBlob, outName)}>
            下載無 EXIF（.{outExt}）
          </button>
        </div>
        <div className="panel stack">
          <div className="label">清除後預覽</div>
          {preview ? (
            <img
              src={preview}
              alt="preview"
              style={{
                maxWidth: '100%',
                borderRadius: 12,
                border: '1px solid var(--line)',
                background:
                  'linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
              }}
            />
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
