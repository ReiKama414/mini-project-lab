/**
 * PDF tools generator part 1
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectsDir = path.join(root, 'src', 'projects')

function write(slug, content) {
  const dir = path.join(projectsDir, slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.tsx'), content.trimStart())
  console.log('wrote', slug)
}

const PDF_MAX = 25 * 1024 * 1024
const PDF_ACCEPT = 'application/pdf'

write('pdf-merge', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-merge', title: 'PDF 合併', description: '將多個 PDF 合併成單一檔案。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-merge') ?? fallback
const PDF_MAX = ${PDF_MAX}
const MAX_FILES = 20

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('請上傳 PDF'); return }
      if (f.size > PDF_MAX) { setError(\`「\${f.name}」超過 \${formatBytes(PDF_MAX)}\`); return }
    }
    setError('')
    setFiles(arr)
  }

  function move(i: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function merge() {
    if (files.length < 2) { setError('請至少選擇 2 個 PDF'); return }
    setBusy(true)
    setError('')
    try {
      const out = await PDFDocument.create()
      for (const f of files) {
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
        const pages = await out.copyPages(doc, doc.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      const bytes = await out.save()
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf')
    } catch { setError('合併失敗（可能含加密檔）') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>{busy ? '合併中…' : '下載合併 PDF'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機合併，單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_FILES} 個。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">選擇 PDF（可多選）</span><input className="field" type="file" accept="${PDF_ACCEPT}" multiple onChange={(e) => onFiles(e.target.files)} /></label>
        {error && <p className="field-error">{error}</p>}
        {files.map((f, i) => (
          <div key={f.name + i} className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13 }}>{i + 1}. {f.name} · {formatBytes(f.size)}</span>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0}>上移</button>
              <button type="button" className="btn sm ghost" onClick={() => move(i, 1)} disabled={i === files.length - 1}>下移</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>{busy ? '合併中…' : '合併並下載'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-split', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

const fallback: ProjectMeta = { slug: 'pdf-split', title: 'PDF 分割', description: '依頁碼範圍或逐頁分割 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-split') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [range, setRange] = useState('1-1')
  const [mode, setMode] = useState<'range' | 'each'>('range')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      setError('')
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
      setFile(f)
      setRange(\`1-\${doc.getPageCount()}\`)
    } catch { setError('無法讀取 PDF') }
  }

  function parseRanges(text: string, max: number): number[][] {
    const parts = text.split(/[,，\\s]+/).filter(Boolean)
    const groups: number[][] = []
    for (const p of parts) {
      const m = p.match(/^(\\d+)(?:-(\\d+))?$/)
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
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = src.getPageCount()
      if (mode === 'each') {
        const zip = new JSZip()
        for (let i = 0; i < n; i++) {
          const doc = await PDFDocument.create()
          const [p] = await doc.copyPages(src, [i])
          doc.addPage(p!)
          zip.file(\`page-\${String(i + 1).padStart(3, '0')}.pdf\`, await doc.save())
        }
        downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-split-pages.zip')
      } else {
        const groups = parseRanges(limitText(range, 200), n)
        if (!groups.length) { setError('請輸入有效頁碼，如 1-3,5'); setBusy(false); return }
        if (groups.length === 1) {
          const doc = await PDFDocument.create()
          const pages = await doc.copyPages(src, groups[0]!)
          pages.forEach((p) => doc.addPage(p))
          downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'split.pdf')
        } else {
          const zip = new JSZip()
          for (let i = 0; i < groups.length; i++) {
            const doc = await PDFDocument.create()
            const pages = await doc.copyPages(src, groups[i]!)
            pages.forEach((p) => doc.addPage(p))
            zip.file(\`part-\${i + 1}.pdf\`, await doc.save())
          }
          downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-split.zip')
        }
      }
    } catch { setError('分割失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>{busy ? '處理中…' : '下載'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機分割 PDF，支援範圍與逐頁 ZIP。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁 · {formatBytes(file.size)}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="row">
          <button type="button" className={\`btn sm \${mode === 'range' ? 'accent' : 'ghost'}\`} onClick={() => setMode('range')}>頁碼範圍</button>
          <button type="button" className={\`btn sm \${mode === 'each' ? 'accent' : 'ghost'}\`} onClick={() => setMode('each')}>逐頁分割</button>
        </div>
        {mode === 'range' && (
          <label className="stack"><span className="label">頁碼（例：1-3,5）</span><input className="field" value={range} maxLength={200} onChange={(e) => setRange(limitText(e.target.value, 200))} /></label>
        )}
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>{busy ? '處理中…' : '分割並下載'}</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-rotate', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, degrees } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-rotate', title: 'PDF 旋轉', description: '旋轉指定頁或全部頁面。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-rotate') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
  const [pages, setPages] = useState('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      const indices = pages.trim().toLowerCase() === 'all'
        ? doc.getPageIndices()
        : pages.split(/[,，\\s]+/).map((s) => clamp(Number(s), 1, pageCount) - 1).filter((i) => i >= 0)
      for (const i of indices) {
        const page = doc.getPage(i)
        const cur = page.getRotation().angle
        page.setRotation(degrees((cur + angle) % 360))
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-rotated.pdf\`)
    } catch { setError('旋轉失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機旋轉 PDF 頁面。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="row">{([90, 180, 270] as const).map((a) => <button key={a} type="button" className={\`btn sm \${angle === a ? 'accent' : 'ghost'}\`} onClick={() => setAngle(a)}>旋轉 {a}°</button>)}</div>
        <label className="stack"><span className="label">頁碼（all 或 1,3,5）</span><input className="field" value={pages} maxLength={120} onChange={(e) => setPages(limitText(e.target.value, 120))} /></label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>套用並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-delete-pages', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-delete-pages', title: 'PDF 刪除頁面', description: '刪除指定頁碼後下載新 PDF。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-delete-pages') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [del, setDel] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const remove = new Set(
        del.split(/[,，\\s]+/).map((s) => clamp(Number(s), 1, pageCount) - 1).filter((i) => !Number.isNaN(i)),
      )
      if (!remove.size) { setError('請指定要刪除的頁碼'); setBusy(false); return }
      if (remove.size >= pageCount) { setError('不能刪除全部頁面'); setBusy(false); return }
      const keep = src.getPageIndices().filter((i) => !remove.has(i))
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, keep)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-trimmed.pdf\`)
    } catch { setError('處理失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機刪除指定頁，其餘頁保留。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <label className="stack"><span className="label">要刪除的頁碼</span><input className="field" value={del} maxLength={120} onChange={(e) => setDel(limitText(e.target.value, 120))} placeholder="例：2,4,7" /></label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>刪除並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-organizer', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-organizer', title: 'PDF 頁面整理', description: '重新排序 PDF 頁面後下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-organizer') ?? fallback
const PDF_MAX = ${PDF_MAX}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX) { setError(\`檔案過大（上限 \${formatBytes(PDF_MAX)}）\`); return }
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      setOrder(Array.from({ length: n }, (_, i) => i))
      setFile(f)
      setError('')
    } catch { setError('無法讀取 PDF') }
  }

  function move(i: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, order)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-organized.pdf\`)
    } catch { setError('整理失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>上移／下移調整頁序後匯出。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {order.length} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="stack" style={{ maxHeight: 360, overflow: 'auto' }}>
          {order.map((pageIndex, i) => (
            <div key={\`\${pageIndex}-\${i}\`} className="row" style={{ justifyContent: 'space-between' }}>
              <span>位置 {i + 1} ← 原第 {pageIndex + 1} 頁</span>
              <div className="row">
                <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0}>上移</button>
                <button type="button" className="btn sm ghost" onClick={() => move(i, 1)} disabled={i === order.length - 1}>下移</button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!order.length} onClick={() => setOrder((o) => [...o].reverse())}>整份反轉</button>
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>套用並下載</button>
        </div>
      </div>
    </ProjectShell>
  )
}
`)

write('pdf-watermark', `import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib'

const fallback: ProjectMeta = { slug: 'pdf-watermark', title: 'PDF 浮水印', description: '為 PDF 每一頁加上文字浮水印。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('pdf-watermark') ?? fallback
const PDF_MAX = ${PDF_MAX}
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useLocalStorage('lab:pdf-watermark:text', 'CONFIDENTIAL')
  const [opacity, setOpacity] = useLocalStorage('lab:pdf-watermark:opacity', 25)
  const [size, setSize] = useLocalStorage('lab:pdf-watermark:size', 48)
  const [angle, setAngle] = useLocalStorage('lab:pdf-watermark:angle', -30)

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
    if (!file || !isNonEmpty(text)) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const line = limitText(text.trim(), TEXT_MAX)
      const alpha = clamp(opacity, 5, 80) / 100
      const fontSize = clamp(size, 12, 120)
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize()
        page.drawText(line, {
          x: width / 2 - (font.widthOfTextAtSize(line, fontSize) / 2),
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
          opacity: alpha,
          rotate: degrees(clamp(angle, -90, 90)),
        })
      }
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), \`\${file.name.replace(/\\.pdf$/i, '')}-watermark.pdf\`)
    } catch { setError('加上浮水印失敗') }
    finally { setBusy(false) }
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!file || !isNonEmpty(text) || busy} onClick={() => void run()}>下載</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>本機為每頁加上文字浮水印（Helvetica，英數較佳）。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">上傳 PDF</span><input className="field" type="file" accept="application/pdf" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} /></label>
        {file && <p className="muted" style={{ margin: 0 }}>{file.name} · {pageCount} 頁</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">浮水印文字</label>
          <input className={\`field\${!isNonEmpty(text) ? ' is-invalid' : ''}\`} value={text} maxLength={TEXT_MAX} onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))} />
          <div className="field-meta"><span> </span><span>{charCount(text)} / {TEXT_MAX}</span></div>
        </div>
        <label className="stack"><span className="label">透明度 {opacity}%</span><input type="range" min={5} max={80} value={opacity} onChange={(e) => setOpacity(clamp(Number(e.target.value), 5, 80))} /></label>
        <label className="stack"><span className="label">字級 {size}</span><input type="range" min={12} max={120} value={size} onChange={(e) => setSize(clamp(Number(e.target.value), 12, 120))} /></label>
        <label className="stack"><span className="label">角度 {angle}°</span><input type="range" min={-90} max={90} value={angle} onChange={(e) => setAngle(clamp(Number(e.target.value), -90, 90))} /></label>
        <button type="button" className="btn accent" disabled={!file || !isNonEmpty(text) || busy} onClick={() => void run()}>套用並下載</button>
      </div>
    </ProjectShell>
  )
}
`)

console.log('pdf part1 done')
