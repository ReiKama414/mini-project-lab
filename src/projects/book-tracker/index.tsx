import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

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

export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:book-tracker', [])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pages, setPages] = useState(0)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')

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
    if (!title.trim()) return
    setBooks([
      {
        id: uid('bk'),
        title: title.trim(),
        author: author.trim(),
        status: 'want',
        rating: 0,
        pages: Math.max(0, pages),
        notes: '',
      },
      ...books,
    ])
    setTitle('')
    setAuthor('')
    setPages(0)
  }

  function patch(id: string, p: Partial<Book>) {
    setBooks(books.map((b) => (b.id === id ? { ...b, ...p } : b)))
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
          <input className="field" placeholder="書名" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" placeholder="作者" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input
            className="field"
            type="number"
            min={0}
            placeholder="頁數"
            value={pages || ''}
            onChange={(e) => setPages(Number(e.target.value))}
          />
          <button className="btn accent" onClick={add}>
            新增書籍
          </button>
        </div>
      </div>

      <div className="panel stack">
        <div className="row">
          <input
            className="field"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="搜尋書名、作者、筆記…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                  style={{ maxWidth: 100, marginLeft: 'auto' }}
                  value={b.pages || ''}
                  placeholder="頁數"
                  onChange={(e) => patch(b.id, { pages: Math.max(0, Number(e.target.value)) })}
                />
              </div>
              <textarea
                className="field"
                rows={2}
                style={{ fontFamily: 'inherit', minHeight: 64 }}
                placeholder="筆記、金句、心得…"
                value={b.notes}
                onChange={(e) => patch(b.id, { notes: e.target.value })}
              />
            </li>
          ))}
          {!visible.length && <p className="muted">尚無書籍紀錄</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
