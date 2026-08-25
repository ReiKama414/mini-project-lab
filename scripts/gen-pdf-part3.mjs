/**
 * PDF tools part 3 — remaining
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectsDir = path.join(root, 'src', 'projects')
const PDF_MAX = 25 * 1024 * 1024

function write(slug, content) {
  const dir = path.join(projectsDir, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.tsx'), content.trimStart())
  console.log('wrote', slug)
}

write('pdf-sign', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-sign', title: 'PDF 簽名', description: '在 PDF 末頁或指定頁加上簽名文字／手寫。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-sign') ?? fallback
const PDF_MAX = ${PDF_MAX}
const NAME_MAX = 60

export default function Page() {
  const padRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useLocalStorage('lab:pdf-sign:name', '')
  const [pageNum, setPageNum] = useLocalStorage('lab:pdf-sign:page', 0)
  const [pageCount, setPageCount] = useState(0)

  function clearPad() {
    const c = padRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = padRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
      setPageNum(doc.getPageCount())
      setFile(f)
      setError('')
      requestAnimationFrame(() => {
        const c = padRef.current
        if (!c) return
        c.width = 480
        c.height = 160
        clearPad()
      })
    } catch { setError('無法讀取 PDF') }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const idx = clamp(pageNum, 1, doc.getPageCount()) - 1
      const page = doc.getPage(idx)
      const { width } = page.getSize()
      const pad = padRef.current
      if (pad) {
        const png = await new Promise<Blob | null>((res) => pad.toBlob(res, 'image/png'))
        if (png) {
          const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()))
          const w = 180
          const h = (img.height / img.width) * w
          page.drawImage(img, { x: width - w - 36, y: 36, width: w, height: h })
        }
      }
      if (isNonEmpty(name)) {
        const font = await doc.embedFont(StandardFonts.HelveticaOblique)
        page.drawText(limitText(name.trim(), NAME_MAX), { x: width - 220, y: 28, size: 11, font, color: rgb(0.15, 0.15, 0.15) })
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-signed.pdf\`)
    } catch { setError('簽名失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>在簽名板上手寫，並可附加簽署人姓名。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <label className="stack"><span className="label">簽署頁碼（1–{pageCount || '—'}）</span><input className="field" type="number" min={1} max={Math.max(1, pageCount)} value={pageNum || 1} onChange={(e) => setPageNum(clamp(Number(e.target.value) || 1, 1, Math.max(1, pageCount)))} /></label>
        <div className="field-wrap"><label className="label">簽署人姓名</label><input className="field" value={name} maxLength={NAME_MAX} onChange={(e) => setName(limitText(e.target.value, NAME_MAX))} /><div className="field-meta"><span> </span><span>{charCount(name)} / {NAME_MAX}</span></div></div>
        <div className="label">簽名板</div>
        <canvas
          ref={padRef}
          style={{ width: '100%', maxWidth: 480, height: 160, border: '1px solid var(--line)', borderRadius: 12, touchAction: 'none', cursor: 'crosshair', background: '#fff' }}
          onMouseDown={(e) => { drawing.current = true; const p = pos(e); const ctx = padRef.current!.getContext('2d')!; ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y) }}
          onMouseMove={(e) => { if (!drawing.current) return; const p = pos(e); const ctx = padRef.current!.getContext('2d')!; ctx.lineTo(p.x, p.y); ctx.stroke() }}
          onMouseUp={() => { drawing.current = false }}
          onMouseLeave={() => { drawing.current = false }}
        />
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={clearPad}>清除簽名</button>
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>套用並下載</button>
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-form-filler', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, limitText, charCount } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-form-filler', title: 'PDF 表單填寫', description: '讀取並填寫 PDF AcroForm 欄位。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-form-filler') ?? fallback
const PDF_MAX = ${PDF_MAX}
const VAL_MAX = 500

type FieldRow = { name: string; value: string }

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [fields, setFields] = useState<FieldRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const form = doc.getForm()
      const rows: FieldRow[] = form.getFields().map((field) => {
        const name = field.getName()
        let value = ''
        try {
          // @ts-expect-error optional
          value = typeof field.getText === 'function' ? String(field.getText() ?? '') : ''
        } catch { /* ignore */ }
        return { name, value: limitText(value, VAL_MAX) }
      })
      setFields(rows)
      setFile(f)
      setError(rows.length ? '' : '此 PDF 沒有可填表單欄位')
    } catch { setError('無法讀取表單') }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const form = doc.getForm()
      for (const row of fields) {
        try {
          const tf = form.getTextField(row.name)
          tf.setText(limitText(row.value, VAL_MAX))
        } catch {
          try {
            const dd = form.getDropdown(row.name)
            dd.select(limitText(row.value, VAL_MAX))
          } catch { /* skip non-text */ }
        }
      }
      form.flatten()
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-filled.pdf\`)
    } catch { setError('填寫失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || !fields.length || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>支援 AcroForm 文字欄位；匯出時會攤平表單。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳含表單的 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {fields.length} 個欄位</p>}
        {error && <p className="field-error">{error}</p>}
        {fields.map((row, i) => (
          <div key={row.name} className="field-wrap">
            <label className="label">{row.name}</label>
            <input className="field" value={row.value} maxLength={VAL_MAX} onChange={(e) => setFields((prev) => prev.map((r, j) => (j === i ? { ...r, value: limitText(e.target.value, VAL_MAX) } : r)))} />
            <div className="field-meta"><span> </span><span>{charCount(row.value)} / {VAL_MAX}</span></div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={!file || !fields.length || busy} onClick={() => void run()}>填寫並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-text-extractor', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, copyText, downloadText, limitText, charCount } from '../../lib/utils'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = { slug: 'pdf-text-extractor', title: 'PDF 文字擷取', description: '從 PDF 擷取可選文字。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-text-extractor') ?? fallback
const PDF_MAX = ${PDF_MAX}
const TEXT_MAX = 200000

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setBusy(true)
    setError('')
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      const parts: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const line = content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
        parts.push(\`--- 第 \${i} 頁 ---\\n\${line}\`)
      }
      setText(limitText(parts.join('\\n\\n'), TEXT_MAX))
      setFileName(f.name)
    } catch { setError('擷取失敗（可能為掃描影像 PDF）') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!text} onClick={() => void copyText(text)}>複製</button>
          <button type="button" className="btn sm accent" disabled={!text} onClick={() => downloadText((fileName.replace(/\\.pdf$/i, '') || 'pdf') + '-text.txt', text)}>下載 TXT</button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>僅擷取內嵌文字層；掃描檔需先 OCR。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {fileName && <p className="muted" style={{ margin: 0 }}>{fileName}{busy ? ' · 擷取中…' : ''}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">文字內容</label>
          <textarea className="field" rows={16} value={text} maxLength={TEXT_MAX} onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))} placeholder="上傳後顯示…" />
          <div className="field-meta"><span> </span><span>{charCount(text)} / {TEXT_MAX}</span></div>
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-viewer', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { clamp, formatBytes } from '../../lib/utils'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = { slug: 'pdf-viewer', title: 'PDF 檢視器', description: '本機預覽 PDF 頁面。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-viewer') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const [fileName, setFileName] = useState('')
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function render(pageNum: number, s: number) {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return
    const p = await pdf.getPage(pageNum)
    const viewport = p.getViewport({ scale: clamp(s, 0.5, 3) })
    canvas.width = viewport.width
    canvas.height = viewport.height
    await p.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
  }

  useEffect(() => {
    if (pageCount) void render(page, scale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale, pageCount])

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setBusy(true)
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      pdfRef.current = pdf
      setPageCount(pdf.numPages)
      setPage(1)
      setFileName(f.name)
      setError('')
    } catch { setError('無法開啟 PDF') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>檔案僅在瀏覽器開啟，不會上傳。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">開啟 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {fileName && <p className="muted" style={{ margin: 0 }}>{fileName} · {pageCount} 頁{busy ? ' · 載入中…' : ''}</p>}
        {error && <p className="field-error">{error}</p>}
        {pageCount > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn sm ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一頁</button>
            <span className="muted">{page} / {pageCount}</span>
            <button type="button" className="btn sm ghost" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>下一頁</button>
            <label className="stack" style={{ minWidth: 160 }}><span className="label">縮放 {scale.toFixed(1)}x</span><input type="range" min={5} max={30} value={Math.round(scale * 10)} onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 3))} /></label>
          </div>
        )}
        <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-muted)', maxHeight: 720 }}>
          <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('text-to-pdf', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'text-to-pdf', title: '文字轉 PDF', description: '將純文字匯出為 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('text-to-pdf') ?? fallback
const TEXT_MAX = 20000

export default function Page() {
  const [text, setText] = useLocalStorage('lab:text-to-pdf:text', 'Hello PDF\\n\\nThis is a local text-to-PDF demo.')
  const [size, setSize] = useLocalStorage('lab:text-to-pdf:size', 12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!isNonEmpty(text)) { setError('請輸入文字'); return }
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const fontSize = clamp(size, 8, 24)
      const margin = 48
      const pageWidth = 595
      const pageHeight = 842
      const maxWidth = pageWidth - margin * 2
      const lineHeight = fontSize * 1.4
      const paragraphs = limitText(text, TEXT_MAX).replace(/\\r\\n/g, '\\n').split('\\n')
      let page = doc.addPage([pageWidth, pageHeight])
      let y = pageHeight - margin

      const drawLine = (line: string) => {
        if (y < margin + lineHeight) {
          page = doc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) })
        y -= lineHeight
      }

      for (const para of paragraphs) {
        if (!para) { y -= lineHeight; continue }
        const words = para.split(/(\\s+)/)
        let line = ''
        for (const w of words) {
          const test = line + w
          if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
            drawLine(line)
            line = w.trimStart()
          } else line = test
        }
        if (line) drawLine(line)
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'text.pdf')
    } catch { setError('產生失敗（中文可能無法以 Helvetica 顯示）') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!isNonEmpty(text) || busy} onClick={() => void run()}>下載 PDF</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>標準字型以英數為主；中文建議先用 HTML／Markdown 轉 PDF。</p>
      <div className="panel stack">
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">文字內容</label>
          <textarea className={\`field\${!isNonEmpty(text) ? ' is-invalid' : ''}\`} rows={14} value={text} maxLength={TEXT_MAX} onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))} />
          <div className="field-meta"><span> </span><span>{charCount(text)} / {TEXT_MAX}</span></div>
        </div>
        <label className="stack"><span className="label">字級 {size}</span><input type="range" min={8} max={24} value={size} onChange={(e) => setSize(clamp(Number(e.target.value), 8, 24))} /></label>
        <button type="button" className="btn accent" disabled={!isNonEmpty(text) || busy} onClick={() => void run()}>{busy ? '產生中…' : '產生 PDF'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('html-to-pdf', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'html-to-pdf', title: 'HTML 轉 PDF', description: '將 HTML 渲染成圖片後匯出 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('html-to-pdf') ?? fallback
const HTML_MAX = 30000

export default function Page() {
  const [html, setHtml] = useLocalStorage('lab:html-to-pdf:html', '<h1>標題</h1><p>這是本機 HTML → PDF 示範。</p><ul><li>項目 A</li><li>項目 B</li></ul>')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  async function renderToCanvas(source: string) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:1100px;border:0'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(\`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;padding:24px;color:#111;}</style></head><body>\${source}</body></html>\`)
    doc.close()
    await new Promise((r) => setTimeout(r, 80))
    const body = doc.body
    const width = 800
    const height = Math.min(2000, Math.max(600, body.scrollHeight + 48))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    // foreignObject draw
    const data = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Noto Sans TC,Microsoft JhengHei,sans-serif;padding:24px;color:#111;background:#fff;">\${source}</div></foreignObject></svg>\`
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('render'))
      img.src = url
    })
    ctx.drawImage(img, 0, 0)
    document.body.removeChild(iframe)
    return canvas
  }

  async function run() {
    if (!isNonEmpty(html)) { setError('請輸入 HTML'); return }
    setBusy(true)
    setError('')
    try {
      const canvas = await renderToCanvas(limitText(html, HTML_MAX))
      setPreview(canvas.toDataURL('image/png'))
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('blob')
      const pdf = await PDFDocument.create()
      const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()))
      const page = pdf.addPage([jpg.width, jpg.height])
      page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
      downloadBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'html.pdf')
    } catch { setError('轉換失敗（部分 HTML／外連資源可能無法渲染）') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!isNonEmpty(html) || busy} onClick={() => void run()}>下載 PDF</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>以 SVG foreignObject 本機渲染後嵌入 PDF。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          {error && <p className="field-error">{error}</p>}
          <div className="field-wrap">
            <label className="label">HTML</label>
            <textarea className="field mono" rows={16} value={html} maxLength={HTML_MAX} onChange={(e) => setHtml(limitText(e.target.value, HTML_MAX))} />
            <div className="field-meta"><span> </span><span>{charCount(html)} / {HTML_MAX}</span></div>
          </div>
          <button type="button" className="btn accent" disabled={!isNonEmpty(html) || busy} onClick={() => void run()}>{busy ? '轉換中…' : '轉成 PDF'}</button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {preview ? <img src={preview} alt="preview" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} /> : <div className="muted" style={{ minHeight: 200, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>產生後顯示</div>}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('markdown-to-pdf', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'markdown-to-pdf', title: 'Markdown 轉 PDF', description: '簡易 Markdown 轉 HTML 後匯出 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('markdown-to-pdf') ?? fallback
const MD_MAX = 20000

function mdToHtml(md: string) {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\\s\\S]*?<\\/li>)/g, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/^(?!<[hulo])/gm, (line) => (line.startsWith('<') ? line : ''))
    .split(/\\n/)
    .map((line) => (/^</.test(line.trim()) ? line : line.trim() ? \`<p>\${line}</p>\` : ''))
    .join('\\n')
}

export default function Page() {
  const [md, setMd] = useLocalStorage('lab:markdown-to-pdf:md', '# 標題\\n\\n這是 **粗體** 與 *斜體*。\\n\\n- 項目一\\n- 項目二\\n')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  async function run() {
    if (!isNonEmpty(md)) { setError('請輸入 Markdown'); return }
    setBusy(true)
    setError('')
    try {
      const html = mdToHtml(limitText(md, MD_MAX))
      setPreview(html)
      const width = 800
      const height = 1100
      const data = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Noto Sans TC,Microsoft JhengHei,sans-serif;padding:32px;color:#111;background:#fff;line-height:1.6;">\${html}</div></foreignObject></svg>\`
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
      const img = new Image()
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img')); img.src = url })
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('blob')
      const pdf = await PDFDocument.create()
      const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()))
      const page = pdf.addPage([jpg.width, jpg.height])
      page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
      downloadBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'markdown.pdf')
    } catch { setError('轉換失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!isNonEmpty(md) || busy} onClick={() => void run()}>下載 PDF</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>支援標題、粗斜體、清單等簡易語法。</p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          {error && <p className="field-error">{error}</p>}
          <div className="field-wrap">
            <label className="label">Markdown</label>
            <textarea className="field mono" rows={16} value={md} maxLength={MD_MAX} onChange={(e) => setMd(limitText(e.target.value, MD_MAX))} />
            <div className="field-meta"><span> </span><span>{charCount(md)} / {MD_MAX}</span></div>
          </div>
          <button type="button" className="btn accent" disabled={!isNonEmpty(md) || busy} onClick={() => void run()}>{busy ? '轉換中…' : '轉成 PDF'}</button>
        </div>
        <div className="panel stack">
          <div className="label">HTML 預覽</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, minHeight: 200 }} dangerouslySetInnerHTML={{ __html: preview || mdToHtml(md) }} />
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-metadata', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, limitText, charCount, copyText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-metadata', title: 'PDF 中繼資料', description: '檢視與編輯 PDF 標題／作者等資訊。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-metadata') ?? fallback
const PDF_MAX = ${PDF_MAX}
const F_MAX = 120

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [subject, setSubject] = useState('')
  const [keywords, setKeywords] = useState('')
  const [creator, setCreator] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
      setTitle(limitText(doc.getTitle() ?? '', F_MAX))
      setAuthor(limitText(doc.getAuthor() ?? '', F_MAX))
      setSubject(limitText(doc.getSubject() ?? '', F_MAX))
      setKeywords(limitText((doc.getKeywords() ?? []).join(', '), F_MAX))
      setCreator(limitText(doc.getCreator() ?? '', F_MAX))
      setFile(f)
      setError('')
    } catch { setError('無法讀取 PDF') }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      doc.setTitle(limitText(title, F_MAX))
      doc.setAuthor(limitText(author, F_MAX))
      doc.setSubject(limitText(subject, F_MAX))
      doc.setKeywords(limitText(keywords, F_MAX).split(/[,，]/).map((s) => s.trim()).filter(Boolean))
      doc.setCreator(limitText(creator, F_MAX))
      doc.setModificationDate(new Date())
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-meta.pdf\`)
    } catch { setError('寫入失敗') }
    finally { setBusy(false) }
  }

  const summary = JSON.stringify({ title, author, subject, keywords, creator, pageCount }, null, 2)

  return (
    <ProjectShell meta={meta} actions={<div className="row"><button type="button" className="btn sm ghost" disabled={!file} onClick={() => void copyText(summary)}>複製 JSON</button><button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button></div>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機讀寫 PDF Info 字典。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁 · {formatBytes(file.size)}</p>}
        {error && <p className="field-error">{error}</p>}
        {([['標題', title, setTitle], ['作者', author, setAuthor], ['主旨', subject, setSubject], ['關鍵字', keywords, setKeywords], ['建立者', creator, setCreator]] as const).map(([label, value, setter]) => (
          <div key={label} className="field-wrap">
            <label className="label">{label}</label>
            <input className="field" value={value} maxLength={F_MAX} onChange={(e) => setter(limitText(e.target.value, F_MAX))} />
            <div className="field-meta"><span> </span><span>{charCount(value)} / {F_MAX}</span></div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>儲存中繼資料並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-images', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import * as pdfjs from 'pdfjs-dist'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = { slug: 'pdf-images', title: 'PDF 內嵌圖片擷取', description: '擷取 PDF 中的內嵌圖片並打包。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-images') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [images, setImages] = useState<{ url: string; name: string; blob: Blob }[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setBusy(true)
    setError('')
    images.forEach((im) => URL.revokeObjectURL(im.url))
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      const found: { url: string; name: string; blob: Blob }[] = []
      let n = 0
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const ops = await page.getOperatorList()
        const { OPS } = pdfjs
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] !== OPS.paintImageXObject && ops.fnArray[i] !== OPS.paintInlineImageXObject) continue
          const name = ops.argsArray[i]?.[0]
          if (typeof name !== 'string') continue
          try {
            const obj = await page.objs.get(name)
            if (!obj || !obj.width || !obj.height) continue
            const canvas = document.createElement('canvas')
            canvas.width = obj.width
            canvas.height = obj.height
            const ctx = canvas.getContext('2d')!
            if (obj.data) {
              const imgData = ctx.createImageData(obj.width, obj.height)
              // pdf.js ImageKind may be RGB / RGBA
              const src = obj.data as Uint8ClampedArray
              if (src.length === obj.width * obj.height * 4) imgData.data.set(src)
              else if (src.length === obj.width * obj.height * 3) {
                for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
                  imgData.data[k] = src[j]!
                  imgData.data[k + 1] = src[j + 1]!
                  imgData.data[k + 2] = src[j + 2]!
                  imgData.data[k + 3] = 255
                }
              } else continue
              ctx.putImageData(imgData, 0, 0)
            } else if (obj.bitmap) {
              ctx.drawImage(obj.bitmap, 0, 0)
            } else continue
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
            if (!blob) continue
            n++
            found.push({ url: URL.createObjectURL(blob), name: \`p\${p}-img\${n}.png\`, blob })
          } catch { /* skip */ }
        }
      }
      setImages(found)
      setFileName(f.name)
      if (!found.length) setError('未找到可擷取的內嵌圖片（或為向量／字型繪製）')
    } catch { setError('擷取失敗') }
    finally { setBusy(false) }
  }

  async function downloadZip() {
    if (!images.length) return
    const zip = new JSZip()
    for (const im of images) zip.file(im.name, im.blob)
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-images.zip')
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!images.length} onClick={() => void downloadZip()}>下載 ZIP</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>嘗試擷取 paintImageXObject 內嵌點陣圖。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {fileName && <p className="muted" style={{ margin: 0 }}>{fileName} · 找到 {images.length} 張{busy ? ' · 處理中…' : ''}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {images.map((im) => (
            <a key={im.name} href={im.url} download={im.name} title={im.name}>
              <img src={im.url} alt={im.name} style={{ width: 120, height: 120, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
            </a>
          ))}
        </div>
        <button type="button" className="btn accent" disabled={!images.length} onClick={() => void downloadZip()}>打包下載</button>
      </div>
    </ProjectShell>
  )
}
`)

console.log('pdf part3 done')
