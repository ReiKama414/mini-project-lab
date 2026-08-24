import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('github-contrib')!

type DayCell = { date: string; count: number }
type Stats = {
  total: number
  maxStreak: number
  currentStreak: number
  busiest: string
  source: 'api' | 'mock'
  events?: number
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s
  }
}

function buildMockYear(username: string): DayCell[] {
  const rand = seeded(username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 1)
  const days = 52 * 7
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  const data: DayCell[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const v = rand() % 100
    const count = v > 78 ? randomInt(3, 8) : v > 62 ? randomInt(1, 3) : v > 48 ? 1 : 0
    data.push({ date: d.toISOString().slice(0, 10), count })
  }
  return data
}

function level(count: number) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function computeStats(cells: DayCell[], source: Stats['source'], events?: number): Stats {
  const total = cells.reduce((a, c) => a + c.count, 0)
  let maxStreak = 0
  let cur = 0
  let currentStreak = 0
  let busiest = cells[0]?.date || '—'
  let busiestCount = -1
  for (const c of cells) {
    if (c.count > 0) {
      cur++
      maxStreak = Math.max(maxStreak, cur)
    } else cur = 0
    if (c.count >= busiestCount) {
      busiestCount = c.count
      busiest = c.date
    }
  }
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i]!.count > 0) currentStreak++
    else break
  }
  return { total, maxStreak, currentStreak, busiest, source, events }
}

async function fetchFromEvents(username: string): Promise<{ cells: DayCell[]; events: number } | null> {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`)
  if (!res.ok) return null
  const events = (await res.json()) as { created_at: string; type: string }[]
  if (!Array.isArray(events) || !events.length) return null
  const byDay = new Map<string, number>()
  for (const ev of events) {
    const day = ev.created_at.slice(0, 10)
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  const days = 52 * 7
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  const cells: DayCell[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, count: byDay.get(key) || 0 })
  }
  return { cells, events: events.length }
}

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

export default function Page() {
  const [user, setUser] = useLocalStorage('lab:github-contrib:user', 'octocat')
  const [cells, setCells] = useState<DayCell[]>(() => buildMockYear('octocat'))
  const [stats, setStats] = useState<Stats>(() => computeStats(buildMockYear('octocat'), 'mock'))
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [hover, setHover] = useState<DayCell | null>(null)

  const load = useCallback(async () => {
    const name = user.trim() || 'octocat'
    setLoading(true)
    setErr('')
    try {
      const api = await fetchFromEvents(name)
      if (api) {
        setCells(api.cells)
        setStats(computeStats(api.cells, 'api', api.events))
      } else {
        const mock = buildMockYear(name)
        setCells(mock)
        setStats(computeStats(mock, 'mock'))
        setErr('無法取得公開事件，已改用模擬貢獻圖')
      }
    } catch {
      const mock = buildMockYear(name)
      setCells(mock)
      setStats(computeStats(mock, 'mock'))
      setErr('網路錯誤，已改用模擬貢獻圖')
    } finally {
      setLoading(false)
    }
  }, [user])

  const weeks = useMemo(() => {
    const cols: DayCell[][] = []
    for (let w = 0; w < 52; w++) cols.push(cells.slice(w * 7, w * 7 + 7))
    return cols
  }, [cells])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="field"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="GitHub username"
            style={{ maxWidth: 220 }}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
          <button type="button" className="btn accent" disabled={loading} onClick={() => void load()}>
            {loading ? '載入中…' : '分析'}
          </button>
          <span className="tag">{stats.source === 'api' ? 'GitHub Events API' : 'Mock 資料'}</span>
          {stats.events !== undefined && <span className="muted">近 100 筆事件</span>}
        </div>
        {err && <p className="muted">{err}</p>}
      </div>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">
          總貢獻 <strong>{stats.total}</strong>
        </div>
        <div className="metric panel">
          最長連續 <strong>{stats.maxStreak}</strong> 天
        </div>
        <div className="metric panel">
          目前連續 <strong>{stats.currentStreak}</strong> 天
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label" style={{ margin: 0 }}>
            貢獻熱度圖 · {user || '—'}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {hover ? `${hover.date} · ${hover.count} 次` : `最活躍日 ${stats.busiest}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 8 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={`${cell.date}: ${cell.count}`}
                  onMouseEnter={() => setHover(cell)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    background: COLORS[level(cell.count)],
                    outline: hover?.date === cell.date ? '1px solid var(--ink)' : undefined,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="row muted" style={{ fontSize: 12, gap: 4 }}>
          Less
          {COLORS.map((c) => (
            <span key={c} style={{ width: 11, height: 11, background: c, borderRadius: 2, display: 'inline-block' }} />
          ))}
          More
        </div>
      </div>
    </ProjectShell>
  )
}
