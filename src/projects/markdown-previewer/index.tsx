import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText, copyText, downloadText, formatBytes } from '../../lib/utils'
import { sanitizeHtml } from '../../lib/sanitize'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'

const meta = getProject('markdown-previewer')!

const MD_MAX = 50_000
const FILE_MAX = 200_000

type ViewMode = 'split' | 'edit' | 'preview'

const TEMPLATES: Record<string, { label: string; body: string }> = {
  basic: {
    label: '基礎',
    body: `# Markdown 預覽

這是 **粗體** 與 *斜體*，還有 \`inline code\` 與 ~~刪除線~~。

## 清單
- 第一點
- 第二點

[連結範例](https://example.com)

---

> 引用區塊
`,
  },
  readme: {
    label: 'README',
    body: `# 專案名稱

簡短說明這個專案做什麼。

## 安裝

\`\`\`bash
npm install
npm run dev
\`\`\`

## 功能
1. 功能 A
2. 功能 B

## 授權
MIT
`,
  },
  note: {
    label: '筆記',
    body: `# 會議筆記

## 今日重點
- [ ] 待辦事項
- [x] 已完成

### 連結
請見 [文件](https://example.com/docs)

\`\`\`ts
const hello = 'world'
\`\`\`
`,
  },
  table: {
    label: '表格',
    body: `# 對照表

| 項目 | 說明 | 狀態 |
| --- | --- | --- |
| 編輯 | 即時輸入 Markdown | 完成 |
| 預覽 | GFM 即時渲染 | 完成 |
| 匯出 | MD / HTML | 完成 |

可搭配 \`任務清單\`：

- [x] 寫標題
- [ ] 補截圖
`,
  },
  changelog: {
    label: 'Changelog',
    body: `# Changelog

## [1.1.0] - 2026-09-10
### Added
- 即時預覽與目錄
- 匯出 HTML

### Fixed
- 空白行換行選項

## [1.0.0] - 2026-08-01
### Added
- 初版 Markdown 預覽
`,
  },
}

const SNIPPETS: { label: string; insert: string; cursor?: number }[] = [
  { label: '粗體', insert: '****', cursor: 2 },
  { label: '斜體', insert: '**', cursor: 1 },
  { label: '程式碼', insert: '``', cursor: 1 },
  { label: '連結', insert: '[文字](https://)', cursor: 1 },
  { label: '圖片', insert: '![說明](https://)', cursor: 2 },
  { label: '標題', insert: '## ', cursor: 3 },
  { label: '清單', insert: '- ' },
  { label: '引用', insert: '> ' },
  { label: '程式區塊', insert: '```\n\n```', cursor: 4 },
  { label: '分隔線', insert: '\n---\n' },
]

function mdToHtml(src: string, softBreaks: boolean) {
  const raw = marked.parse(src, { async: false, gfm: true, breaks: softBreaks })
  return typeof raw === 'string' ? raw : String(raw)
}

function slugifyHeading(text: string, index: number) {
  const base = text
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
  return `h-${index}-${base || 'section'}`
}

function addHeadingIds(html: string, ids: string[]) {
  let i = 0
  return html.replace(/<h([1-6])(\s[^>]*)?>/gi, (full, level, attrs = '') => {
    if (/\sid=/i.test(attrs)) return full
    const id = ids[i++] ?? `h-${i}`
    return `<h${level}${attrs} id="${id}">`
  })
}

function extractHeadings(md: string) {
  const items: { level: number; text: string; id: string }[] = []
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const text = m[2]!.replace(/\s+#+\s*$/, '').trim()
    if (!text) continue
    const level = m[1]!.length
    items.push({ level, text, id: slugifyHeading(text, items.length + 1) })
  }
  return items
}

function wordCount(text: string) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const latin = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || [])
    .length
  return cjk + latin
}

