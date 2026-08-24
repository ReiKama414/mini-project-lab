import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('simple-analytics')!

type Range = '24h' | '7d' | '30d'
type Event = { id: string; name: string; path: string; at: number }
type DayBar = { day: string; label: string; views: number; pageviews: number }

const EVENT_PRESETS = ['pageview', 'click_cta', 'signup', 'purchase', 'scroll_depth']
const SAMPLE_PATHS = ['/', '/pricing', '/docs', '/blog', '/about']
const CONVERSION_EVENTS = new Set(['signup', 'purchase', 'convert', 'checkout'])

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10)
}

function formatBarLabel(isoDay: string, range: Range) {
  const d = new Date(isoDay + 'T00:00:00')
  if (range === '24h') return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
  if (range === '30d') return `${d.getMonth() + 1}/${d.getDate()}`
  return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })
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
    const dayEvents = events.filter((e) => dayKey(e.at) === key)
    out.push({
      day: key,
      label: formatBarLabel(key, range),
      views: dayEvents.length,
      pageviews: dayEvents.filter((e) => e.name === 'pageview').length,
    })
  }
  return out
}

function escapeCsv(v: string | number) {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

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

  const byType = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of filtered) map.set(e.name, (map.get(e.name) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

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
  const conversions = filtered.filter((e) => CONVERSION_EVENTS.has(e.name)).length
  const conversionRate = pageviews ? (conversions / pageviews) * 100 : 0
  const typeMax = Math.max(1, ...byType.map(([, n]) => n))

  function track() {
    setEvents((xs) =>
      [{ id: uid('ev'), name: eventName.trim() || 'event', path: path.trim() || '/', at: Date.now() }, ...xs].slice(0, 500),
    )
  }

  function seedDay() {
    const names = ['pageview', 'pageview', 'pageview', 'click_cta', 'signup']
    const batch: Event[] = SAMPLE_PATHS.flatMap((p) =>
      names.slice(0, 2 + Math.floor(Math.random() * 3)).map((name) => ({
        id: uid('ev'),
        name,
        path: p,
        at: Date.now() - Math.floor(Math.random() * 3600000),
      })),
    )
    setEvents((xs) => [...batch, ...xs].slice(0, 500))
  }

  function exportCsv() {
    const rows = [
      ['id', 'name', 'path', 'at_iso', 'at_ms'],
      ...events.map((e) => [e.id, e.name, e.path, new Date(e.at).toISOString(), e.at]),
    ]
    downloadText(
      `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => r.map(escapeCsv).join(',')).join('\n'),
      'text/csv;charset=utf-8',
    )
  }

  function clearData() {
    if (!confirm('確定清除全部事件資料？此動作無法復原。')) return
    setEvents([])
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={exportCsv} disabled={!events.length}>
            匯出 CSV
          </button>
          <button type="button" className="btn sm danger" onClick={clearData} disabled={!events.length}>
            清除資料
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(['24h', '7d', '30d'] as Range[]).map((r) => (
          <button key={r} type="button" className={`btn sm ${range === r ? 'accent' : 'ghost'}`} onClick={() => setRange(r)}>
            {r === '24h' ? '近 24 小時' : r === '7d' ? '近 7 天' : '近 30 天'}
          </button>
        ))}
        <button type="button" className="btn sm ghost" onClick={seedDay}>
          模擬流量
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">
          <div className="muted">訪客近似</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{visitors}</div>
        </div>
        <div className="metric panel">
          <div className="muted">Pageviews</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{pageviews}</div>
        </div>
        <div className="metric panel">
          <div className="muted">轉換率</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{conversionRate.toFixed(1)}%</div>
          <div className="muted" style={{ fontSize: 12 }}>
            轉換 {conversions} / PV {pageviews}
          </div>
        </div>
      </div>

      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="row" style={{ flexWrap: 'wrap', flex: 1 }}>
          {EVENT_PRESETS.map((n) => (
            <button key={n} type="button" className={`btn sm ${eventName === n ? 'accent' : 'ghost'}`} onClick={() => setEventName(n)}>
              {n}
            </button>
          ))}
        </div>
        <input className="field" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="事件名" style={{ width: 140 }} />
        <input className="field mono" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path" style={{ flex: 1, minWidth: 120 }} />
        <button type="button" className="btn accent" onClick={track}>
          追蹤事件
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div className="panel">
          <div className="label">每日事件長條圖 · 區間共 {filtered.length} 筆</div>
          <div className="row" style={{ alignItems: 'flex-end', height: 160, gap: range === '30d' ? 2 : 6 }}>
            {bars.map((b) => (
              <div key={b.day} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 10, height: 14 }}>
                  {b.views > 0 ? b.views : ''}
                </div>
                <div
                  title={`${b.day}\n事件 ${b.views} · PV ${b.pageviews}`}
                  style={{
                    height: `${(b.views / maxBar) * 110}px`,
                    minHeight: b.views ? 4 : 0,
                    background: 'var(--teal)',
                    borderRadius: 3,
                    margin: '0 auto',
                    maxWidth: range === '30d' ? 10 : 28,
                  }}
                />
                <div className="muted" style={{ fontSize: range === '30d' ? 9 : 11, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.label}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            柱高＝當日全部事件；懸停可看 Pageview 數。轉換事件含 signup / purchase 等。
          </p>
        </div>

        <div className="panel stack">
          <div className="label">事件類型分佈</div>
          {byType.length === 0 && <p className="muted">尚無資料</p>}
          {byType.map(([name, count]) => (
            <div key={name}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="tag">{name}</span>
                <span className="mono">
                  {count}（{((count / Math.max(1, filtered.length)) * 100).toFixed(0)}%）
                </span>
              </div>
              <div className="progress">
                <span style={{ width: `${(count / typeMax) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
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
        </div>
        <div className="panel">
          <div className="label">最近事件</div>
          <ul className="list">
            {filtered.slice(0, 10).map((e) => (
              <li key={e.id} className="list-item" style={{ fontSize: 13 }}>
                <strong>{e.name}</strong> <span className="mono muted">{e.path}</span>
                {CONVERSION_EVENTS.has(e.name) && <span className="tag" style={{ marginLeft: 6 }}>轉換</span>}
                <div className="muted">{new Date(e.at).toLocaleString('zh-TW')}</div>
              </li>
            ))}
            {!filtered.length && <li className="list-item muted">此區間尚無事件</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
