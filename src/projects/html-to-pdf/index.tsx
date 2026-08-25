import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { sanitizeHtml, escapeHtml } from '../../lib/sanitize'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'html-to-pdf',
  title: 'HTML 轉 PDF',
  description: '將 HTML 渲染成圖片後匯出 PDF。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('html-to-pdf') ?? fallback
const HTML_MAX = 30000
const PAGE_W = 800
const PAGE_H = 1100
const MAX_PAGES = 20

async function renderPages(safeHtml: string) {
  const styled = `
    <style>
      body,div{margin:0;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;font-size:15px;line-height:1.6;color:#111}
      h1{font-size:28px;margin:0 0 12px} h2{font-size:22px;margin:16px 0 8px} h3{font-size:18px;margin:12px 0 6px}
      p{margin:0 0 10px} ul,ol{margin:0 0 10px;padding-left:1.2em} li{margin:0 0 4px}
      code,pre{font-family:ui-monospace,Consolas,monospace} code{background:#f3f3f3;padding:1px 4px;border-radius:4px}
      table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:6px 8px}
    </style>
    <div style="padding:24px;background:#fff;width:${PAGE_W - 48}px;box-sizing:border-box;">${safeHtml}</div>
  `
  const measure = document.createElement('div')
  measure.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W - 48}px;font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;font-size:15px;line-height:1.6;color:#111;background:#fff;`
  measure.innerHTML = styled
  document.body.appendChild(measure)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const totalH = Math.max(measure.scrollHeight, 1)
  const contentH = PAGE_H - 48
  const pageCount = Math.min(MAX_PAGES, Math.max(1, Math.ceil(totalH / contentH)))
  document.body.removeChild(measure)

  const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W - 48}" height="${totalH}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Noto Sans TC,Microsoft JhengHei,sans-serif;font-size:15px;line-height:1.6;color:#111;background:#fff;width:${PAGE_W - 48}px;">${styled}</div></foreignObject></svg>`
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('render'))
    img.src = url
  })

  const blobs: Blob[] = []
  for (let i = 0; i < pageCount; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W
    canvas.height = PAGE_H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    ctx.drawImage(img, 24, 24 - i * contentH)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    if (!blob) throw new Error('blob')
    blobs.push(blob)
  }
  return blobs
}

export default function Page() {
  const [html, setHtml] = useLocalStorage(
    'lab:html-to-pdf:html',
    '<h1>標題</h1><p>這是本機 HTML → PDF 示範。</p><ul><li>項目 A</li><li>項目 B</li></ul>',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState('')
  const [pageHint, setPageHint] = useState('')

  const safeHtml = useMemo(() => sanitizeHtml(limitText(html, HTML_MAX)), [html])

  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function run() {
    if (!isNonEmpty(html)) {
      setError('請輸入 HTML')
      return
    }
    setBusy(true)
    setError('')
    setProgress('消毒並渲染…')
    setPageHint('')
    try {
      // Never execute scripts: sanitize + SVG foreignObject only (no iframe / document.write)
      const pageBlobs = await renderPages(safeHtml || `<p>${escapeHtml(html.slice(0, 200))}</p>`)
      setProgress(`寫入 PDF（${pageBlobs.length} 頁）…`)
      const pdf = await PDFDocument.create()
      for (let i = 0; i < pageBlobs.length; i++) {
        setProgress(`嵌入第 ${i + 1}/${pageBlobs.length} 頁`)
        const jpg = await pdf.embedJpg(new Uint8Array(await pageBlobs[i]!.arrayBuffer()))
        const page = pdf.addPage([PAGE_W, PAGE_H])
        page.drawImage(jpg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      }
      const first = pageBlobs[0]
      if (first) {
        setPreview((prev) => {
          if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
          return URL.createObjectURL(first)
        })
      }
      setPageHint(`已匯出 ${pageBlobs.length} 頁（上限 ${MAX_PAGES}）`)
      downloadBlob(new Blob([Uint8Array.from(await pdf.save())], { type: 'application/pdf' }), 'html.pdf')
    } catch {
      setError('轉換失敗（請使用允許的標籤；不會執行 script）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!isNonEmpty(html) || busy} onClick={() => void run()}>
          下載 PDF
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機消毒 HTML 後以 SVG 點陣匯出（不執行 script／外連）。支援中文，最多約 {MAX_PAGES} 頁。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          {error && <p className="field-error">{error}</p>}
          {pageHint && <p className="field-hint">{pageHint}</p>}
          {busy && progress && <p className="field-hint">{progress}</p>}
          <div className="field-wrap">
            <label className="label">HTML</label>
            <textarea
              className="field mono"
              rows={16}
              value={html}
              maxLength={HTML_MAX}
              disabled={busy}
              onChange={(e) => setHtml(limitText(e.target.value, HTML_MAX))}
            />
            <div className="field-meta">
              <span> </span>
              <span>
                {charCount(html)} / {HTML_MAX}
              </span>
            </div>
          </div>
          <button type="button" className="btn accent" disabled={!isNonEmpty(html) || busy} onClick={() => void run()}>
            {busy ? progress || '轉換中…' : '轉成 PDF'}
          </button>
        </div>
        <div className="panel stack">
          <div className="label">消毒後預覽</div>
          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 16,
              minHeight: 160,
              maxHeight: 320,
              overflow: 'auto',
              background: '#fff',
              color: '#111',
            }}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
          <div className="label">匯出預覽</div>
          {preview ? (
            <img src={preview} alt="預覽" style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />
          ) : (
            <div
              className="muted"
              style={{
                minHeight: 120,
                display: 'grid',
                placeItems: 'center',
                border: '1px dashed var(--line)',
                borderRadius: 12,
              }}
            >
              產生後顯示
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
