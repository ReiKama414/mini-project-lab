import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

const fallback: ProjectMeta = {
  slug: 'pdf-split',
  title: 'PDF 分割',
  description: '依頁碼範圍或逐頁分割 PDF。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-split') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [range, setRange] = useState('1-1')
  const [mode, setMode] = useState<'range' | 'each'>('range')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

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
      if (n < 1) {
        setError('此 PDF 沒有頁面')
        return
      }
      setPageCount(n)
      setFile(f)
      setRange(`1-${n}`)
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function parseRanges(text: string, max: number): number[][] {
    const parts = text.split(/[,，\s]+/).filter(Boolean)
    const groups: number[][] = []
    for (const p of parts) {
      const m = p.match(/^(\d+)(?:-(\d+))?$/)
      if (!m) continue
      let a = clamp(Number(m[1]), 1, max)
      let b = clamp(Number(m[2] ?? m[1]), 1, max)
      if (a > b) [a, b] = [b, a]
      const pages: number[] = []
      for (let i = a; i <= b; i++) pages.push(i - 1)
      if (pages.length) groups.push(pages)
    }
    return groups
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = src.getPageCount()
      if (n > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${n} 頁）`)
        return
      }
      if (mode === 'each') {
        const zip = new JSZip()
        for (let i = 0; i < n; i++) {
          setProgress(`分割第 ${i + 1}/${n} 頁`)
          const doc = await PDFDocument.create()
          const [p] = await doc.copyPages(src, [i])
          doc.addPage(p!)
          zip.file(`page-${String(i + 1).padStart(3, '0')}.pdf`, await doc.save())
        }
        setProgress('打包 ZIP…')
        downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-split-pages.zip')
      } else {
        const groups = parseRanges(limitText(range, 200), n)
        if (!groups.length) {
          setError('請輸入有效頁碼，如 1-3,5')
          return
        }
        if (groups.length === 1) {
          setProgress('產生 PDF…')
          const doc = await PDFDocument.create()
          const pages = await doc.copyPages(src, groups[0]!)
          pages.forEach((p) => doc.addPage(p))
          downloadBlob(new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }), 'split.pdf')
        } else {
          const zip = new JSZip()
          for (let i = 0; i < groups.length; i++) {
            setProgress(`產生第 ${i + 1}/${groups.length} 份`)
            const doc = await PDFDocument.create()
            const pages = await doc.copyPages(src, groups[i]!)
            pages.forEach((p) => doc.addPage(p))
            zip.file(`part-${i + 1}.pdf`, await doc.save())
          }
          setProgress('打包 ZIP…')
          downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-split.zip')
        }
      }
    } catch {
      setError('分割失敗')
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
          {busy ? '處理中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機分割 PDF，支援範圍與逐頁 ZIP。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <FileDrop
          accept="application/pdf"
          maxBytes={PDF_MAX}
          disabled={busy}
          label="拖放 PDF 到此，或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="row">
          <button
            type="button"
            className={`btn sm ${mode === 'range' ? 'accent' : 'ghost'}`}
            disabled={busy}
            onClick={() => setMode('range')}
          >
            頁碼範圍
          </button>
          <button
            type="button"
            className={`btn sm ${mode === 'each' ? 'accent' : 'ghost'}`}
            disabled={busy}
            onClick={() => setMode('each')}
          >
            逐頁分割
          </button>
        </div>
        {mode === 'range' && (
          <label className="stack">
            <span className="label">頁碼（例：1-3,5）</span>
            <input
              className="field"
              value={range}
              maxLength={200}
              disabled={busy}
              onChange={(e) => setRange(limitText(e.target.value, 200))}
            />
          </label>
        )}
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '分割並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
