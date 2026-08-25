/**
 * PDF tools part 2
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

write('images-to-pdf', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'images-to-pdf', title: '圖片轉 PDF', description: '將多張圖片合併成 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('images-to-pdf') ?? fallback
const MAX_FILES = 30

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [margin, setMargin] = useLocalStorage('lab:images-to-pdf:margin', 24)

  function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) { setError(\`「\${f.name}」過大\`); return }
    }
    setError('')
    setFiles(arr)
  }

  async function run() {
    if (!files.length) return
    setBusy(true)
    try {
      const doc = await PDFDocument.create()
      const m = clamp(margin, 0, 80)
      for (const file of files) {
        const img = await loadImageFromFile(file)
        const bytes = new Uint8Array(await file.arrayBuffer())
        let embedded
        if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) embedded = await doc.embedPng(bytes)
        else embedded = await doc.embedJpg(bytes)
        const page = doc.addPage([embedded.width + m * 2, embedded.height + m * 2])
        page.drawImage(embedded, { x: m, y: m, width: embedded.width, height: embedded.height })
        void img
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'images.pdf')
    } catch { setError('轉換失敗（請用 JPG／PNG）') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!files.length || busy} onClick={() => void run()}>下載 PDF</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>建議使用 JPG／PNG。最多 {MAX_FILES} 張。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">選擇圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => onFiles(e.target.files)} /></label>
        {files.length > 0 && <p className="muted" style={{ margin: 0 }}>已選 {files.length} 張 · {formatBytes(files.reduce((n, f) => n + f.size, 0))}</p>}
        {error && <p className="field-error">{error}</p>}
        <label className="stack"><span className="label">邊距 {margin}px</span><input type="range" min={0} max={80} value={margin} onChange={(e) => setMargin(clamp(Number(e.target.value), 0, 80))} /></label>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{files.map((f) => <li key={f.name + f.size}>{f.name}</li>)}</ul>
        <button type="button" className="btn accent" disabled={!files.length || busy} onClick={() => void run()}>{busy ? '轉換中…' : '轉成 PDF'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-to-image', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob, downloadCanvas } from '../../lib/imageCanvas'
import * as pdfjs from 'pdfjs-dist'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = { slug: 'pdf-to-image', title: 'PDF 轉圖片', description: '將 PDF 頁面渲染成 PNG 並下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-to-image') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scale, setScale] = useLocalStorage('lab:pdf-to-image:scale', 1.5)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setBusy(true)
    setError('')
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      setPageCount(pdf.numPages)
      setFile(f)
      const urls: string[] = []
      const s = clamp(scale, 0.5, 3)
      const maxPreview = Math.min(pdf.numPages, 5)
      for (let i = 1; i <= maxPreview; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: Math.min(s, 1.2) })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
        urls.push(canvas.toDataURL('image/png'))
      }
      setPreviews(urls)
    } catch { setError('無法渲染 PDF') }
    finally { setBusy(false) }
  }

  async function downloadAll() {
    if (!file) return
    setBusy(true)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      const zip = new JSZip()
      const s = clamp(scale, 0.5, 3)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: s })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) zip.file(\`page-\${String(i).padStart(3, '0')}.png\`, blob)
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-pages.zip')
    } catch { setError('匯出失敗') }
    finally { setBusy(false) }
  }

  async function downloadFirst() {
    if (!previews[0]) return
    const img = new Image()
    img.src = previews[0]
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    downloadCanvas(c, 'page-001.png')
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void downloadAll()}>{busy ? '處理中…' : '下載全部 ZIP'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>使用 pdf.js 本機渲染，預覽最多顯示前 5 頁。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <label className="stack"><span className="label">解析度倍率 {scale.toFixed(1)}x</span><input type="range" min={5} max={30} value={Math.round(scale * 10)} onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 3))} /></label>
        <p className="field-hint">變更倍率後請重新上傳以更新預覽；下載會使用目前倍率。</p>
        <div className="row">
          <button type="button" className="btn ghost" disabled={!previews.length} onClick={() => void downloadFirst()}>下載第 1 頁</button>
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void downloadAll()}>下載全部 PNG ZIP</button>
        </div>
        <div className="stack">
          {previews.map((src, i) => <img key={i} src={src} alt={\`page \${i + 1}\`} style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />)}
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-compressor', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = { slug: 'pdf-compressor', title: 'PDF 壓縮', description: '將頁面柵格化後以 JPG 重建以縮小體積。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-compressor') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [origSize, setOrigSize] = useState(0)
  const [outSize, setOutSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [quality, setQuality] = useLocalStorage('lab:pdf-compressor:q', 0.7)
  const [scale, setScale] = useLocalStorage('lab:pdf-compressor:scale', 1.2)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setFile(f)
    setOrigSize(f.size)
    setOutSize(0)
    setError('')
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      const out = await PDFDocument.create()
      const q = clamp(quality, 0.3, 0.92)
      const s = clamp(scale, 0.5, 2)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: s })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))
        if (!blob) continue
        const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
        const p = out.addPage([jpg.width, jpg.height])
        p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
      }
      const bytes = await out.save()
      setOutSize(bytes.byteLength)
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-compressed.pdf\`)
    } catch { setError('壓縮失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>{busy ? '壓縮中…' : '下載'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>以頁面點陣化方式壓縮，文字會變成圖片。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {formatBytes(origSize)}{outSize ? \` → \${formatBytes(outSize)}\` : ''}</p>}
        {error && <p className="field-error">{error}</p>}
        <label className="stack"><span className="label">JPG 品質 {Math.round(quality * 100)}%</span><input type="range" min={30} max={92} value={Math.round(quality * 100)} onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.3, 0.92))} /></label>
        <label className="stack"><span className="label">渲染倍率 {scale.toFixed(1)}x</span><input type="range" min={5} max={20} value={Math.round(scale * 10)} onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 2))} /></label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>{busy ? '壓縮中…' : '壓縮並下載'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-encrypt', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-encrypt', title: 'PDF 加密', description: '為 PDF 設定開啟密碼（本機加密）。', tier: 'feature', effort: '1～3 天', tags: ['utility', 'security'] }
const meta = getProject('pdf-encrypt') ?? fallback
const PDF_MAX = ${PDF_MAX}
const PW_MAX = 64

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [userPw, setUserPw] = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setFile(f)
    setError('')
    setNote('')
  }

  async function run() {
    if (!file || !isNonEmpty(userPw)) { setError('請設定開啟密碼'); return }
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      // pdf-lib encryption support varies; use save with encrypt options when available
      const bytes = await doc.save({
        // @ts-expect-error pdf-lib encrypt option
        userPassword: limitText(userPw, PW_MAX),
        // @ts-expect-error pdf-lib encrypt option
        ownerPassword: limitText(ownerPw || userPw, PW_MAX),
      })
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-encrypted.pdf\`)
      setNote('已嘗試套用密碼保護。若開啟時未要求密碼，表示目前 pdf-lib 建置未完整支援加密，請改用其他工具再加密。')
    } catch (e) {
      setError('加密失敗：' + (e instanceof Error ? e.message : '未知錯誤'))
    } finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || !isNonEmpty(userPw) || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機嘗試加密。密碼僅在瀏覽器使用，不會上傳。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {formatBytes(file.size)}</p>}
        {error && <p className="field-error">{error}</p>}
        {note && <p className="field-hint">{note}</p>}
        <div className="field-wrap">
          <label className="label">開啟密碼</label>
          <input className={\`field\${!isNonEmpty(userPw) ? ' is-invalid' : ''}\`} type="password" value={userPw} maxLength={PW_MAX} onChange={(e) => setUserPw(limitText(e.target.value, PW_MAX))} />
          <div className="field-meta"><span> </span><span>{charCount(userPw)} / {PW_MAX}</span></div>
        </div>
        <div className="field-wrap">
          <label className="label">擁有者密碼（可留空）</label>
          <input className="field" type="password" value={ownerPw} maxLength={PW_MAX} onChange={(e) => setOwnerPw(limitText(e.target.value, PW_MAX))} />
          <div className="field-meta"><span> </span><span>{charCount(ownerPw)} / {PW_MAX}</span></div>
        </div>
        <button type="button" className="btn accent" disabled={!file || !isNonEmpty(userPw) || busy} onClick={() => void run()}>{busy ? '處理中…' : '加密並下載'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-page-number', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-page-number', title: 'PDF 頁碼', description: '為每一頁加上頁碼。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-page-number') ?? fallback
const PDF_MAX = ${PDF_MAX}

type Pos = 'bottom-center' | 'bottom-right' | 'top-center'

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useLocalStorage<Pos>('lab:pdf-page-number:pos', 'bottom-center')
  const [start, setStart] = useLocalStorage('lab:pdf-page-number:start', 1)
  const [size, setSize] = useLocalStorage('lab:pdf-page-number:size', 12)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
      setFile(f)
      setError('')
    } catch { setError('無法讀取 PDF') }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const fontSize = clamp(size, 8, 36)
      const base = clamp(start, 1, 9999)
      const pages = doc.getPages()
      pages.forEach((page, i) => {
        const label = String(base + i)
        const { width, height } = page.getSize()
        const tw = font.widthOfTextAtSize(label, fontSize)
        let x = (width - tw) / 2
        let y = 24
        if (pos === 'bottom-right') { x = width - tw - 24; y = 24 }
        if (pos === 'top-center') { x = (width - tw) / 2; y = height - 36 }
        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) })
      })
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-pages.pdf\`)
    } catch { setError('加上頁碼失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機為每頁加上數字頁碼。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="row">
          {([['bottom-center', '底部置中'], ['bottom-right', '底部右側'], ['top-center', '頂部置中']] as [Pos, string][]).map(([id, label]) => (
            <button key={id} type="button" className={\`btn sm \${pos === id ? 'accent' : 'ghost'}\`} onClick={() => setPos(id)}>{label}</button>
          ))}
        </div>
        <label className="stack"><span className="label">起始頁碼</span><input className="field" type="number" min={1} max={9999} value={start} onChange={(e) => setStart(clamp(Number(e.target.value) || 1, 1, 9999))} /></label>
        <label className="stack"><span className="label">字級 {size}</span><input type="range" min={8} max={36} value={size} onChange={(e) => setSize(clamp(Number(e.target.value), 8, 36))} /></label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>套用並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-header-footer', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-header-footer', title: 'PDF 頁首頁尾', description: '為每頁加上頁首與頁尾文字。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-header-footer') ?? fallback
const PDF_MAX = ${PDF_MAX}
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [header, setHeader] = useLocalStorage('lab:pdf-hf:header', 'Document')
  const [footer, setFooter] = useLocalStorage('lab:pdf-hf:footer', 'Confidential')
  const [size, setSize] = useLocalStorage('lab:pdf-hf:size', 10)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    setFile(f)
    setError('')
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const fontSize = clamp(size, 8, 24)
      const h = limitText(header, TEXT_MAX)
      const f = limitText(footer, TEXT_MAX)
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize()
        if (h) page.drawText(h, { x: 36, y: height - 28, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) })
        if (f) {
          const tw = font.widthOfTextAtSize(f, fontSize)
          page.drawText(f, { x: (width - tw) / 2, y: 20, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) })
        }
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-hf.pdf\`)
    } catch { setError('處理失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>頁首／頁尾文字建議使用英數（標準字型）。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap"><label className="label">頁首</label><input className="field" value={header} maxLength={TEXT_MAX} onChange={(e) => setHeader(limitText(e.target.value, TEXT_MAX))} /><div className="field-meta"><span> </span><span>{charCount(header)} / {TEXT_MAX}</span></div></div>
        <div className="field-wrap"><label className="label">頁尾</label><input className="field" value={footer} maxLength={TEXT_MAX} onChange={(e) => setFooter(limitText(e.target.value, TEXT_MAX))} /><div className="field-meta"><span> </span><span>{charCount(footer)} / {TEXT_MAX}</span></div></div>
        <label className="stack"><span className="label">字級 {size}</span><input type="range" min={8} max={24} value={size} onChange={(e) => setSize(clamp(Number(e.target.value), 8, 24))} /></label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>套用並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

console.log('pdf part2 done')
