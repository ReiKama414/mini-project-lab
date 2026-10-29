export const TITLE_MAX = 120
export const SECTION_MAX = 2000

export type PresetId = 'landing' | 'dashboard' | 'docs' | 'blank'
export type SectionKind =
  | 'nav'
  | 'sidebar'
  | 'hero'
  | 'cards'
  | 'metrics'
  | 'chart'
  | 'table'
  | 'code'
  | 'footer'
  | 'section'

export type Section = { id: string; kind: SectionKind; text: string }
export type LayoutMode = 'default' | 'docs'

export type Preset = {
  id: PresetId
  label: string
  hint: string
  emoji: string
  title: string
  layout: LayoutMode
  sections: Omit<Section, 'id'>[]
}

export const SECTION_KINDS: SectionKind[] = [
  'nav',
  'sidebar',
  'hero',
  'cards',
  'metrics',
  'chart',
  'table',
  'code',
  'footer',
  'section',
]

export const KIND_META: Record<
  SectionKind,
  { label: string; short: string; hint: string }
> = {
  nav: { label: '導覽列', short: 'nav', hint: '頂部連結列文字' },
  sidebar: { label: '側欄', short: 'aside', hint: '文件／後台左側目錄' },
  hero: { label: '主視覺', short: 'hero', hint: '副標文字（主標用頁面標題）' },
  cards: { label: '卡片群', short: 'cards', hint: '第一張卡片標題' },
  metrics: { label: '指標', short: 'KPI', hint: '用 / 或 · 分隔多個指標' },
  chart: { label: '圖表區', short: 'chart', hint: '圖表區塊說明' },
  table: { label: '表格區', short: 'table', hint: '表格區塊說明' },
  code: { label: '程式碼', short: 'code', hint: 'pre 區塊內容' },
  footer: { label: '頁尾', short: 'foot', hint: '版權或連結文字' },
  section: { label: '段落', short: 'body', hint: '一般內容' },
}

export const PRESETS: Preset[] = [
  {
    id: 'landing',
    label: 'Landing',
    hint: '行銷首頁',
    emoji: '🚀',
    title: '產品首頁',
    layout: 'default',
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
    hint: '數據儀表板',
    emoji: '📊',
    title: '營運儀表板',
    layout: 'default',
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
    hint: '側欄＋內文',
    emoji: '📚',
    title: '文件站',
    layout: 'docs',
    sections: [
      { kind: 'sidebar', text: '快速開始 · API · 範例' },
      { kind: 'hero', text: '歡迎使用文件' },
      { kind: 'code', text: 'npm install mini-lab' },
      { kind: 'footer', text: '改進建議歡迎 PR' },
    ],
  },
  {
    id: 'blank',
    label: '空白',
    hint: '從零開始',
    emoji: '✨',
    title: '新頁面',
    layout: 'default',
    sections: [{ kind: 'hero', text: '在此撰寫副標或簡介' }],
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
      return `    <aside class="sidebar">${t}</aside>`
    case 'hero':
      return `  <header class="hero"><h1>${escapeHtml(title)}</h1><p>${t}</p><a class="btn" href="#">開始使用</a></header>`
    case 'cards':
      return `  <section class="grid"><article class="card">${t}</article><article class="card">項目 B</article><article class="card">項目 C</article></section>`
    case 'metrics': {
      const parts = s.text.split(/[/·|]/).map((x) => x.trim()).filter(Boolean)
      const cells = (parts.length ? parts : [t, '指標 B', '指標 C']).slice(0, 4)
      return `  <section class="grid metrics">${cells.map((c) => `<article class="card metric"><span class="metric-val">${escapeHtml(c)}</span></article>`).join('')}</section>`
    }
    case 'chart':
      return `  <section class="panel-block panel-block--tall">${t}</section>`
    case 'table':
      return `  <section class="panel-block panel-block--table">${t}</section>`
    case 'code':
      return `  <pre class="code">${t}</pre>`
    case 'footer':
      return `  <footer>${t}</footer>`
    default:
      return `  <section class="panel-block panel-block--text"><p>${t}</p></section>`
  }
}

