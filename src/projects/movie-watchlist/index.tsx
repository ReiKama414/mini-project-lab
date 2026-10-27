import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { ActionButton } from '../../components/ActionButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'
import { AddButton } from '../../components/AddButton'
import {
  FtMetric,
  FtMetricGrid,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

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

type ItunesMovie = {
  trackId: number
  trackName?: string
  trackCensoredName?: string
  releaseDate?: string
  primaryGenreName?: string
}

type ItunesSearchResponse = {
  resultCount: number
  results: ItunesMovie[]
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
const MAX_ITUNES_Q = 80

const MOVIE_SAMPLES = [
  { label: '科幻', title: '星際效應', year: '2014', genres: ['科幻'] },
  { label: '動畫', title: '神隱少女', year: '2001', genres: ['動畫'] },
  { label: '劇情', title: '肖申克的救贖', year: '1994', genres: ['劇情'] },
]

function mapItunesGenre(raw?: string): string | null {
  if (!raw) return null
  const g = raw.toLowerCase()
  if (g.includes('comedy')) return '喜劇'
  if (g.includes('action') || g.includes('adventure')) return '動作'
  if (g.includes('sci') || g.includes('fantasy')) return '科幻'
  if (g.includes('horror')) return '恐怖'
  if (g.includes('animation') || g.includes('kids') || g.includes('family')) return '動畫'
  if (g.includes('documentary')) return '紀錄片'
  if (g.includes('romance') || g.includes('romantic')) return '愛情'
  if (g.includes('thriller') || g.includes('suspense') || g.includes('mystery')) return '驚悚'
  if (g.includes('drama')) return '劇情'
  return null
}

function yearFromRelease(iso?: string): string {
  if (!iso) return ''
  const y = iso.slice(0, 4)
  return /^\d{4}$/.test(y) ? y : ''
}

export default function Page() {
  const [movies, setMovies] = useLocalStorage<Movie[]>('lab:movie-watchlist', [])
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [genreFilter, setGenreFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [itunesQ, setItunesQ] = useState('')
  const [itunesResults, setItunesResults] = useState<ItunesMovie[]>([])
  const [itunesLoading, setItunesLoading] = useState(false)
  const [itunesError, setItunesError] = useState('')

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

  const movieStats = useMemo(() => {
    const watched = movies.filter((m) => m.status === 'watched').length
    const watching = movies.filter((m) => m.status === 'watching').length
    const rated = movies.filter((m) => m.rating > 0)
    const avgRating = rated.length
      ? Math.round((rated.reduce((s, m) => s + m.rating, 0) / rated.length) * 10) / 10
      : 0
    return { watched, watching, avgRating }
  }, [movies])

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

  async function searchItunes() {
    const term = itunesQ.trim()
    if (!term) {
      setItunesError('請輸入要搜尋的片名')
      setItunesResults([])
      return
    }
    setItunesLoading(true)
    setItunesError('')
    setItunesResults([])
    try {
      const params = new URLSearchParams({
        term,
        entity: 'movie',
        limit: '8',
        country: 'tw',
      })
      const res = await fetch(`https://itunes.apple.com/search?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ItunesSearchResponse
      const list = data.results ?? []
      setItunesResults(list)
      if (!list.length) setItunesError('找不到符合的電影，請試試其他關鍵字')
    } catch {
      setItunesResults([])
      setItunesError('無法連線 iTunes 搜尋（可能被網路或 CORS 阻擋），請改為手動填寫片名')
    } finally {
      setItunesLoading(false)
    }
  }

  function exportJson() {
    downloadText(
      'movie-watchlist.json',
      JSON.stringify({ version: 1, movies }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  function applyMovieSample(s: (typeof MOVIE_SAMPLES)[0]) {
    setTitle(s.title)
    setYear(s.year)
    setGenres(s.genres)
  }

  function pickItunes(item: ItunesMovie) {
    const name = item.trackCensoredName || item.trackName || ''
    setTitle(limitText(name, MAX_TITLE))
    setYear(yearFromRelease(item.releaseDate))
    const mapped = mapItunesGenre(item.primaryGenreName)
    setGenres(mapped ? [mapped] : [])
    setItunesResults([])
    setItunesError('')
  }

  return (
    <FeatureLayout
      variant="unified"
      meta={meta}
      actions={
        <ActionButton className="btn sm ghost" disabled={!movies.length} onClick={exportJson} icon="download">
          匯出 JSON
        </ActionButton>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h2 className="pw-panel-title">片名範例</h2>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {MOVIE_SAMPLES.map((s) => (
              <button key={s.label} type="button" className="btn sm ghost" onClick={() => applyMovieSample(s)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ft-stats-row">
            <span className="tag">顯示 {visible.length} 部</span>
            <span className="tag">共 {movies.length} / {MAX_ITEMS}</span>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '清單上限', value: `${MAX_ITEMS} 部` },
        { label: 'iTunes 搜尋', value: '選填，由瀏覽器請求 Apple iTunes API' },
      ]}
      faq={[ftPrivacyLocal, { title: '類型', body: '可多選類型標籤；iTunes 帶入的類型會對應到本工具清單。' }]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🎬"
          title={movies.length}
          subtitle="片單總數"
          meta={
            <>
              已看 {movieStats.watched} · 觀看中 {movieStats.watching}
              {movieStats.avgRating ? ` · 平均 ${movieStats.avgRating} 星` : ''}
              <br />
              篩選：{filter === 'all' ? '全部狀態' : STATUS_LABEL[filter]}
              {genreFilter !== 'all' ? ` · ${genreFilter}` : ''}
            </>
          }
        />
        <FtMetricGrid>
          <FtMetric label="想看" value={movies.filter((m) => m.status === 'want').length} />
          <FtMetric label="觀看中" value={movieStats.watching} />
          <FtMetric label="已看" value={movieStats.watched} />
          <FtMetric label="平均評分" value={movieStats.avgRating || '—'} />
        </FtMetricGrid>

        <FtSection title="加入片單" hint="iTunes 搜尋為選填">
        <div className="label" style={{ margin: 0 }}>
          iTunes 搜尋
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ flex: 1, minWidth: 160, gap: 0 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋電影並帶入欄位…"
              value={itunesQ}
              maxLength={MAX_ITUNES_Q}
              onChange={(e) => setItunesQ(limitText(e.target.value, MAX_ITUNES_Q))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchItunes()
              }}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(itunesQ)} / {MAX_ITUNES_Q}
              </span>
            </div>
          </div>
          <ActionButton className="btn ghost" disabled={itunesLoading || !itunesQ.trim()} onClick={() => void searchItunes()} icon="search">
            {itunesLoading ? '搜尋中…' : '搜尋'}
          </ActionButton>
        </div>
        {itunesError && <p className="field-error">{itunesError}</p>}
        {itunesResults.length > 0 && (
          <ul className="list">
            {itunesResults.map((r) => (
              <li key={r.trackId} className="list-item row" style={{ cursor: 'pointer' }} onClick={() => pickItunes(r)}>
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{r.trackCensoredName || r.trackName}</strong>
                  <span className="muted">
                    {yearFromRelease(r.releaseDate) || '年份未知'}
                    {r.primaryGenreName ? ` · ${r.primaryGenreName}` : ''}
                  </span>
                </div>
                <button type="button" className="btn sm teal" onClick={(e) => { e.stopPropagation(); pickItunes(r) }}>
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
            <button type="button" key={g} className={`btn sm ${genres.includes(g) ? 'teal' : 'ghost'}`} onClick={() => toggleGenre(g)}>
              {g}
            </button>
          ))}
        </div>
        <AddButton onClick={add} disabled={!canAdd}>
          加入片單
        </AddButton>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 部，請先刪除再新增</p>}
        </FtSection>

        <FtSection title="片單">
        <div className="row">
          <div className="field-wrap" style={{ flex: 1, minWidth: 140 }}>
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
            <button type="button" key={f} className={`btn sm ${filter === f ? 'accent' : 'ghost'}`} onClick={() => setFilter(f)}>
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
                <DeleteButton onClick={() => setMovies(movies.filter((x) => x.id !== m.id))} label="刪除" />
              </div>
              <div className="row">
                <span className="muted">評分</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button"
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
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
