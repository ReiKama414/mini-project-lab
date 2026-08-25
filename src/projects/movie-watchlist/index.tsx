import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('movie-watchlist')!

type Status = 'want' | 'watching' | 'watched'

type Movie = {
  id: string
  title: string
  year: string
  status: Status
  rating: number
  genres: string[]
  notes: string
}

const GENRES = ['劇情', '喜劇', '動作', '科幻', '恐怖', '動畫', '紀錄片', '愛情', '驚悚']
const STATUS_LABEL: Record<Status, string> = {
  want: '想看',
  watching: '觀看中',
  watched: '已看',
}

const MAX_ITEMS = 200
const MAX_TITLE = 120
const MAX_YEAR = 4
const MAX_NOTES = 1000
const MAX_SEARCH = 80

export default function Page() {
  const [movies, setMovies] = useLocalStorage<Movie[]>('lab:movie-watchlist', [])
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [genreFilter, setGenreFilter] = useState('all')
  const [search, setSearch] = useState('')

  const titleOk = isNonEmpty(title)
  const yearNum = year.trim() ? parseNumber(year) : NaN
  const yearOk = !year.trim() || (Number.isFinite(yearNum) && yearNum >= 1888 && yearNum <= 2100)
  const atLimit = movies.length >= MAX_ITEMS
  const canAdd = titleOk && yearOk && !atLimit

  const visible = useMemo(() => {
    return movies.filter((m) => {
      const genres = m.genres ?? []
      const notes = m.notes ?? ''
      if (filter !== 'all' && m.status !== filter) return false
      if (genreFilter !== 'all' && !genres.includes(genreFilter)) return false
      const q = search.trim().toLowerCase()
      if (q && !m.title.toLowerCase().includes(q) && !notes.toLowerCase().includes(q)) return false
      return true
    })
  }, [movies, filter, genreFilter, search])

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  function add() {
    if (!canAdd) return
    setMovies([
      {
        id: uid('mv'),
        title: title.trim(),
        year: year.trim(),
        status: 'want',
        rating: 0,
        genres: [...genres],
        notes: '',
      },
      ...movies,
    ])
    setTitle('')
    setYear('')
    setGenres([])
  }

  function patch(id: string, p: Partial<Movie>) {
    setMovies(
      movies.map((m) =>
        m.id === id
          ? {
              ...m,
              ...p,
              notes: p.notes != null ? limitText(p.notes, MAX_NOTES) : m.notes,
              rating: p.rating != null ? clamp(p.rating, 0, 5) : m.rating,
            }
          : m,
      ),
    )
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-2">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="片名"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入片名' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${year.trim() && !yearOk ? ' is-invalid' : ''}`}
              placeholder="年份（選填）"
              value={year}
              maxLength={MAX_YEAR}
              onChange={(e) => setYear(limitText(e.target.value.replace(/\D/g, ''), MAX_YEAR))}
            />
            <div className="field-meta">
              <span className={year.trim() && !yearOk ? 'warn' : undefined}>
                {year.trim() && !yearOk ? '年份須為 1888–2100' : '\u00a0'}
              </span>
              <span>
                {charCount(year)} / {MAX_YEAR}
              </span>
            </div>
          </div>
        </div>
        <div className="row">
          <span className="muted">類型標籤</span>
          {GENRES.map((g) => (
            <button key={g} className={`btn sm ${genres.includes(g) ? 'teal' : 'ghost'}`} onClick={() => toggleGenre(g)}>
              {g}
            </button>
          ))}
        </div>
        <button className="btn accent" onClick={add} disabled={!canAdd}>
          加入片單
        </button>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 部，請先刪除再新增</p>}
      </div>

      <div className="panel stack">
        <div className="row">
          <div className="stack" style={{ flex: 1, minWidth: 140, gap: 0 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋片名或備註…"
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
          {(['all', 'want', 'watching', 'watched'] as const).map((f) => (
            <button key={f} className={`btn sm ${filter === f ? 'accent' : 'ghost'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : STATUS_LABEL[f]}
            </button>
          ))}
          <select className="field" style={{ maxWidth: 140 }} value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
            <option value="all">所有類型</option>
            {GENRES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        <ul className="list">
          {visible.map((m) => (
            <li key={m.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div className="row">
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>
                    {m.title} {m.year && <span className="muted">({m.year})</span>}
                  </strong>
                  <div className="row">
                    {(m.genres ?? []).map((g) => (
                      <span key={g} className="tag">
                        {g}
                      </span>
                    ))}
                    {!(m.genres ?? []).length && <span className="muted">未標類型</span>}
                  </div>
                </div>
                <select
                  className="field"
                  style={{ maxWidth: 120 }}
                  value={m.status}
                  onChange={(e) => patch(m.id, { status: e.target.value as Status })}
                >
                  <option value="want">想看</option>
                  <option value="watching">觀看中</option>
                  <option value="watched">已看</option>
                </select>
                <button className="btn sm ghost" onClick={() => setMovies(movies.filter((x) => x.id !== m.id))}>
                  刪除
                </button>
              </div>
              <div className="row">
                <span className="muted">評分</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`btn sm ${m.rating >= n ? 'accent' : 'ghost'}`}
                    onClick={() => patch(m.id, { rating: m.rating === n ? 0 : n })}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="stack" style={{ gap: 0 }}>
                <textarea
                  className="field"
                  rows={2}
                  style={{ fontFamily: 'inherit', minHeight: 56 }}
                  placeholder="觀影備註…"
                  value={m.notes ?? ''}
                  maxLength={MAX_NOTES}
                  onChange={(e) => patch(m.id, { notes: limitText(e.target.value, MAX_NOTES) })}
                />
                <div className="field-meta">
                  <span />
                  <span>
                    {charCount(m.notes ?? '')} / {MAX_NOTES}
                  </span>
                </div>
              </div>
            </li>
          ))}
          {!visible.length && <p className="muted">沒有符合條件的電影</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
