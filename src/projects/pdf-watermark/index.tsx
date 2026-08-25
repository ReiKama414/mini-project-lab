import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-watermark',
  title: 'PDF 浮水印',
  description: '為 PDF 每一頁加上文字浮水印。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-watermark') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [text, setText] = useLocalStorage('lab:pdf-watermark:text', 'CONFIDENTIAL')
  const [opacity, setOpacity] = useLocalStorage('lab:pdf-watermark:opacity', 25)
  const [size, setSize] = useLocalStorage('lab:pdf-watermark:size', 48)
  const [angle, setAngle] = useLocalStorage('lab:pdf-watermark:angle', -30)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    setProgress('讀取 PDF…')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${n} 頁）`)
        setFile(null)
        setPageCount(0)
        return
      }
      setPageCount(n)
      setFile(f)
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
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
      if (pages.length > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁）`)
        return
      }
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const line = limitText(text.trim(), TEXT_MAX)
      const alpha = clamp(opacity, 5, 80) / 100
      const fontSize = clamp(size, 12, 120)
      for (let i = 0; i < pages.length; i++) {
        setProgress(`浮水印第 ${i + 1}/${pages.length} 頁`)
        const page = pages[i]!
        const { width, height } = page.getSize()
        page.drawText(line, {
          x: width / 2 - font.widthOfTextAtSize(line, fontSize) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
          opacity: alpha,
          rotate: degrees(clamp(angle, -90, 90)),
        })
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-watermark.pdf`,
      )
    } catch {
      setError('加上浮水印失敗（中文建議改用簽名工具以影像嵌入）')
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
        本機為每頁加上文字浮水印（Helvetica，英數較佳）。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">上傳 PDF</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
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
        <button type="button" className="btn accent" disabled={!file || !isNonEmpty(text) || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
