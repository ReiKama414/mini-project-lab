import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('screenshot-html')!

function toHtml(desc: string, title: string) {
  const parts = desc
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const sections = parts
    .map((p) => {
      if (/nav|導覽|選單/i.test(p)) return `  <nav class="nav">${p}</nav>`
      if (/hero|主視覺|標題/i.test(p)) return `  <header class="hero"><h1>${title || p}</h1><p>${p}</p></header>`
      if (/footer|頁尾/i.test(p)) return `  <footer>${p}</footer>`
      if (/卡片|card|grid/i.test(p)) return `  <section class="grid"><article class="card">${p}</article></section>`
      return `  <section><p>${p}</p></section>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>${title || 'Generated'}</title>
  <style>
    body{font-family:system-ui;margin:0;background:#0f172a;color:#e2e8f0}
    .nav{padding:12px 24px;background:#1e293b}
    .hero{padding:64px 24px;background:linear-gradient(135deg,#0ea5e9,#6366f1)}
    .grid{display:grid;gap:12px;padding:24px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .card{background:#1e293b;padding:16px;border-radius:12px}
    footer{padding:24px;opacity:.7}
  </style>
</head>
<body>
${sections || '  <p>請描述畫面結構</p>'}
</body>
</html>`
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:screenshot-html:title', '產品首頁')
  const [desc, setDesc] = useLocalStorage(
    'lab:screenshot-html:desc',
    '頂部導覽列\nHero 主視覺與 CTA\n三欄功能卡片\n頁尾連結',
  )
  const [html, setHtml] = useState('')

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="頁面標題" />
          <textarea className="field" rows={10} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述區塊…" />
          <button type="button" className="btn accent" onClick={() => setHtml(toHtml(desc, title))}>
            產生 HTML
          </button>
        </div>
        <div className="panel stack">
          <div className="row">
            <button type="button" className="btn sm ghost" disabled={!html} onClick={() => copyText(html)}>
              複製
            </button>
            <button type="button" className="btn sm ghost" disabled={!html} onClick={() => downloadText('page.html', html, 'text/html')}>
              下載
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 420, overflow: 'auto', margin: 0 }}>
            {html || '產出的 HTML 會顯示於此'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
