import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDF_ACCEPT, PDF_MAX_BYTES, renderPdfFirstPageThumbs } from '../../lib/pdf'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-merge',
  title: 'PDF 合併',
  description: '將多個 PDF 合併成單一檔案（縮圖預覽）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-merge') ?? fallback
const MAX_FILES = 20
const MAX_TOTAL_PAGES = 80

function revokeAll(urls: string[]) {
  for (const u of urls) {
    if (u) URL.revokeObjectURL(u)
  }
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [thumbs, setThumbs] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [dragOver, setDragOver] = useState<number | null>(null)
  const thumbsRef = useRef<string[]>([])
  const thumbRun = useRef(0)
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])

  useEffect(() => {
    return () => {
      thumbRun.current += 1
      revokeAll(thumbsRef.current)
    }
  }, [])

  async function loadThumbs(list: File[]) {
    const id = ++thumbRun.current
    if (!list.length) {
      revokeAll(thumbsRef.current)
      setThumbs([])
      return
    }
    const next = await renderPdfFirstPageThumbs(list, { isCancelled: () => id !== thumbRun.current })
    if (id !== thumbRun.current) {
      revokeAll(next)
      return
    }
    revokeAll(thumbsRef.current)
    setThumbs(next)
  }

  function onFiles(list: File[] | FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        setError('請上傳 PDF 檔案')
        return
      }
      if (f.size > PDF_MAX_BYTES) {
        setError(`「${f.name}」過大（上限 ${formatBytes(PDF_MAX_BYTES)}）`)
        return
      }
    }
    setError('')
    setFiles(arr)
    void loadThumbs(arr)
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
    setThumbs((prev) => {
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

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setThumbs((prev) => {
      const url = prev[i]
      if (url) URL.revokeObjectURL(url)
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function merge() {
    if (files.length < 2) {
      setError('請至少選擇 2 個 PDF')
      return
    }
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const out = await PDFDocument.create()
      let totalPages = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!
        setProgress(`合併第 ${i + 1}/${files.length} 個檔案`)
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
        const n = doc.getPageCount()
        totalPages += n
        if (totalPages > MAX_TOTAL_PAGES) {
          setError(`合併後頁數過多（上限 ${MAX_TOTAL_PAGES} 頁）`)
          return
        }
        const pages = await out.copyPages(doc, doc.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      setProgress('寫入檔案…')
      const bytes = await out.save()
      downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), 'merged.pdf')
    } catch {
      setError('合併失敗（可能含加密或損毀檔）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>
          {busy ? '合併中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機合併，單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多 {MAX_FILES} 個、合併後最多 {MAX_TOTAL_PAGES}{' '}
        頁。可拖曳列表調整順序。
      </p>
      <div className="panel stack">
        <FileDrop
          accept={PDF_ACCEPT}
          maxBytes={PDF_MAX_BYTES}
          multiple
          maxFiles={MAX_FILES}
          disabled={busy}
          label="拖放 PDF 到此，或點擊選擇（可多選）"
          hint={`單檔上限 ${formatBytes(PDF_MAX_BYTES)} · 最多 ${MAX_FILES} 個`}
          onFiles={(picked) => onFiles(picked)}
        />
        {error && <p className="field-error">{error}</p>}
        {busy && progress && <p className="field-hint">{progress}</p>}
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
              {thumbs[i] ? (
                <img
                  src={thumbs[i]}
                  alt={`${f.name} 封面`}
                  style={{
                    width: 40,
                    height: 52,
                    objectFit: 'contain',
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
                    height: 52,
                    border: '1px dashed var(--line)',
                    borderRadius: 4,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    color: 'var(--muted)',
                  }}
                >
                  …
                </div>
              )}
              <span style={{ fontSize: 13 }}>
                {i + 1}. {f.name} · {formatBytes(f.size)}
              </span>
            </div>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={busy || i === 0}>
                上移
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => move(i, 1)}
                disabled={busy || i === files.length - 1}
              >
                下移
              </button>
              <button type="button" className="btn sm ghost" onClick={() => removeAt(i)} disabled={busy}>
                移除
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>
          {busy ? progress || '合併中…' : '合併並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