function wrapPage(body: string) {
  return `  <main class="page">\n${body.replace(/^  /gm, '    ')}\n  </main>`
}

function composeBody(title: string, sections: Section[], layout: LayoutMode) {
  if (layout === 'docs') {
    const sidebar = sections.filter((s) => s.kind === 'sidebar')
    const main = sections.filter((s) => s.kind !== 'sidebar')
    const sideHtml = sidebar.map((s) => sectionHtml(s, title)).join('\n') || '    <aside class="sidebar">文件目錄</aside>'
    const mainHtml = main.map((s) => sectionHtml(s, title)).join('\n')
    return `  <div class="layout-docs">\n${sideHtml}\n    <main class="docs-main page page--nested">\n${mainHtml.replace(/^  /gm, '      ')}\n    </main>\n  </div>`
  }
  return wrapPage(sections.map((s) => sectionHtml(s, title)).join('\n'))
}

export function toHtml(title: string, sections: Section[], layout: LayoutMode) {
  const body = composeBody(title, sections, layout)
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title || 'Generated')}</title>
  <style>
    :root { --ink:#1a2e28; --accent:#f0734a; --bg:#f3f0e8; --line:#d4cfc0; }
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",system-ui,sans-serif;margin:0;background:var(--bg);color:var(--ink);line-height:1.5}
    .page{display:flex;flex-direction:column;gap:1.25rem;padding-bottom:1.5rem}
    .page--nested{padding:1.25rem 0 0;gap:1.25rem}
    .nav{padding:14px 24px;background:#fffdf8;border-bottom:1px solid var(--line)}
    .layout-docs{display:flex;min-height:320px;align-items:stretch;background:var(--bg)}
    .sidebar{flex:0 0 200px;padding:20px 16px;background:#fffdf8;border-right:1px solid var(--line);font-size:.9rem}
    .docs-main{flex:1;min-width:0}
    .hero{padding:56px 24px;background:linear-gradient(135deg,#ffe0d4,#d4f0eb)}
    .hero h1{margin:0 0 8px;font-size:clamp(1.6rem,4vw,2.4rem)}
    .hero p{margin:0;opacity:.9;max-width:36rem}
    .btn{display:inline-block;margin-top:12px;background:var(--accent);color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600}
    .page > .grid{display:grid;gap:1rem;margin:0 1.5rem;padding:0;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
    .card{background:#fffdf8;padding:1rem 1.1rem;border-radius:14px;border:1px solid var(--line);box-shadow:0 1px 0 color-mix(in srgb, var(--line) 40%, transparent)}
    .metric{display:flex;align-items:center;justify-content:center;text-align:center;min-height:4.75rem}
    .metrics .metric-val{font-size:1.05rem;font-weight:700;line-height:1.3}
    .panel-block{margin:0 1.5rem;background:#fffdf8;padding:1.25rem 1.35rem;border-radius:14px;border:1px solid var(--line);box-shadow:0 1px 0 color-mix(in srgb, var(--line) 40%, transparent);font-weight:600;font-size:1rem;line-height:1.4}
    .panel-block--tall{min-height:10rem;display:flex;align-items:flex-start}
    .panel-block--table{min-height:7.5rem}
    .panel-block--text{font-weight:400}
    .panel-block--text p{margin:0}
    .page > .code{margin:0 1.5rem;padding:1rem 1.15rem;background:#1a2e28;color:#d4f0eb;border-radius:12px;overflow:auto;font-size:.875rem;line-height:1.45}
    footer{padding:20px 24px;opacity:.8;border-top:1px solid var(--line);background:color-mix(in srgb, #fffdf8 60%, var(--bg))}
  </style>
</head>
<body>
${body || '  <p>請新增區塊</p>'}
</body>
</html>`
}

export function layoutForPreset(presetId: PresetId): LayoutMode {
  return PRESETS.find((p) => p.id === presetId)?.layout ?? 'default'
}

export function truncate(s: string, max = 56) {
  const t = s.trim()
  if (t.length <= max) return t || '（空白）'
  return `${t.slice(0, max)}…`
}
