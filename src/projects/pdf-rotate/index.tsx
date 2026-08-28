import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { PdfThumbGrid } from '../../components/PdfThumbGrid'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDF_ACCEPT, PDF_MAX_BYTES, PDF_MAX_PAGES } from '../../lib/pdf'
import { usePdfThumbs } from '../../lib/usePdfThumbs'
import { PDFDocument, degrees } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-rotate',
  title: 'PDF 旋轉',
  description: '旋轉指定頁或全部頁面（縮圖預覽）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-rotate') ?? fallback

function selectedToLabel(sel: Set<number>) {
  if (!sel.size) return '全部頁面'
  return [...sel]
    .sort((a, b) => a - b)
    .map((i) => i + 1)
    .join(', ')
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
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
      setSelected(new Set())
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
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress('旋轉頁面…')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      const indices =
        selected.size === 0
          ? doc.getPageIndices()
          : [...selected].filter((i) => i >= 0 && i < n).sort((a, b) => a - b)
      if (!indices.length) {
        setError('請選取要旋轉的頁面，或按「清除」以旋轉全部')
        return
      }
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k]!
        setProgress(`旋轉第 ${k + 1}/${indices.length} 頁`)
        const page = doc.getPage(i)
        const cur = page.getRotation().angle
        page.setRotation(degrees((cur + angle) % 360))
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-rotated.pdf`,
      )
    } catch {
      setError('旋轉失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機旋轉 PDF 頁面。單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多 {PDF_MAX_PAGES} 頁。未選取時旋轉全部。
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
        <div className="row">
          {([90, 180, 270] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`btn sm ${angle === a ? 'accent' : 'ghost'}`}
              disabled={busy}
              onClick={() => setAngle(a)}
            >
              旋轉 {a}°
            </button>
          ))}
        </div>
        {file && pageCount > 0 && (
          <>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span className="label" style={{ margin: 0 }}>
                選取頁面：{selectedToLabel(selected)}
              </span>
              <button
                type="button"
                className="btn sm ghost"
                disabled={busy || !pageCount}
                onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
              >
                全選
              </button>
              <button
                type="button"
                className="btn sm ghost"
                disabled={busy || selected.size === 0}
                onClick={() => setSelected(new Set())}
              >
                清除
              </button>
            </div>
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
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
