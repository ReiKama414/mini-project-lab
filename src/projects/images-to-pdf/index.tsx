import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPdfFaq, ftPdfInfoItems } from '../../components/FeatureLayout'
import { FtPdfFileMetrics, FtSection } from '../../components/FeatureToolUI'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'images-to-pdf',
  title: '圖片轉 PDF',
  description: '將多張圖片合併成 PDF',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('images-to-pdf') ?? fallback
const MAX_FILES = 30

function revokeAll(urls: string[]) {
  for (const u of urls) {
    if (u) URL.revokeObjectURL(u)
  }
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [margin, setMargin] = useLocalStorage('lab:images-to-pdf:margin', 24)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const previewsRef = useRef<string[]>([])
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    return () => {
      revokeAll(previewsRef.current)
    }
  }, [])

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
    revokeAll(previewsRef.current)
    setPreviews(arr.map((f) => URL.createObjectURL(f)))
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

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setFiles((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })
    setPreviews((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item ?? '')
      return next
    })
  }

  function move(i: number, dir: -1 | 1) {
    reorder(i, i + dir)
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
    <FeatureLayout
      meta={meta}
      actions={
        <ActionButton
          className="btn sm accent"
          icon="download"
          disabled={!files.length || busy}
          onClick={() => void run()}
        >
          {busy ? '轉換中…' : '下載 PDF'}
        </ActionButton>
      }
      toolbar={
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          multiple
          maxFiles={MAX_FILES}
          disabled={busy}
          label="拖放圖片到此，或點擊選擇（可多選）"
          hint={`單張上限 ${formatBytes(IMAGE_MAX_BYTES)} · 最多 ${MAX_FILES} 張 · JPG／PNG／WebP／GIF`}
          onFiles={(picked) => onFiles(picked)}
        />
      }
      infoItems={ftPdfInfoItems([
        { label: '單張大小上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '圖片數量', value: `最多 ${MAX_FILES} 張` },
        { label: '輸出', value: '單一 PDF（每圖一頁）' },
      ])}
      faq={ftPdfFaq}
      footerHint="可拖曳列表調整頁面順序。"
    >
      <div className="ft-pdf-stack">
        <FtPdfFileMetrics
          extra={
            files.length
              ? [
                  { label: '圖片數', value: `${files.length} 張` },
                  { label: '總大小', value: formatBytes(files.reduce((n, f) => n + f.size, 0)) },
                  ...(busy && progress ? [{ label: '狀態', value: progress }] : []),
                ]
              : []
          }
        />
        {error && <p className="field-error">{error}</p>}
        {files.length > 0 && (
          <FtSection title="版面" hint="WebP／GIF 會先轉成 PNG 再嵌入 PDF。">
            <label className="stack">
              <span className="label">頁面邊距 {margin}px</span>
              <input
                type="range"
                min={0}
                max={80}
                disabled={busy}
                value={margin}
                onChange={(e) => setMargin(clamp(Number(e.target.value), 0, 80))}
              />
            </label>
          </FtSection>
        )}
        <div className="stack" style={{ gap: 8 }}>
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
              className="row"
              draggable={!busy}
              onDragStart={() => {
                dragFrom.current = i
              }}
              onDragEnd={() => {
                dragFrom.current = null
                setDragOver(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(i)
              }}
              onDragLeave={() => {
                setDragOver((cur) => (cur === i ? null : cur))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFrom.current
                setDragOver(null)
                if (from == null) return
                reorder(from, i)
                dragFrom.current = null
              }}
              style={{
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                padding: '6px 4px',
                borderRadius: 8,
                border: dragOver === i ? '1px dashed var(--accent, #888)' : '1px solid transparent',
                cursor: busy ? 'default' : 'grab',
                opacity: busy ? 0.7 : 1,
              }}
            >
              <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
                {previews[i] ? (
                  <img
                    src={previews[i]}
                    alt={f.name}
                    style={{
                      width: 40,
                      height: 40,
                      objectFit: 'cover',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      background: '#fff',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      border: '1px dashed var(--line)',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span style={{ fontSize: 13 }}>
                  {i + 1}. {f.name} · {formatBytes(f.size)}
                </span>
              </div>
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
      </div>
    </FeatureLayout>
  )
}
