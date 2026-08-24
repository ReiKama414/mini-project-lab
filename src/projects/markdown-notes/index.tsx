import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, downloadText, uid } from '../../lib/utils'

const meta = getProject('markdown-notes')!

type Note = { id: string; title: string; md: string; updatedAt: number; createdAt: number }

const MAX_ITEMS = 100
const MAX_TITLE = 80
const MAX_MD = 50000
const MAX_SEARCH = 80

function mdToHtml(src: string) {
  let html = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => `<pre><code>${String(code).trim()}</code></pre>`)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  html = html.replace(/^\- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
  return html
    .split(/\n\n+/)
    .map((b) => {
      const t = b.trim()
      if (/^<(h[1-3]|ul|pre|blockquote)/.test(t)) return b
      return `<p>${b.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

const DEMO_MD = `# Markdown 筆記

支援 **粗體**、*斜體*、~~刪除線~~ 與 \`inline code\`。

## 清單
- 第一點
- 第二點

## 連結
[範例](https://example.com)

> 引用區塊

\`\`\`
const hello = 'world'
\`\`\`
`

export default function Page() {
  const [notes, setNotes] = useLocalStorage<Note[]>('lab:markdown-notes', [
    {
      id: 'demo',
      title: '歡迎',
      md: DEMO_MD,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    },
  ])
  const [active, setActive] = useState<string | null>(notes[0]?.id ?? null)
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>('split')
  const [q, setQ] = useState('')
  const current = notes.find((n) => n.id === active) || null
  const html = useMemo(() => (current ? mdToHtml(current.md) : ''), [current])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return notes
      .filter(
        (n) =>
          !s ||
          n.title.toLowerCase().includes(s) ||
          n.md.toLowerCase().includes(s),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, q])

  function create() {
    if (notes.length >= MAX_ITEMS) return
    const n: Note = {
      id: uid('md'),
      title: '新筆記',
      md: '# 標題\n\n開始寫作…\n',
      updatedAt: Date.now(),
      createdAt: Date.now(),
    }
    setNotes([n, ...notes])
    setActive(n.id)
    setTab('edit')
  }

  function update(patch: Partial<Note>) {
    if (!current) return
    const next = { ...patch }
    if (next.title != null) next.title = limitText(next.title, MAX_TITLE)
    if (next.md != null) next.md = limitText(next.md, MAX_MD)
    setNotes(
      notes.map((n) => (n.id === current.id ? { ...n, ...next, updatedAt: Date.now() } : n)),
    )
  }

  function exportMd() {
    if (!current) return
    const name = `${current.title || 'note'}.md`.replace(/[\\/:*?"<>|]/g, '_')
    downloadText(name, current.md, 'text/markdown;charset=utf-8')
  }

  function exportHtml() {
    if (!current) return
    const doc = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><title>${current.title}</title></head><body>${html}</body></html>`
    const name = `${current.title || 'note'}.html`.replace(/[\\/:*?"<>|]/g, '_')
    downloadText(name, doc, 'text/html;charset=utf-8')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <button className="btn accent" onClick={create} disabled={notes.length >= MAX_ITEMS}>
            新增筆記
          </button>
          {notes.length >= MAX_ITEMS && <p className="field-error">已達上限 {MAX_ITEMS} 則筆記</p>}
          <div className="stack" style={{ gap: 0 }}>
            <input
              className="field"
              placeholder="搜尋…"
              value={q}
              maxLength={MAX_SEARCH}
              onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(q)} / {MAX_SEARCH}
              </span>
            </div>
          </div>
          <ul className="list">
            {visible.map((n) => (
              <li
                key={n.id}
                className="list-item"
                style={{
                  cursor: 'pointer',
                  outline: active === n.id ? '2px solid var(--accent, #f0734a)' : undefined,
                }}
                onClick={() => setActive(n.id)}
              >
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{n.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {new Date(n.updatedAt).toLocaleString('zh-TW')} · {n.md.length} 字元
                  </span>
                </div>
              </li>
            ))}
            {!visible.length && <p className="muted">尚無筆記</p>}
          </ul>
        </div>

        <div className="panel stack">
          {current ? (
            <>
              <div className="stack" style={{ gap: 0 }}>
                <input
                  className={`field${!isNonEmpty(current.title) ? ' is-invalid' : ''}`}
                  value={current.title}
                  maxLength={MAX_TITLE}
                  onChange={(e) => update({ title: limitText(e.target.value, MAX_TITLE) })}
                />
                <div className="field-meta">
                  <span className={!isNonEmpty(current.title) ? 'warn' : undefined}>
                    {!isNonEmpty(current.title) ? '標題不可空白' : '\u00a0'}
                  </span>
                  <span>
                    {charCount(current.title)} / {MAX_TITLE}
                  </span>
                </div>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['edit', '編輯'],
                    ['preview', '預覽'],
                    ['split', '分割'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={`btn sm ${tab === id ? 'accent' : 'ghost'}`}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
                <button className="btn sm teal" onClick={exportMd}>
                  匯出 .md
                </button>
                <button className="btn sm ghost" onClick={exportHtml}>
                  匯出 .html
                </button>
                <button
                  className="btn sm ghost"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    setNotes(notes.filter((n) => n.id !== current.id))
                    setActive(visible.find((n) => n.id !== current.id)?.id ?? null)
                  }}
                >
                  刪除
                </button>
              </div>

              {tab === 'edit' && (
                <div className="stack" style={{ gap: 0 }}>
                  <textarea
                    className="field mono"
                    rows={16}
                    value={current.md}
                    maxLength={MAX_MD}
                    onChange={(e) => update({ md: limitText(e.target.value, MAX_MD) })}
                  />
                  <div className="field-meta">
                    <span />
                    <span>
                      {charCount(current.md)} / {MAX_MD}
                    </span>
                  </div>
                </div>
              )}
              {tab === 'preview' && (
                <div className="metric" dangerouslySetInnerHTML={{ __html: html }} />
              )}
              {tab === 'split' && (
                <div className="grid-2">
                  <div className="stack" style={{ gap: 0 }}>
                    <textarea
                      className="field mono"
                      rows={16}
                      value={current.md}
                      maxLength={MAX_MD}
                      onChange={(e) => update({ md: limitText(e.target.value, MAX_MD) })}
                    />
                    <div className="field-meta">
                      <span />
                      <span>
                        {charCount(current.md)} / {MAX_MD}
                      </span>
                    </div>
                  </div>
                  <div className="metric" dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              )}

              <p className="muted" style={{ fontSize: 12 }}>
                建立 {new Date(current.createdAt).toLocaleString('zh-TW')} · 更新{' '}
                {new Date(current.updatedAt).toLocaleString('zh-TW')}
              </p>
            </>
          ) : (
            <p className="muted">選擇筆記</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
