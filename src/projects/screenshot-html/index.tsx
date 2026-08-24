import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('screenshot-html')!

const TITLE_MAX = 120
const SECTION_MAX = 2000

type PresetId = 'landing' | 'dashboard' | 'docs'
type Section = { id: string; kind: string; text: string }

type Preset = { id: PresetId; label: string; title: string; sections: Omit<Section, 'id'>[] }

const PRESETS: Preset[] = [
  {
    id: 'landing',
    label: 'Landing',
    title: '產品首頁',
    sections: [
      { kind: 'nav', text: '產品 · 定價 · 登入' },
      { kind: 'hero', text: '更快打造可上線的小工具' },
      { kind: 'cards', text: '功能重點' },
      { kind: 'footer', text: '© 2026 Mini Lab' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    title: '營運儀表板',
    sections: [
      { kind: 'nav', text: '總覽 · 報表 · 設定' },
      { kind: 'metrics', text: 'MRR / 活躍用戶 / 轉換率' },
      { kind: 'chart', text: '近 7 日趨勢圖' },
      { kind: 'table', text: '近期訂單表格' },
    ],
  },
  {
    id: 'docs',
    label: 'Docs',
    title: '文件站',
    sections: [
      { kind: 'sidebar', text: '快速開始 · API · 範例' },
      { kind: 'hero', text: '歡迎使用文件' },
      { kind: 'code', text: 'npm install mini-lab' },
      { kind: 'footer', text: '改進建議歡迎 PR' },
    ],
  },
]

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sectionHtml(s: Section, title: string) {
  const t = escapeHtml(s.text)
  switch (s.kind) {
    case 'nav':
      return `  <nav class="nav">${t}</nav>`
    case 'sidebar':
      return `  <aside class="sidebar">${t}</aside>`
    case 'hero':
      return `  <header class="hero"><h1>${escapeHtml(title)}</h1><p>${t}</p><a class="btn" href="#">開始使用</a></header>`
    case 'cards':
    case 'metrics':
      return `  <section class="grid"><article class="card">${t}</article><article class="card">項目 B</article><article class="card">項目 C</article></section>`
    case 'chart':
    case 'table':
      return `  <section class="section panel">${t}</section>`
    case 'code':
      return `  <pre class="code">${t}</pre>`
    case 'footer':
      return `  <footer>${t}</footer>`
    default:
      return `  <section class="section"><p>${t}</p></section>`
  }
}

function toHtml(title: string, sections: Section[]) {
  const body = sections.map((s) => sectionHtml(s, title)).join('\n')
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || 'Generated')}</title>
  <style>
    :root { --ink:#1a2e28; --accent:#f0734a; --bg:#f3f0e8; }
    body{font-family:"Segoe UI",system-ui,sans-serif;margin:0;background:var(--bg);color:var(--ink);line-height:1.5}
    .nav,.sidebar{padding:14px 24px;background:#fffdf8;border-bottom:1px solid #d4cfc0}
    .sidebar{min-height:120px;border-right:1px solid #d4cfc0}
    .hero{padding:72px 24px;background:linear-gradient(135deg,#ffe0d4,#d4f0eb)}
    .hero h1{margin:0 0 8px;font-size:2.4rem}
    .btn{display:inline-block;margin-top:12px;background:var(--accent);color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none}
    .grid{display:grid;gap:12px;padding:24px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .card,.panel{background:#fffdf8;padding:16px;border-radius:14px;border:1px solid #d4cfc0}
    .section{padding:24px}
    .code{margin:16px 24px;padding:16px;background:#1a2e28;color:#d4f0eb;border-radius:12px;overflow:auto}
    footer{padding:24px;opacity:.75;border-top:1px solid #d4cfc0}
  </style>
</head>
<body>
${body || '  <p>請新增區塊</p>'}
</body>
</html>`
}

const KIND_OPTS = ['nav', 'sidebar', 'hero', 'cards', 'metrics', 'chart', 'table', 'code', 'footer', 'section']

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:screenshot-html:title', PRESETS[0]!.title)
  const [preset, setPreset] = useLocalStorage<PresetId>('lab:screenshot-html:preset', 'landing')
  const [sections, setSections] = useLocalStorage<Section[]>(
    'lab:screenshot-html:sections',
    PRESETS[0]!.sections.map((s) => ({ ...s, id: uid('s') })),
  )
  const [auto, setAuto] = useLocalStorage('lab:screenshot-html:auto', true)
  const [manualHtml, setManualHtml] = useState('')

  const html = useMemo(() => toHtml(title, sections), [title, sections])
  const out = auto ? html : manualHtml || html

  function applyPreset(p: Preset) {
    setPreset(p.id)
    setTitle(p.title)
    setSections(p.sections.map((s) => ({ ...s, id: uid('s') })))
    setManualHtml('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => void copyText(out)}>
            複製
          </button>
          <button
            type="button"
            className="btn sm teal"
            onClick={() => downloadText(`${title || 'page'}.html`, out, 'text/html;charset=utf-8')}
          >
            下載 HTML
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`btn sm ${preset === p.id ? 'accent' : 'ghost'}`} onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
        <button type="button" className={`btn sm ${auto ? 'teal' : 'ghost'}`} onClick={() => setAuto((v) => !v)}>
          {auto ? '即時產生' : '手動產生'}
        </button>
        {!auto && (
          <button type="button" className="btn sm accent" onClick={() => setManualHtml(toHtml(title, sections))} disabled={!isNonEmpty(title)}>
            產生 HTML
          </button>
        )}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <input
            className={cn('field', !isNonEmpty(title) && 'is-invalid')}
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))}
            placeholder="頁面標題"
          />
          <div className="field-meta">
            <span className={!isNonEmpty(title) ? 'warn' : undefined}>{isNonEmpty(title) ? '標題 OK' : '請填頁面標題'}</span>
            <span>{charCount(title)}/{TITLE_MAX}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label" style={{ margin: 0 }}>
              區塊（可編輯）
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => setSections((xs) => [...xs, { id: uid('s'), kind: 'section', text: '新區塊內容' }])}
            >
              + 區塊
            </button>
          </div>
          {sections.map((s, i) => (
            <div key={s.id} className="list-item stack">
              <div className="row">
                <span className="mono muted">{i + 1}</span>
                <select
                  className="field"
                  style={{ width: 120 }}
                  value={s.kind}
                  onChange={(e) => setSections((xs) => xs.map((x) => (x.id === s.id ? { ...x, kind: e.target.value } : x)))}
                >
                  {KIND_OPTS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn sm danger" onClick={() => setSections((xs) => xs.filter((x) => x.id !== s.id))}>
                  刪
                </button>
              </div>
              <textarea
                className="field"
                rows={2}
                maxLength={SECTION_MAX}
                value={s.text}
                onChange={(e) =>
                  setSections((xs) => xs.map((x) => (x.id === s.id ? { ...x, text: limitText(e.target.value, SECTION_MAX) } : x)))
                }
              />
              <div className="field-meta">
                <span className="field-hint">區塊文字</span>
                <span>{charCount(s.text)}/{SECTION_MAX}</span>
              </div>
            </div>
          ))}
          <iframe title="preview" className="panel" style={{ minHeight: 280, width: '100%', border: 0, background: '#fff' }} srcDoc={out} />
        </div>
        <div className="panel stack">
          <div className="label">HTML 輸出</div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 560, overflow: 'auto', margin: 0, fontSize: 12 }}>
            {out}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
