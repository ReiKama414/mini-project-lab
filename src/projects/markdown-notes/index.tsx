import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, downloadText, uid } from '../../lib/utils'
import { sanitizeHtml } from '../../lib/sanitize'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtRowItem,
  FtRowList,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

const meta = getProject('markdown-notes')!

type Note = { id: string; title: string; md: string; updatedAt: number; createdAt: number }

const MAX_ITEMS = 100
const MAX_TITLE = 80
const MAX_MD = 50000
const MAX_SEARCH = 80

function mdToHtml(src: string) {
  const raw = marked.parse(src, { async: false })
  return typeof raw === 'string' ? raw : String(raw)
}

const DEMO_MD = `# Markdown 筆記

支援 **粗體**、*斜體*、~~刪除線~~ 與 \`inline code\`

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
  const html = useMemo(() => (current ? sanitizeHtml(mdToHtml(current.md)) : ''), [current])

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
    <FeatureLayout
      meta={meta}
      variant="stacked"
      actions={
        <div className="row">
          <AddButton onClick={create} disabled={notes.length >= MAX_ITEMS}>
            新增筆記
          </AddButton>
          <ActionButton className="btn sm ghost" disabled={!current} onClick={exportMd}>
            匯出 .md
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!current} onClick={exportHtml}>
            匯出 .html
          </ActionButton>
        </div>
      }
      toolbar={
        <>
          <div className="field-wrap">
            <input
              className="field"
              placeholder="搜尋標題或 Markdown…"
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
          <div className="ft-samples">
            <span className="muted">範例：</span>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                const demo = notes.find((n) => n.id === 'demo')
                if (demo) setActive(demo.id)
              }}
            >
              歡迎筆記
            </button>
          </div>
        </>
      }
      aside={
        <>
          <FtSection title="筆記列表">
            <FtRowList>
              {visible.map((n) => (
                <FtRowItem key={n.id}>
                  <button
                    type="button"
                    className="stack"
                    style={{
                      flex: 1,
                      gap: 2,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      outline: active === n.id ? '2px solid var(--accent, #f0734a)' : undefined,
                      borderRadius: 6,
                    }}
                    onClick={() => setActive(n.id)}
                  >
                    <strong>{n.title}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(n.updatedAt).toLocaleString('zh-TW')} · {n.md.length} 字元
                    </span>
                  </button>
                </FtRowItem>
              ))}
            </FtRowList>
            {!visible.length && <p className="muted">尚無筆記</p>}
          </FtSection>
          {tab === 'preview' || tab === 'split' ? (
            <FtSection title="即時預覽">
              <div className="metric" dangerouslySetInnerHTML={{ __html: html }} />
            </FtSection>
          ) : null}
        </>
      }
      infoItems={[
        { label: '儲存', value: '本機 localStorage' },
        { label: '筆記上限', value: `${MAX_ITEMS} 則` },
        { label: 'Markdown', value: `marked 解析，單則 ${MAX_MD.toLocaleString()} 字元` },
        { label: '預覽', value: 'HTML 經 sanitize 後渲染' },
      ]}
      faq={[
        ftPrivacyLocal,
        {
          title: '分割模式',
          body: '「分割」可同時編輯與預覽；側欄也會顯示即時預覽（編輯／預覽模式）。',
        },
        {
          title: '匯出 HTML',
          body: '匯出的 HTML 為靜態片段，不含站內樣式，適合封存或離線閱讀。',
        },
      ]}
    >
      <FtToolRoot>
      {current ? (
        <>
          <FtToolHero
            emoji="📄"
            title={current.title}
            subtitle={`${tab === 'edit' ? '編輯' : tab === 'preview' ? '預覽' : '分割'}模式 · 更新 ${new Date(current.updatedAt).toLocaleString('zh-TW')}`}
            badge={notes.length >= MAX_ITEMS ? <span className="tag">已達上限</span> : null}
          />
          <FtMetricGrid>
            <FtMetric label="筆記數" value={`${notes.length} / ${MAX_ITEMS}`} />
            <FtMetric label="篩選" value={visible.length} />
            <FtMetric label="Markdown 字元" value={charCount(current.md)} />
            <FtMetric label="模式" value={tab === 'split' ? '分割' : tab === 'preview' ? '預覽' : '編輯'} />
          </FtMetricGrid>
          <FtSection title="編輯器">
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
            <DeleteButton
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setNotes(notes.filter((n) => n.id !== current.id))
                setActive(visible.find((n) => n.id !== current.id)?.id ?? null)
              }}
              label="刪除"
            />
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
          </FtSection>
        </>
      ) : (
        <>
          <FtToolHero emoji="📄" title={`${notes.length} 則 Markdown`} subtitle="從側欄選擇或新增筆記" />
          <p className="muted">選擇筆記</p>
        </>
      )}
      </FtToolRoot>
    </FeatureLayout>
  )
}
