import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { PdfThumbGrid } from '../../components/PdfThumbGrid'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import { PDF_ACCEPT, PDF_MAX_BYTES, PDF_MAX_PAGES, assertPdfFile, textToPngBytes } from '../../lib/pdf'
import { usePdfThumbs } from '../../lib/usePdfThumbs'

const fallback: ProjectMeta = {
  slug: 'pdf-header-footer',
  title: 'PDF 頁首頁尾',
  description: '為每頁加上頁首與頁尾文字。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-header-footer') ?? fallback
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [header, setHeader] = useLocalStorage('lab:pdf-hf:header', '文件')
  const [footer, setFooter] = useLocalStorage('lab:pdf-hf:footer', '機密')
  const [size, setSize] = useLocalStorage('lab:pdf-hf:size', 12)
  const { thumbs, loading: thumbsLoading, progress: thumbsProgress } = usePdfThumbs(file, pageCount)

  async function onFile(f: File | null) {
    if (!f) return
    setBusy(true)
    setError('')
    setProgress('讀取 PDF…')
    try {
      assertPdfFile(f)
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > PDF_MAX_PAGES) {
        setError(`頁數過多（上限 ${PDF_MAX_PAGES} 頁，目前 ${n} 頁）`)
        setFile(null)
        setPageCount(0)
        return
      }
      setPageCount(n)
      setFile(f)
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法讀取 PDF（可能已加密或損毀）')
      setFile(null)
      setPageCount(0)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const pages = doc.getPages()
      if (pages.length > PDF_MAX_PAGES) {
        setError(`頁數過多（上限 ${PDF_MAX_PAGES} 頁）`)
        return
      }
      const fontSize = clamp(size, 8, 24)
      const hText = limitText(header, TEXT_MAX).trim()
      const fText = limitText(footer, TEXT_MAX).trim()
      const hPng = hText ? await textToPngBytes(hText, { fontSize, color: '#4d4d4d' }) : null
      const fPng = fText ? await textToPngBytes(fText, { fontSize, color: '#4d4d4d' }) : null
      const hImg = hPng ? await doc.embedPng(hPng) : null
      const fImg = fPng ? await doc.embedPng(fPng) : null

      for (let i = 0; i < pages.length; i++) {
        setProgress(`處理第 ${i + 1}/${pages.length} 頁`)
        const page = pages[i]!
        const { width, height } = page.getSize()
        if (hImg) {
          const drawH = fontSize * 1.35
          const drawW = (hImg.width / hImg.height) * drawH
          page.drawImage(hImg, {
            x: 36,
            y: height - drawH - 14,
            width: Math.min(drawW, width - 72),
            height: drawH,
          })
        }
        if (fImg) {
          const drawH = fontSize * 1.35
          const drawW = (fImg.width / fImg.height) * drawH
          const w = Math.min(drawW, width - 72)
          page.drawImage(fImg, {
            x: (width - w) / 2,
            y: 14,
            width: w,
            height: drawH,
          })
        }
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-hf.pdf`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '處理失敗')
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
        以影像嵌入頁首／頁尾，支援中文。單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多 {PDF_MAX_PAGES} 頁。
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
            {thumbsLoading && <p className="field-hint">{thumbsProgress || '載入縮圖中…'}</p>}
            <PdfThumbGrid pageCount={pageCount} thumbs={thumbs} loading={thumbsLoading} mode="view" />
          </>
        )}
        <div className="field-wrap">
          <label className="label">頁首</label>
          <input
            className="field"
            value={header}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setHeader(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(header)} / {TEXT_MAX}
            </span>
          </div>
        </div>
        <div className="field-wrap">
          <label className="label">頁尾</label>
          <input
            className="field"
            value={footer}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setFooter(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(footer)} / {TEXT_MAX}
            </span>
          </div>
        </div>
        <label className="stack">
          <span className="label">字級 {size}</span>
          <input
            type="range"
            min={8}
            max={24}
            disabled={busy}
            value={size}
            onChange={(e) => setSize(clamp(Number(e.target.value), 8, 24))}
          />
        </label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
