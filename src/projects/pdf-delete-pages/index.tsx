import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { PdfThumbGrid } from '../../components/PdfThumbGrid'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDF_ACCEPT, PDF_MAX_BYTES, PDF_MAX_PAGES } from '../../lib/pdf'
import { usePdfThumbs } from '../../lib/usePdfThumbs'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-delete-pages',
  title: 'PDF 刪除頁面',
  description: '刪除指定頁碼後下載新 PDF（縮圖預覽）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-delete-pages') ?? fallback

function selectedToText(sel: Set<number>) {
  return [...sel]
    .sort((a, b) => a - b)
    .map((i) => i + 1)
    .join(',')
}

function textToSelected(text: string, n: number): Set<number> {
  const next = new Set<number>()
  for (const part of text.split(/[,，\s]+/)) {
    if (!part) continue
    const num = Number(part)
    if (!Number.isFinite(num)) continue
    const i = Math.trunc(num) - 1
    if (i >= 0 && i < n) next.add(i)
  }
  return next
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const { thumbs, loading: thumbsLoading, progress: thumbsProgress } = usePdfThumbs(file, pageCount)

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
    setBusy(true)
    setError('')
    setProgress('讀取 PDF…')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > PDF_MAX_PAGES) {
        setError(`頁數過多（上限 ${PDF_MAX_PAGES} 頁，目前 ${n} 頁）`)
        setFile(null)
        setPageCount(0)
        setSelected(new Set())
        return
      }
      setPageCount(n)
      setFile(f)
      setSelected(new Set(n > 0 ? [0] : []))
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function togglePage(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
    setError('')
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress('處理中…')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = src.getPageCount()
      const remove = new Set([...selected].filter((i) => i >= 0 && i < n))
      if (!remove.size) {
        setError('請選取要刪除的頁面')
        return
      }
      if (remove.size >= n) {
        setError('不能刪除全部頁面')
        return
      }
      setProgress('產生新 PDF…')
      const keep = src.getPageIndices().filter((i) => !remove.has(i))
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, keep)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(
        new Blob([Uint8Array.from(await out.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-trimmed.pdf`,
      )
    } catch {
      setError('處理失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const delText = selectedToText(selected)
  const wouldDeleteAll = pageCount > 0 && selected.size >= pageCount

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn sm accent"
          disabled={!file || busy || !selected.size || wouldDeleteAll}
          onClick={() => void run()}
        >
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機刪除指定頁，其餘頁保留。單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多 {PDF_MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <FileDrop
          accept={PDF_ACCEPT}
          maxBytes={PDF_MAX_BYTES}
          disabled={busy}
          label="拖放 PDF 到此，或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX_BYTES)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
            {thumbsLoading && thumbsProgress ? ` · ${thumbsProgress}` : ''}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {file && pageCount > 0 && (
          <>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span className="label" style={{ margin: 0 }}>
                要刪除：{delText || '（尚未選取）'}
              </span>
              <button
                type="button"
                className="btn sm ghost"
                disabled={busy || selected.size === 0}
                onClick={() => setSelected(new Set())}
              >
                清除
              </button>
            </div>
            <label className="stack">
              <span className="label">頁碼（與縮圖同步，例：2,4,7）</span>
              <input
                className="field"
                value={delText}
                maxLength={120}
                disabled={busy}
                onChange={(e) => setSelected(textToSelected(e.target.value, pageCount))}
                placeholder="例：2,4,7"
              />
            </label>
            {wouldDeleteAll && <p className="field-error">不能刪除全部頁面，請至少保留一頁</p>}
            {thumbsLoading && <p className="field-hint">{thumbsProgress || '載入縮圖中…'}</p>}
            <PdfThumbGrid
              pageCount={pageCount}
              thumbs={thumbs}
              loading={thumbsLoading}
              selected={selected}
              onToggle={togglePage}
            />
          </>
        )}
        <button
          type="button"
          className="btn accent"
          disabled={!file || busy || !selected.size || wouldDeleteAll}
          onClick={() => void run()}
        >
          {busy ? progress || '處理中…' : '刪除並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
