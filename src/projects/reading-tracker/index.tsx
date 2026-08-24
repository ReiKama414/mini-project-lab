import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, uid } from '../../lib/utils'

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

const STATUS_LABEL: Record<Status, string> = {
  want: '想讀',
  reading: '閱讀中',
  done: '已讀完',
}

export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:reading-tracker', [])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pages, setPages] = useState(300)
  const [filter, setFilter] = useState<'all' | Status>('all')

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
    if (!title.trim()) return
    setBooks([
      {
        id: uid('read'),
        title: title.trim(),
        author: author.trim(),
        pages: Math.max(1, pages),
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

  return (
    <ProjectShell meta={meta}>
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
        <div className="grid-2">
          <input className="field" placeholder="書名" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" placeholder="作者（選填）" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input
            className="field"
            type="number"
            min={1}
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
            placeholder="總頁數"
          />
          <button className="btn accent" onClick={add}>
            加入書單
          </button>
        </div>
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
                  <button className="btn sm ghost" onClick={() => setBooks(books.filter((x) => x.id !== b.id))}>
                    刪除
                  </button>
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
                <textarea
                  className="field"
                  rows={2}
                  style={{ fontFamily: 'inherit', minHeight: 64 }}
                  placeholder="閱讀筆記…"
                  value={b.notes}
                  onChange={(e) => update(b.id, { notes: e.target.value })}
                />
              </li>
            )
          })}
          {!visible.length && <p className="muted">尚無書籍，開始追蹤閱讀進度吧</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
