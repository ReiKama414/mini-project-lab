import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'images-to-pdf',
  title: '圖片轉 PDF',
  description: '將多張圖片合併成 PDF。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('images-to-pdf') ?? fallback
const MAX_FILES = 30

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [margin, setMargin] = useLocalStorage('lab:images-to-pdf:margin', 24)

  function onFiles(list: File[] | FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(`「${f.name}」過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
        return
      }
    }
    setError('')
    setFiles(arr)
  }

  async function embedImage(doc: PDFDocument, file: File) {
    const lower = file.name.toLowerCase()
    const isPng = file.type === 'image/png' || lower.endsWith('.png')
    const isJpg =
      file.type === 'image/jpeg' || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
    const needsRaster =
      file.type === 'image/webp' ||
      file.type === 'image/gif' ||
      lower.endsWith('.webp') ||
      lower.endsWith('.gif') ||
      (!isPng && !isJpg)

    if (needsRaster) {
      const img = await loadImageFromFile(file)
      const { canvas } = canvasFromImage(img)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('無法轉換圖片')
      const png = new Uint8Array(await blob.arrayBuffer())
      return doc.embedPng(png)
    }

    await loadImageFromFile(file)
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (isPng) return doc.embedPng(bytes)
    return doc.embedJpg(bytes)
  }

  function move(i: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function run() {
    if (!files.length) return
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const doc = await PDFDocument.create()
      const m = clamp(margin, 0, 80)
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        setProgress(`嵌入第 ${i + 1}/${files.length} 張`)
        const embedded = await embedImage(doc, file)
        const page = doc.addPage([embedded.width + m * 2, embedded.height + m * 2])
        page.drawImage(embedded, { x: m, y: m, width: embedded.width, height: embedded.height })
      }
      setProgress('寫入檔案…')
      downloadBlob(new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }), 'images.pdf')
    } catch {
      setError('轉換失敗（請確認為有效圖片）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!files.length || busy} onClick={() => void run()}>
          下載 PDF
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        支援 JPG／PNG；WebP／GIF 會先轉成 PNG 再嵌入。最多 {MAX_FILES} 張，單張上限 {formatBytes(IMAGE_MAX_BYTES)}。
      </p>
      <div className="panel stack">
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          multiple
          maxFiles={MAX_FILES}
          disabled={busy}
          label="拖放圖片到此，或點擊選擇（可多選）"
          hint={`單張上限 ${formatBytes(IMAGE_MAX_BYTES)} · 最多 ${MAX_FILES} 張`}
          onFiles={(files) => onFiles(files)}
        />
        {files.length > 0 && (
          <p className="muted" style={{ margin: 0 }}>
            已選 {files.length} 張 · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <label className="stack">
          <span className="label">邊距 {margin}px</span>
          <input
            type="range"
            min={0}
            max={80}
            disabled={busy}
            value={margin}
            onChange={(e) => setMargin(clamp(Number(e.target.value), 0, 80))}
          />
        </label>
        <div className="stack" style={{ gap: 8 }}>
          {files.map((f, i) => (
            <div key={f.name + f.size + i} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>
                {i + 1}. {f.name} · {formatBytes(f.size)}
              </span>
              <div className="row">
                <button type="button" className="btn sm ghost" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  上移
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={busy || i === files.length - 1}
                  onClick={() => move(i, 1)}
                >
                  下移
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn accent" disabled={!files.length || busy} onClick={() => void run()}>
          {busy ? progress || '轉換中…' : '轉成 PDF'}
        </button>
      </div>
    </ProjectShell>
  )
}