function analyzeMarkdown(md: string) {
  const lines = md ? md.split(/\r?\n/).length : 0
  const words = wordCount(md)
  const chars = charCount(md)
  const headings = (md.match(/^#{1,6}\s+.+/gm) || []).length
  const links = (md.match(/\[[^\]]*\]\([^)]+\)/g) || []).length
  const images = (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length
  const codeBlocks = (md.match(/^```/gm) || []).length
  const tables = (md.match(/^\|.+\|/gm) || []).length
  const tasks = (md.match(/^\s*[-*+]\s+\[[ xX]\]\s+/gm) || []).length
  const tasksDone = (md.match(/^\s*[-*+]\s+\[[xX]\]\s+/gm) || []).length
  const blockquotes = (md.match(/^>\s?/gm) || []).length
  const readingMin = Math.max(1, Math.ceil(words / 220))
  return {
    lines,
    words,
    chars,
    headings,
    links,
    images,
    codeBlocks: Math.floor(codeBlocks / 2),
    tables,
    tasks,
    tasksDone,
    blockquotes,
    readingMin,
    bytes: new Blob([md]).size,
  }
}

export default function Page() {
  const [md, setMd] = useLocalStorage('lab:markdown-previewer:md', TEMPLATES.basic!.body)
  const [softBreaks, setSoftBreaks] = useLocalStorage('lab:markdown-previewer:breaks', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:markdown-previewer:view', 'split')
  const [showHtml, setShowHtml] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const toc = useMemo(() => extractHeadings(md), [md])
  const stats = useMemo(() => analyzeMarkdown(md), [md])
  const htmlRaw = useMemo(() => sanitizeHtml(mdToHtml(md, softBreaks)), [md, softBreaks])
  const html = useMemo(
    () => addHeadingIds(htmlRaw, toc.map((t) => t.id)),
    [htmlRaw, toc],
  )

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function exportHtml() {
    const doc = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>markdown-preview</title>
<style>
body{font-family:system-ui,sans-serif;line-height:1.65;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111}
pre{overflow:auto;padding:0.85rem 1rem;background:#f4f4f5;border-radius:8px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.92em}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:0.4rem 0.6rem}
blockquote{margin:0;padding:0.2rem 0 0.2rem 0.9rem;border-left:3px solid #ccc;color:#555}
img{max-width:100%}
</style>
</head>
<body>
${html}
</body>
</html>`
    downloadText('preview.html', doc, 'text/html;charset=utf-8')
  }

  function insertSnippet(snippet: string, cursorOffset?: number) {
    const el = editorRef.current
    if (!el) {
      setMd(limitText(md + snippet, MD_MAX))
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = md.slice(start, end)
    let next = snippet
    let caret = start + (cursorOffset ?? snippet.length)
    if (selected && (snippet === '****' || snippet === '**' || snippet === '``')) {
      const wrap = snippet.slice(0, snippet.length / 2)
      next = `${wrap}${selected}${wrap}`
      caret = start + next.length
    } else if (selected && snippet.startsWith('[')) {
      next = snippet.replace('文字', selected)
      caret = start + next.length
    }
    const merged = limitText(md.slice(0, start) + next + md.slice(end), MD_MAX)
    setMd(merged)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setLoadError('')
    try {
      const text = await file.text()
      if (text.length > FILE_MAX) {
        setLoadError(`檔案過大（上限 ${FILE_MAX.toLocaleString()} 字元）`)
        return
      }
      setMd(limitText(text, MD_MAX))
    } catch {
      setLoadError('無法讀取檔案')
    }
  }

  function jumpToHeading(id: string) {
    setView((v) => (v === 'edit' ? 'split' : v))
    requestAnimationFrame(() => {
      const root = previewRef.current
      const el = root?.querySelector(`#${CSS.escape(id)}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row mdp-shell-actions">
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(md, 'md')} icon="copy">
            {copied === 'md' ? '已複製' : '複製 MD'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!html}
            onClick={() => void copyVal(html, 'html')}
            icon="copy"
          >
            {copied === 'html' ? '已複製' : '複製 HTML'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!md}
            onClick={() => downloadText('preview.md', md, 'text/markdown;charset=utf-8')}
          >
            匯出 MD
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!html} onClick={exportHtml}>
            匯出 HTML
          </ActionButton>
        </div>
      }
    >
      <div className="mdp-calc">
        <div className="pw-stats">
          <span className="metric mono">{stats.chars.toLocaleString()} 字</span>
          <span className="tag">{stats.words.toLocaleString()} 詞</span>
          <span className="tag">{stats.lines.toLocaleString()} 行</span>
          <span className="tag">約 {stats.readingMin} 分</span>
          <span className="tag">標題 {stats.headings}</span>
          <span className="tag">連結 {stats.links}</span>
        </div>

        <div className="panel mdp-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row mdp-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '編輯'],
                  ['preview', '預覽'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">範本</div>
            <div className="pw-chips">
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    if (md.trim() && !confirm('套用範本會覆蓋目前內容，確定？')) return
                    setMd(t.body)
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row mdp-options">
            <label className="mdp-check">
              <input
                type="checkbox"
                checked={softBreaks}
                onChange={(e) => setSoftBreaks(e.target.checked)}
              />
              <span>軟換行（GFM breaks）</span>
            </label>
            <label className="mdp-check">
              <input type="checkbox" checked={showHtml} onChange={(e) => setShowHtml(e.target.checked)} />
              <span>顯示 HTML 原始碼</span>
            </label>
            <ActionButton className="btn sm ghost" onClick={() => setMd('')}>
              清空
            </ActionButton>
          </div>

          <FileDrop
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            maxBytes={FILE_MAX}
            label="匯入 Markdown 檔"
            hint="拖放或點擊選擇 .md / .txt"
            onFiles={(files) => void onFiles(files)}
          />
          {loadError && <p className="field-error">{loadError}</p>}
        </div>

        <div className={`mdp-main mdp-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel mdp-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">編輯</h3>
                <span className="tag mono">
                  {stats.chars.toLocaleString()} / {MD_MAX.toLocaleString()}
                </span>
              </div>
              <div className="mdp-insert">
                <div className="label">插入</div>
                <div className="pw-chips">
                  {SNIPPETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="btn sm ghost"
                      onClick={() => insertSnippet(s.insert, s.cursor)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={editorRef}
                className="field mono mdp-textarea"
                value={md}
                maxLength={MD_MAX}
                spellCheck={false}
                onChange={(e) => setMd(limitText(e.target.value, MD_MAX))}
                placeholder="# 開始寫 Markdown…"
                aria-label="Markdown 編輯區"
              />
            </section>
          )}

          {(view === 'split' || view === 'preview') && (
            <section className="panel mdp-preview-panel">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">預覽</h3>
                <span className="tag">GFM · 已消毒</span>
              </div>
              {showHtml ? (
                <pre className="mdp-html-source mono">{html || '（空白）'}</pre>
              ) : (
                <div
                  ref={previewRef}
                  className="mdp-prose"
                  dangerouslySetInnerHTML={{ __html: html || '<p class="mdp-empty">尚無內容</p>' }}
                />
              )}
            </section>
          )}
        </div>

        <div className="mdp-bottom">
          <section className="panel mdp-toc">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">目錄</h3>
              <span className="tag">{toc.length}</span>
            </div>
            {!toc.length ? (
              <p className="muted" style={{ margin: 0 }}>
                使用 <code>#</code>～<code>######</code> 標題後會顯示於此
              </p>
            ) : (
              <ul className="mdp-toc-list">
                {toc.map((item) => (
                  <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}>
                    <button type="button" className="mdp-toc-link" onClick={() => jumpToHeading(item.id)}>
                      <span className="muted">H{item.level}</span>
                      <span>{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel mdp-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            <ul className="pw-info-list">
              <li>
                <span className="muted">字元</span>
                <strong className="mono">{stats.chars.toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">詞數（含中文）</span>
                <strong className="mono">{stats.words.toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">行數</span>
                <strong className="mono">{stats.lines.toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">大小</span>
                <strong className="mono">{formatBytes(stats.bytes)}</strong>
              </li>
              <li>
                <span className="muted">預估閱讀</span>
                <strong>約 {stats.readingMin} 分鐘</strong>
              </li>
              <li>
                <span className="muted">標題</span>
                <strong className="mono">{stats.headings}</strong>
              </li>
              <li>
                <span className="muted">連結／圖片</span>
                <strong className="mono">
                  {stats.links} / {stats.images}
                </strong>
              </li>
              <li>
                <span className="muted">程式區塊</span>
                <strong className="mono">{stats.codeBlocks}</strong>
              </li>
              <li>
                <span className="muted">表格列（含表頭）</span>
                <strong className="mono">{stats.tables}</strong>
              </li>
              <li>
                <span className="muted">待辦</span>
                <strong className="mono">
                  {stats.tasksDone}/{stats.tasks}
                </strong>
              </li>
              <li>
                <span className="muted">引用行</span>
                <strong className="mono">{stats.blockquotes}</strong>
              </li>
              <li>
                <span className="muted">HTML 長度</span>
                <strong className="mono">{html.length.toLocaleString()}</strong>
              </li>
            </ul>
            <p className="muted pw-hint">
              以 Marked（GFM）解析，輸出經消毒後預覽；內容自動存於本機。軟換行開啟時，單一換行也會變成
              <code>&lt;br&gt;</code>。
            </p>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
