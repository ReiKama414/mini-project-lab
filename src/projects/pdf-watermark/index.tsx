import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { PdfThumbGrid } from '../../components/PdfThumbGrid'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import {
  PDF_ACCEPT,
  PDF_MAX_BYTES,
  PDF_MAX_PAGES,
  assertPdfFile,
  watermarkTilePngBytes,
} from '../../lib/pdf'
import { usePdfThumbs } from '../../lib/usePdfThumbs'

const fallback: ProjectMeta = {
  slug: 'pdf-watermark',
  title: 'PDF 浮水印',
  description: '為 PDF 每一頁加上文字浮水印。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-watermark') ?? fallback
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [text, setText] = useLocalStorage('lab:pdf-watermark:text', '僅供核對使用')
  const [opacity, setOpacity] = useLocalStorage('lab:pdf-watermark:opacity', 25)
  const [size, setSize] = useLocalStorage('lab:pdf-watermark:size', 48)
  const [angle, setAngle] = useLocalStorage('lab:pdf-watermark:angle', -30)
  const [color, setColor] = useLocalStorage('lab:pdf-watermark:color', '#333333')
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
    if (!file || !isNonEmpty(text)) return
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const pages = doc.getPages()
      if (pages.length > PDF_MAX_PAGES) {
        setError(`頁數過多（上限 ${PDF_MAX_PAGES} 頁）`)
        return
      }
      const line = limitText(text.trim(), TEXT_MAX)
      const alpha = clamp(opacity, 5, 80) / 100
      const fontSize = clamp(size, 12, 120)
      for (let i = 0; i < pages.length; i++) {
        setProgress(`浮水印第 ${i + 1}/${pages.length} 頁`)
        const page = pages[i]!
        const { width, height } = page.getSize()
        const png = await watermarkTilePngBytes(line, {
          pageW: width,
          pageH: height,
          fontSize,
          angle: clamp(angle, -90, 90),
          color,
          opacity: alpha,
        })
        const img = await doc.embedPng(png)
        page.drawImage(img, { x: 0, y: 0, width, height })
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-watermark.pdf`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '加上浮水印失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn sm accent"
          disabled={!file || !isNonEmpty(text) || busy}
          onClick={() => void run()}
        >
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        以影像嵌入浮水印，支援中文。單檔上限 {formatBytes(PDF_MAX_BYTES)}，最多 {PDF_MAX_PAGES} 頁。
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
          <label className="label">浮水印文字</label>
          <input
            className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
            value={text}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(text)} / {TEXT_MAX}
            </span>
          </div>
        </div>
        <div className="grid-2">
          <label className="stack">
            <span className="label">透明度 {opacity}%</span>
            <input
              type="range"
              min={5}
              max={80}
              disabled={busy}
              value={opacity}
              onChange={(e) => setOpacity(clamp(Number(e.target.value), 5, 80))}
            />
          </label>
          <label className="stack">
            <span className="label">字級 {size}</span>
            <input
              type="range"
              min={12}
              max={120}
              disabled={busy}
              value={size}
              onChange={(e) => setSize(clamp(Number(e.target.value), 12, 120))}
            />
          </label>
          <label className="stack">
            <span className="label">角度 {angle}°</span>
            <input
              type="range"
              min={-90}
              max={90}
              disabled={busy}
              value={angle}
              onChange={(e) => setAngle(clamp(Number(e.target.value), -90, 90))}
            />
          </label>
          <label className="stack">
            <span className="label">顏色</span>
            <input type="color" value={color} disabled={busy} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn accent" disabled={!file || !isNonEmpty(text) || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
