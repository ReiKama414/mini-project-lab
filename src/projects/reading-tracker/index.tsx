import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('reading-tracker')!

type Status = 'want' | 'reading' | 'done'

type Book = {
  id: string
  title: string
  author: string
  pages: number
  current: number
  status: Status
  notes: string
  finishDate?: string
  addedAt: string
}

type OlDoc = {
  key: string
  title?: string
  author_name?: string[]
  number_of_pages_median?: number
}

type OlSearchResponse = {
  docs?: OlDoc[]
}

const STATUS_LABEL: Record<Status, string> = {
  want: '想讀',
  reading: '閱讀中',
  done: '已讀完',
}

const MAX_ITEMS = 200
const MAX_TITLE = 120
const MAX_AUTHOR = 80
const MAX_NOTES = 2000
const MAX_PAGES = 100000
const MAX_OL_Q = 80

export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:reading-tracker', [])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pagesStr, setPagesStr] = useState('300')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [olQ, setOlQ] = useState('')
  const [olResults, setOlResults] = useState<OlDoc[]>([])
  const [olLoading, setOlLoading] = useState(false)
  const [olError, setOlError] = useState('')

  const pages = parseNumber(pagesStr)
  const titleOk = isNonEmpty(title)
  const pagesOk = Number.isFinite(pages) && pages >= 1
  const atLimit = books.length >= MAX_ITEMS
  const canAdd = titleOk && pagesOk && !atLimit

  const visible = useMemo(
    () => (filter === 'all' ? books : books.filter((b) => b.status === filter)),
    [books, filter],
  )

  const stats = useMemo(() => {
    const done = books.filter((b) => b.status === 'done').length
    const reading = books.filter((b) => b.status === 'reading').length
    const pagesRead = books.reduce((s, b) => s + Math.min(b.current, b.pages), 0)
    return { done, reading, pagesRead }
  }, [books])

  function add() {
    if (!canAdd || !Number.isFinite(pages)) return
    setBooks([
      {
        id: uid('read'),
        title: title.trim(),
        author: author.trim(),
        pages: clamp(Math.round(pages), 1, MAX_PAGES),
        current: 0,
        status: 'reading',
        notes: '',
        addedAt: new Date().toISOString().slice(0, 10),
      },
      ...books,
    ])
    setTitle('')
    setAuthor('')
  }

  function update(id: string, patch: Partial<Book>) {
    setBooks(
      books.map((b) => {
        if (b.id !== id) return b
        const next = { ...b, ...patch }
        if (patch.notes != null) next.notes = limitText(patch.notes, MAX_NOTES)
        if (patch.current != null) {
          next.current = clamp(patch.current, 0, next.pages)
          if (next.current >= next.pages) {
            next.status = 'done'
            next.finishDate = next.finishDate || new Date().toISOString().slice(0, 10)
          } else if (next.status === 'done' && next.current < next.pages) {
            next.status = 'reading'
            next.finishDate = undefined
          }
        }
        if (patch.status === 'done') {
          next.current = next.pages
          next.finishDate = next.finishDate || new Date().toISOString().slice(0, 10)
        }
        if (patch.status === 'want' || patch.status === 'reading') {
          if (patch.status === 'want') next.current = 0
          next.finishDate = undefined
        }
        return next
      }),
    )
  }

  async function searchOpenLibrary() {
    const q = olQ.trim()
    if (!q) {
      setOlError('請輸入書名或作者')
      setOlResults([])
      return
    }
    setOlLoading(true)
    setOlError('')
    setOlResults([])
    try {
      const params = new URLSearchParams({ q, limit: '8' })
      const res = await fetch(`https://openlibrary.org/search.json?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as OlSearchResponse
      const docs = data.docs ?? []
      setOlResults(docs)
      if (!docs.length) setOlError('找不到符合的書籍')
    } catch {
      setOlResults([])
      setOlError('無法連線 Open Library，請改為手動填寫。')
    } finally {
      setOlLoading(false)
    }
  }

  function pickOl(doc: OlDoc) {
    setTitle(limitText(doc.title?.trim() || '', MAX_TITLE))
    const authorName = doc.author_name?.[0]?.trim() || ''
    setAuthor(limitText(authorName, MAX_AUTHOR))
    const n = doc.number_of_pages_median
    if (typeof n === 'number' && n >= 1) {
      setPagesStr(String(clamp(Math.round(n), 1, MAX_PAGES)))
    }
    setOlResults([])
    setOlError('')
  }

  function exportJson() {
    downloadText('reading-tracker.json', JSON.stringify(books, null, 2), 'application/json;charset=utf-8')
  }

  function exportCsv() {
    const header = 'title,author,pages,current,status,notes,finishDate,addedAt'
    const body = books
      .map(
        (b) =>
          `${JSON.stringify(b.title)},${JSON.stringify(b.author)},${b.pages},${b.current},${b.status},${JSON.stringify(b.notes)},${JSON.stringify(b.finishDate ?? '')},${JSON.stringify(b.addedAt)}`,
      )
      .join('\n')
    downloadText('reading-tracker.csv', `${header}\n${body}`, 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost sm" disabled={!books.length} onClick={exportJson}>
            匯出 JSON
          </button>
          <button type="button" className="btn ghost sm" disabled={!books.length} onClick={exportCsv}>
            匯出 CSV
          </button>
        </div>
      }
    >
      <div className="panel stack">
        <div className="grid-3">
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              閱讀中
            </div>
            <div style={{ fontSize: 24 }}>{stats.reading}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              已讀完
            </div>
            <div style={{ fontSize: 24 }}>{stats.done}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              累計頁數
            </div>
            <div style={{ fontSize: 24 }}>{stats.pagesRead}</div>
          </div>
        </div>
        <div className="label" style={{ margin: 0 }}>
          Open Library 搜尋（選填）
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: 1, minWidth: 160, gap: 0 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋書名／作者並帶入…"
              value={olQ}
              maxLength={MAX_OL_Q}
              onChange={(e) => setOlQ(limitText(e.target.value, MAX_OL_Q))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchOpenLibrary()
              }}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(olQ)} / {MAX_OL_Q}
              </span>
            </div>
          </div>
          <button type="button" className="btn ghost" disabled={olLoading || !olQ.trim()} onClick={() => void searchOpenLibrary()}>
            {olLoading ? '搜尋中…' : '搜尋'}
          </button>
        </div>
        {olError && <p className="field-error">{olError}</p>}
        {olResults.length > 0 && (
          <ul className="list">
            {olResults.map((doc) => (
              <li key={doc.key} className="list-item row" style={{ cursor: 'pointer' }} onClick={() => pickOl(doc)}>
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{doc.title || '（無書名）'}</strong>
                  <span className="muted">
                    {doc.author_name?.[0] || '未知作者'}
                    {doc.number_of_pages_median ? ` · ${doc.number_of_pages_median} 頁` : ''}
                  </span>
                </div>
                <button type="button" className="btn sm teal" onClick={(e) => { e.stopPropagation(); pickOl(doc) }}>
                  選用
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid-2">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="書名"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入書名' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className="field"
              placeholder="作者（選填）"
              value={author}
              maxLength={MAX_AUTHOR}
              onChange={(e) => setAuthor(limitText(e.target.value, MAX_AUTHOR))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(author)} / {MAX_AUTHOR}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${!pagesOk ? ' is-invalid' : ''}`}
              type="number"
              min={1}
              max={MAX_PAGES}
              value={pagesStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setPagesStr(e.target.value)
                else setPagesStr(String(clamp(Math.round(n), 1, MAX_PAGES)))
              }}
              placeholder="總頁數"
            />
            {!pagesOk && <p className="field-error">頁數須為 1–{MAX_PAGES.toLocaleString()}</p>}
          </div>
          <button className="btn accent" onClick={add} disabled={!canAdd} style={{ alignSelf: 'end' }}>
            加入書單
          </button>
        </div>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 本，請先刪除再新增</p>}
      </div>

      <div className="panel stack">
        <div className="row">
          {(['all', 'reading', 'want', 'done'] as const).map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'accent' : 'ghost'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <ul className="list">
          {visible.map((b) => {
            const pct = Math.round((b.current / b.pages) * 100)
            return (
              <li key={b.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                <div className="row">
                  <div className="stack" style={{ flex: 1, gap: 2 }}>
                    <strong>{b.title}</strong>
                    <span className="muted">{b.author || '未知作者'}</span>
                  </div>
                  <select
                    className="field"
                    style={{ maxWidth: 120 }}
                    value={b.status}
                    onChange={(e) => update(b.id, { status: e.target.value as Status })}
                  >
                    <option value="want">想讀</option>
                    <option value="reading">閱讀中</option>
                    <option value="done">已讀完</option>
                  </select>
                  <DeleteButton onClick={() => setBooks(books.filter((x) => x.id !== b.id))} label="刪除" />
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="row">
                  <span className="muted">
                    {b.current}/{b.pages} 頁（{pct}%）
                  </span>
                  {b.finishDate && <span className="tag">完成於 {b.finishDate}</span>}
                  <input
                    type="range"
                    min={0}
                    max={b.pages}
                    value={b.current}
                    onChange={(e) => update(b.id, { current: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="stack" style={{ gap: 0 }}>
                  <textarea
                    className="field"
                    rows={2}
                    style={{ fontFamily: 'inherit', minHeight: 64 }}
                    placeholder="閱讀筆記…"
                    value={b.notes}
                    maxLength={MAX_NOTES}
                    onChange={(e) => update(b.id, { notes: limitText(e.target.value, MAX_NOTES) })}
                  />
                  <div className="field-meta">
                    <span />
                    <span>
                      {charCount(b.notes)} / {MAX_NOTES}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
          {!visible.length && <p className="muted">尚無書籍，開始追蹤閱讀進度吧</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
