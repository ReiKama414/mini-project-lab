import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('screenshot-html')!

type Preset = { id: string; label: string; title: string; desc: string }

const PRESETS: Preset[] = [
  {
    id: 'landing',
    label: 'Landing',
    title: '產品首頁',
    desc: '頂部導覽列\nHero 主視覺與 CTA\n三欄功能卡片\n頁尾連結',
  },
  {
    id: 'docs',
    label: 'Docs',
    title: '文件站',
    desc: '側邊導覽選單\n標題與文章內容\n程式碼區塊\n頁尾',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: '儀表板',
    desc: '頂部導覽\n指標卡片列\n圖表區\n資料表格',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    title: '方案頁',
    desc: '導覽\nHero 標題\n三欄價格卡片\nFAQ 區塊\n頁尾',
  },
]

function toHtml(desc: string, title: string) {
  const parts = desc
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const sections = parts
    .map((p) => {
      if (/nav|導覽|選單|側邊/i.test(p)) return `  <nav class="nav">${escapeHtml(p)}</nav>`
      if (/hero|主視覺|標題/i.test(p))
        return `  <header class="hero"><h1>${escapeHtml(title || p)}</h1><p>${escapeHtml(p)}</p><a class="btn" href="#">開始使用</a></header>`
      if (/footer|頁尾/i.test(p)) return `  <footer>${escapeHtml(p)}</footer>`
      if (/卡片|card|grid|價格|指標|圖表|表格|FAQ/i.test(p))
        return `  <section class="grid"><article class="card">${escapeHtml(p)}</article><article class="card">項目 B</article><article class="card">項目 C</article></section>`
      if (/程式碼|code/i.test(p)) return `  <pre class="code">${escapeHtml(p)}</pre>`
      return `  <section class="section"><p>${escapeHtml(p)}</p></section>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || 'Generated')}</title>
  <style>
    :root { --ink:#1a2e28; --accent:#f0734a; --bg:#f3f0e8; }
    body{font-family:"Segoe UI",system-ui,sans-serif;margin:0;background:var(--bg);color:var(--ink);line-height:1.5}
    .nav{padding:14px 24px;background:#fffdf8;border-bottom:1px solid #d4cfc0}
    .hero{padding:72px 24px;background:linear-gradient(135deg,#ffe0d4,#d4f0eb)}
    .hero h1{margin:0 0 8px;font-size:2.4rem}
    .btn{display:inline-block;margin-top:12px;background:var(--accent);color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none}
    .grid{display:grid;gap:12px;padding:24px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .card{background:#fffdf8;padding:16px;border-radius:14px;border:1px solid #d4cfc0}
    .section{padding:24px}
    .code{margin:16px 24px;padding:16px;background:#1a2e28;color:#d4f0eb;border-radius:12px;overflow:auto}
    footer{padding:24px;opacity:.75;border-top:1px solid #d4cfc0}
  </style>
</head>
<body>
${sections || '  <p>請描述畫面結構</p>'}
</body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:screenshot-html:title', PRESETS[0]!.title)
  const [desc, setDesc] = useLocalStorage('lab:screenshot-html:desc', PRESETS[0]!.desc)
  const [preset, setPreset] = useLocalStorage('lab:screenshot-html:preset', 'landing')
  const [auto, setAuto] = useLocalStorage('lab:screenshot-html:auto', true)

  const html = useMemo(() => toHtml(desc, title), [desc, title])
  const [manualHtml, setManualHtml] = useState('')
  const out = auto ? html : manualHtml || html

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => copyText(out)}>
            複製
          </button>
          <button type="button" className="btn sm teal" onClick={() => downloadText(`${title || 'page'}.html`, out, 'text/html;charset=utf-8')}>
            下載 HTML
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn sm ${preset === p.id ? 'accent' : 'ghost'}`}
            onClick={() => {
              setPreset(p.id)
              setTitle(p.title)
              setDesc(p.desc)
            }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className={`btn sm ${auto ? 'teal' : 'ghost'}`} onClick={() => setAuto((v) => !v)}>
          {auto ? '即時產生' : '手動產生'}
        </button>
        {!auto && (
          <button type="button" className="btn sm accent" onClick={() => setManualHtml(toHtml(desc, title))}>
            產生 HTML
          </button>
        )}
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="頁面標題" />
          <textarea className="field" rows={10} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述區塊…" />
          <iframe title="preview" className="panel" style={{ minHeight: 280, width: '100%', border: 0, background: '#fff' }} srcDoc={out} />
        </div>
        <div className="panel stack">
          <div className="label">HTML 輸出</div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 520, overflow: 'auto', margin: 0, fontSize: 12 }}>
            {out}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
