import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('book-tracker')!

type Status = 'want' | 'reading' | 'done'

type Book = {
  id: string
  title: string
  author: string
  status: Status
  rating: number
  pages: number
  notes: string
}

const STATUS_LABEL: Record<Status, string> = {
  want: '想讀',
  reading: '閱讀中',
  done: '已讀',
}

const MAX_ITEMS = 200
const MAX_TITLE = 120
const MAX_AUTHOR = 80
const MAX_NOTES = 2000
const MAX_PAGES = 100000
const MAX_SEARCH = 80

export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:book-tracker', [])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pagesStr, setPagesStr] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')

  const pages = pagesStr.trim() ? parseNumber(pagesStr) : 0
  const titleOk = isNonEmpty(title)
  const pagesOk = Number.isFinite(pages) && pages >= 0
  const atLimit = books.length >= MAX_ITEMS
  const canAdd = titleOk && pagesOk && !atLimit

  const visible = useMemo(() => {
    return books.filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false
      const q = search.trim().toLowerCase()
      if (
        q &&
        !b.title.toLowerCase().includes(q) &&
        !b.author.toLowerCase().includes(q) &&
        !b.notes.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [books, filter, search])

  const avgRating = useMemo(() => {
    const rated = books.filter((b) => b.rating > 0)
    if (!rated.length) return 0
    return Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10
  }, [books])

  function add() {
    if (!canAdd || !Number.isFinite(pages)) return
    setBooks([
      {
        id: uid('bk'),
        title: title.trim(),
        author: author.trim(),
        status: 'want',
        rating: 0,
        pages: clamp(Math.round(pages), 0, MAX_PAGES),
        notes: '',
      },
      ...books,
    ])
    setTitle('')
    setAuthor('')
    setPagesStr('')
  }

  function patch(id: string, p: Partial<Book>) {
    setBooks(
      books.map((b) =>
        b.id === id
          ? {
              ...b,
              ...p,
              notes: p.notes != null ? limitText(p.notes, MAX_NOTES) : b.notes,
              pages: p.pages != null ? clamp(p.pages, 0, MAX_PAGES) : b.pages,
              rating: p.rating != null ? clamp(p.rating, 0, 5) : b.rating,
            }
          : b,
      ),
    )
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-3">
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              藏書
            </div>
            <div style={{ fontSize: 24 }}>{books.length}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              已讀
            </div>
            <div style={{ fontSize: 24 }}>{books.filter((b) => b.status === 'done').length}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              平均評分
            </div>
            <div style={{ fontSize: 24 }}>{avgRating || '—'}</div>
          </div>
        </div>
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
              placeholder="作者"
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
              className={`field${pagesStr !== '' && !pagesOk ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={MAX_PAGES}
              placeholder="頁數"
              value={pagesStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setPagesStr(e.target.value)
                else setPagesStr(String(clamp(Math.round(n), 0, MAX_PAGES)))
              }}
            />
            {pagesStr !== '' && !pagesOk && <p className="field-error">頁數須 ≥ 0</p>}
          </div>
          <button className="btn accent" onClick={add} disabled={!canAdd} style={{ alignSelf: 'end' }}>
            新增書籍
          </button>
        </div>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 本，請先刪除再新增</p>}
      </div>

      <div className="panel stack">
        <div className="row">
          <div className="stack" style={{ flex: 1, minWidth: 140, gap: 0 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋書名、作者、筆記…"
              value={search}
              maxLength={MAX_SEARCH}
              onChange={(e) => setSearch(limitText(e.target.value, MAX_SEARCH))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(search)} / {MAX_SEARCH}
              </span>
            </div>
          </div>
          {(['all', 'want', 'reading', 'done'] as const).map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'accent' : 'ghost'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <ul className="list">
          {visible.map((b) => (
            <li key={b.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div className="row">
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{b.title}</strong>
                  <span className="muted">
                    {b.author || '未知作者'}
                    {b.pages > 0 ? ` · ${b.pages} 頁` : ''}
                  </span>
                </div>
                <select
                  className="field"
                  style={{ maxWidth: 120 }}
                  value={b.status}
                  onChange={(e) => patch(b.id, { status: e.target.value as Status })}
                >
                  <option value="want">想讀</option>
                  <option value="reading">閱讀中</option>
                  <option value="done">已讀</option>
                </select>
                <button className="btn sm ghost" onClick={() => setBooks(books.filter((x) => x.id !== b.id))}>
                  刪
                </button>
              </div>
              <div className="row">
                <span className="muted">評分</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`btn sm ${b.rating >= n ? 'accent' : 'ghost'}`}
                    onClick={() => patch(b.id, { rating: b.rating === n ? 0 : n })}
                  >
                    ★
                  </button>
                ))}
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={MAX_PAGES}
                  style={{ maxWidth: 100, marginLeft: 'auto' }}
                  value={b.pages || ''}
                  placeholder="頁數"
                  onChange={(e) => {
                    const n = parseNumber(e.target.value)
                    patch(b.id, { pages: !Number.isFinite(n) ? 0 : clamp(Math.round(n), 0, MAX_PAGES) })
                  }}
                />
              </div>
              <div className="stack" style={{ gap: 0 }}>
                <textarea
                  className="field"
                  rows={2}
                  style={{ fontFamily: 'inherit', minHeight: 64 }}
                  placeholder="筆記、金句、心得…"
                  value={b.notes}
                  maxLength={MAX_NOTES}
                  onChange={(e) => patch(b.id, { notes: limitText(e.target.value, MAX_NOTES) })}
                />
                <div className="field-meta">
                  <span />
                  <span>
                    {charCount(b.notes)} / {MAX_NOTES}
                  </span>
                </div>
              </div>
            </li>
          ))}
          {!visible.length && <p className="muted">尚無書籍紀錄</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
