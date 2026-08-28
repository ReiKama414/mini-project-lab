import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { DeleteButton } from '../../components/DeleteButton'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import {
  PDF_ACCEPT,
  PDF_MAX_BYTES,
  PDF_MAX_PAGES,
  type PdfThumbMap,
  renderPdfPageThumbs,
  revokePdfThumbs,
} from '../../lib/pdf'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-organizer',
  title: 'PDF 頁面整理',
  description: '重新排序 PDF 頁面後下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-organizer') ?? fallback
const THUMB_SCALE = 0.25

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [thumbs, setThumbs] = useState<PdfThumbMap>({})
  const [pageCount, setPageCount] = useState(0)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingThumbs, setLoadingThumbs] = useState(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const runId = useRef(0)
  const thumbsRef = useRef<PdfThumbMap>({})
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])

  useEffect(() => {
    return () => {
      runId.current += 1
      revokePdfThumbs(thumbsRef.current)
    }
  }, [])

  function clearThumbs() {
    revokePdfThumbs(thumbsRef.current)
    setThumbs({})
  }

  async function loadThumbs(data: Uint8Array, n: number, id: number) {
    setLoadingThumbs(true)
    setProgress('')
    try {
      const next = await renderPdfPageThumbs(data, {
        pageCount: n,
        scale: THUMB_SCALE,
        isCancelled: () => id !== runId.current,
        onProgress: (p, total) => {
          if (id === runId.current) setProgress(`載入縮圖第 ${p}/${total} 頁`)
        },
      })
      if (id !== runId.current) {
        revokePdfThumbs(next)
        return
      }
      clearThumbs()
      setThumbs(next)
    } catch {
      if (id === runId.current) setError('縮圖載入失敗（仍可依頁碼排序後匯出）')
    } finally {
      if (id === runId.current) {
        setLoadingThumbs(false)
        setProgress('')
      }
    }
  }

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX_BYTES)}）`)
      return
    }
    const id = ++runId.current
    setBusy(true)
    setError('')
    setProgress('')
    clearThumbs()
    setOrder([])
    setFile(null)
    setPageCount(0)
    try {
      const buf = await f.arrayBuffer()
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > PDF_MAX_PAGES) {
        setError(`頁數過多（上限 ${PDF_MAX_PAGES} 頁，目前 ${n} 頁）`)
        return
      }
      if (n < 1) {
        setError('此 PDF 沒有頁面')
        return
      }
      setOrder(Array.from({ length: n }, (_, i) => i))
      setFile(f)
      setPageCount(n)
      setBusy(false)
      await loadThumbs(new Uint8Array(buf.slice(0)), n, id)
    } catch {
      if (id === runId.current) setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      if (id === runId.current) setBusy(false)
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setOrder((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })
  }

  function move(i: number, dir: -1 | 1) {
    reorder(i, i + dir)
  }

  function removeAt(i: number) {
    setOrder((prev) => {
      if (prev.length <= 1) {
        setError('至少需保留一頁')
        return prev
      }
      setError('')
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function run() {
    if (!file || !order.length) return
    setBusy(true)
    setError('')
    setProgress('正在產生 PDF…')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, order)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(
        new Blob([Uint8Array.from(await out.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-organized.pdf`,
      )
    } catch {
      setError('整理失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const actionsDisabled = !file || busy || loadingThumbs || !order.length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={actionsDisabled} onClick={() => void run()}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機預覽縮圖後可拖曳／上移／下移／刪除／反轉頁序。單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多{' '}
        {PDF_MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <FileDrop
          accept={PDF_ACCEPT}
          maxBytes={PDF_MAX_BYTES}
          label="拖放 PDF 到此，或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX_BYTES)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · 原 {pageCount} 頁 · 目前保留 {order.length} 頁
            {loadingThumbs && progress ? ` · ${progress}` : ''}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {loadingThumbs && <p className="field-hint">{progress || '載入縮圖中…'}</p>}
        <div className="stack" style={{ maxHeight: 480, overflow: 'auto', gap: 10 }}>
          {order.map((pageIndex, i) => (
            <div
              key={`${pageIndex}-${i}`}
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
                alignItems: 'center',
                gap: 12,
                padding: '8px 4px',
                borderBottom: '1px solid var(--line)',
                borderRadius: 6,
                border: dragOver === i ? '1px dashed var(--accent, #888)' : undefined,
                cursor: busy ? 'default' : 'grab',
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: 'center', minWidth: 0 }}>
                {thumbs[pageIndex] ? (
                  <img
                    src={thumbs[pageIndex]}
                    alt={`第 ${pageIndex + 1} 頁`}
                    style={{
                      width: 56,
                      height: 72,
                      objectFit: 'contain',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: '#fff',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 72,
                      border: '1px dashed var(--line)',
                      borderRadius: 6,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    {loadingThumbs ? '…' : pageIndex + 1}
                  </div>
                )}
                <span style={{ fontSize: 13 }}>
                  位置 {i + 1} ← 原第 {pageIndex + 1} 頁
                </span>
              </div>
              <div className="row" style={{ flexShrink: 0 }}>
                <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0 || busy}>
                  上移
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1 || busy}
                >
                  下移
                </button>
                <DeleteButton onClick={() => removeAt(i)} disabled={busy || order.length <= 1} label="刪除" />
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm ghost"
            disabled={!order.length || busy}
            onClick={() => setOrder((o) => [...o].reverse())}
          >
            整份反轉
          </button>
          <button type="button" className="btn accent" disabled={actionsDisabled} onClick={() => void run()}>
            {busy ? progress || '處理中…' : '套用並下載'}
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
