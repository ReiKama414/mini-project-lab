import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { sanitizeHtml } from '../../lib/sanitize'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'markdown-to-pdf',
  title: 'Markdown 轉 PDF',
  description: '簡易 Markdown 轉多分頁 PDF（本機點陣）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('markdown-to-pdf') ?? fallback
const MD_MAX = 40000
const PAGE_W = 794
const PAGE_H = 1123
const PAD = 40
const MAX_PAGES = 40

function mdToHtml(md: string) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inList = false
  const flushList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  for (const raw of lines) {
    const line = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const inline = (s: string) =>
      s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
    if (/^### /.test(line)) {
      flushList()
      out.push(`<h3>${inline(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      flushList()
      out.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      flushList()
      out.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(line.slice(2))}</li>`)
    } else if (!line.trim()) {
      flushList()
      out.push('<div style="height:8px"></div>')
    } else {
      flushList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  flushList()
  return out.join('')
}

async function renderPages(html: string, onProgress?: (msg: string) => void) {
  const inner = `
    <style>
      h1{font-size:28px;margin:0 0 12px} h2{font-size:22px;margin:16px 0 8px} h3{font-size:18px;margin:12px 0 6px}
      p{margin:0 0 10px} ul{margin:0 0 10px;padding-left:1.2em} li{margin:0 0 4px}
      code{font-family:ui-monospace,Consolas,monospace;background:#f3f3f3;padding:1px 4px;border-radius:4px}
    </style>
    ${html}
  `
  const measure = document.createElement('div')
  measure.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W - PAD * 2}px;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;font-size:15px;line-height:1.65;color:#111;background:#fff;`
  measure.innerHTML = inner
  document.body.appendChild(measure)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const totalH = Math.max(measure.scrollHeight, 1)
  const contentH = PAGE_H - PAD * 2
  const needed = Math.max(1, Math.ceil(totalH / contentH))
  document.body.removeChild(measure)
  if (needed > MAX_PAGES) throw new Error(`PAGE_LIMIT:${needed}`)

  const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W - PAD * 2}" height="${totalH}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Noto Sans TC,Microsoft JhengHei,sans-serif;font-size:15px;line-height:1.65;color:#111;background:#fff;width:${PAGE_W - PAD * 2}px;">${inner}</div></foreignObject></svg>`
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('render'))
    img.src = url
  })

  const blobs: Blob[] = []
  for (let i = 0; i < needed; i++) {
    onProgress?.(`渲染第 ${i + 1}/${needed} 頁`)
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W
    canvas.height = PAGE_H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    ctx.drawImage(img, PAD, PAD - i * contentH)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    if (!blob) throw new Error('blob')
    blobs.push(blob)
  }
  return blobs
}

export default function Page() {
  const [md, setMd] = useLocalStorage(
    'lab:markdown-to-pdf:md',
    '# 標題\n\n這是 **粗體** 與 *斜體*。\n\n## 清單\n\n- 項目一\n- 項目二\n\n長文會自動分頁匯出為多頁 PDF。\n',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pageHint, setPageHint] = useState('')
  const [progress, setProgress] = useState('')

  const html = useMemo(() => sanitizeHtml(mdToHtml(limitText(md, MD_MAX))), [md])

  async function run() {
    if (!isNonEmpty(md)) {
      setError('請輸入 Markdown')
      return
    }
    setBusy(true)
    setError('')
    setPageHint('')
    setProgress('消毒並排版…')
    try {
      const pageBlobs = await renderPages(html, setProgress)
      const pdf = await PDFDocument.create()
      for (let i = 0; i < pageBlobs.length; i++) {
        setProgress(`寫入第 ${i + 1}/${pageBlobs.length} 頁`)
        const jpg = await pdf.embedJpg(new Uint8Array(await pageBlobs[i]!.arrayBuffer()))
        const page = pdf.addPage([PAGE_W, PAGE_H])
        page.drawImage(jpg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      }
      setPageHint(`已匯出 ${pageBlobs.length} 頁`)
      downloadBlob(new Blob([Uint8Array.from(await pdf.save())], { type: 'application/pdf' }), 'markdown.pdf')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.startsWith('PAGE_LIMIT:')) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，預估 ${msg.slice(11)} 頁），請縮短內容`)
      } else {
        setError('轉換失敗（內容過複雜或瀏覽器限制）')
      }
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!isNonEmpty(md) || busy} onClick={() => void run()}>
          下載 PDF
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機將 Markdown 轉為消毒後 HTML，再以多分頁點陣匯出（支援中文）。最多 {MAX_PAGES} 頁。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          {error && <p className="field-error">{error}</p>}
          {pageHint && <p className="field-hint">{pageHint}</p>}
          {busy && progress && <p className="field-hint">{progress}</p>}
          <div className="field-wrap">
            <label className="label">Markdown</label>
            <textarea
              className="field mono"
              rows={16}
              value={md}
              maxLength={MD_MAX}
              disabled={busy}
              onChange={(e) => setMd(limitText(e.target.value, MD_MAX))}
            />
            <div className="field-meta">
              <span> </span>
              <span>
                {charCount(md)} / {MD_MAX}
              </span>
            </div>
          </div>
          <button type="button" className="btn accent" disabled={!isNonEmpty(md) || busy} onClick={() => void run()}>
            {busy ? progress || '轉換中…' : '轉成 PDF'}
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 16,
              minHeight: 200,
              maxHeight: 480,
              overflow: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </ProjectShell>
  )
}
