import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('simple-analytics')!

type Range = '24h' | '7d' | '30d'
type Event = { id: string; name: string; path: string; at: number }
type DayBar = { day: string; views: number }

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10)
}

function buildBars(events: Event[], range: Range): DayBar[] {
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30
  const out: DayBar[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const views = events.filter((e) => dayKey(e.at) === key).length
    out.push({ day: key.slice(5), views })
  }
  return out
}

const SAMPLE_PATHS = ['/', '/pricing', '/docs', '/blog', '/about']

export default function Page() {
  const [range, setRange] = useLocalStorage<Range>('lab:simple-analytics:range', '7d')
  const [events, setEvents] = useLocalStorage<Event[]>('lab:simple-analytics:events', [
    { id: '1', name: 'pageview', path: '/', at: Date.now() - 86400000 * 1 },
    { id: '2', name: 'pageview', path: '/pricing', at: Date.now() - 86400000 * 1 },
    { id: '3', name: 'signup', path: '/pricing', at: Date.now() - 3600000 },
    { id: '4', name: 'pageview', path: '/docs', at: Date.now() - 7200000 },
    { id: '5', name: 'pageview', path: '/', at: Date.now() - 86400000 * 2 },
    { id: '6', name: 'click_cta', path: '/', at: Date.now() - 86400000 * 3 },
  ])
  const [eventName, setEventName] = useState('pageview')
  const [path, setPath] = useState('/')

  const filtered = useMemo(() => {
    const ms = range === '24h' ? 86400000 : range === '7d' ? 86400000 * 7 : 86400000 * 30
    const cut = Date.now() - ms
    return events.filter((e) => e.at >= cut)
  }, [events, range])

  const bars = useMemo(() => buildBars(filtered, range), [filtered, range])
  const maxBar = Math.max(1, ...bars.map((b) => b.views))

  const topPages = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filtered) {
      if (e.name !== 'pageview' && e.name !== 'click_cta') continue
      map.set(e.path, (map.get(e.path) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [filtered])

  const visitors = new Set(filtered.map((e) => dayKey(e.at) + e.path)).size
  const pageviews = filtered.filter((e) => e.name === 'pageview').length

  function track() {
    setEvents((xs) => [{ id: uid('ev'), name: eventName.trim() || 'event', path: path.trim() || '/', at: Date.now() }, ...xs].slice(0, 500))
  }

  function seedDay() {
    const batch: Event[] = SAMPLE_PATHS.map((p) => ({
      id: uid('ev'),
      name: 'pageview',
      path: p,
      at: Date.now() - Math.floor(Math.random() * 3600000),
    }))
    setEvents((xs) => [...batch, ...xs].slice(0, 500))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(['24h', '7d', '30d'] as Range[]).map((r) => (
          <button key={r} type="button" className={`btn sm ${range === r ? 'accent' : 'ghost'}`} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
        <button type="button" className="btn sm ghost" onClick={seedDay}>
          模擬流量
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">訪客近似 {visitors}</div>
        <div className="metric panel">Pageviews {pageviews}</div>
        <div className="metric panel">事件總數 {filtered.length}</div>
      </div>

      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="field" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="事件名" style={{ width: 140 }} />
        <input className="field mono" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path" style={{ flex: 1, minWidth: 120 }} />
        <button type="button" className="btn accent" onClick={track}>
          追蹤事件
        </button>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="label">每日長條圖</div>
          <div className="row" style={{ alignItems: 'flex-end', height: 140, gap: 4 }}>
            {bars.map((b) => (
              <div key={b.day} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  title={`${b.day}: ${b.views}`}
                  style={{
                    height: `${(b.views / maxBar) * 100}%`,
                    minHeight: b.views ? 4 : 0,
                    background: 'var(--teal)',
                    borderRadius: 3,
                  }}
                />
                <div className="muted" style={{ fontSize: 10 }}>
                  {b.day}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="label">熱門路徑</div>
          <ul className="list">
            {topPages.map(([p, v]) => (
              <li key={p} className="list-item row" style={{ justifyContent: 'space-between' }}>
                <span className="mono">{p}</span>
                <span>{v}</span>
              </li>
            ))}
            {!topPages.length && <li className="list-item muted">尚無資料</li>}
          </ul>
          <div className="label" style={{ marginTop: 12 }}>
            最近事件
          </div>
          <ul className="list">
            {filtered.slice(0, 8).map((e) => (
              <li key={e.id} className="list-item" style={{ fontSize: 13 }}>
                <strong>{e.name}</strong> <span className="mono muted">{e.path}</span>
                <div className="muted">{new Date(e.at).toLocaleString('zh-TW')}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
