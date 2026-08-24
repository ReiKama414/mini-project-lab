import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('dependency-dashboard')!

type Status = 'ok' | 'patch' | 'minor' | 'major' | 'unknown'
type SortKey = 'name' | 'status' | 'current'

type Dep = {
  id: string
  name: string
  current: string
  latest: string
  ignored: boolean
  notes: string
}

const DEFAULT_DEPS: Dep[] = [
  { id: '1', name: 'react', current: '19.0.0', latest: '19.2.8', ignored: false, notes: '核心框架' },
  { id: '2', name: 'react-dom', current: '19.0.0', latest: '19.2.8', ignored: false, notes: '' },
  { id: '3', name: 'vite', current: '6.0.0', latest: '6.4.3', ignored: false, notes: '建置工具' },
  { id: '4', name: 'typescript', current: '5.6.2', latest: '5.8.2', ignored: false, notes: '' },
  { id: '5', name: 'lodash', current: '4.17.20', latest: '4.17.21', ignored: false, notes: 'patch 即可' },
  { id: '6', name: 'axios', current: '1.7.0', latest: '1.9.0', ignored: false, notes: '' },
  { id: '7', name: 'uuid', current: '11.0.0', latest: '11.1.0', ignored: false, notes: '' },
  { id: '8', name: 'left-pad', current: '1.3.0', latest: '1.3.0', ignored: true, notes: '示範用舊套件，可忽略' },
  { id: '9', name: 'eslint', current: '8.57.0', latest: '9.22.0', ignored: false, notes: 'major 需評估設定' },
  { id: '10', name: 'dayjs', current: '1.11.10', latest: '1.11.13', ignored: false, notes: '' },
]

const STATUS_ORDER: Record<Status, number> = {
  major: 0,
  minor: 1,
  patch: 2,
  unknown: 3,
  ok: 4,
}

function parse(v: string) {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return { major: +m[1]!, minor: +m[2]!, patch: +m[3]! }
}

function statusOf(current: string, latest: string): Status {
  const a = parse(current)
  const b = parse(latest)
  if (!a || !b) return 'unknown'
  if (a.major !== b.major) return 'major'
  if (a.minor !== b.minor) return 'minor'
  if (a.patch !== b.patch) return 'patch'
  return 'ok'
}

function statusLabel(s: Status) {
  return (
    {
      ok: '最新',
      patch: 'patch',
      minor: 'minor',
      major: 'major',
      unknown: '未知',
    } as const
  )[s]
}

export default function Page() {
  const [deps, setDeps] = useLocalStorage<Dep[]>('lab:dependency-dashboard:v2', DEFAULT_DEPS)
  const [filter, setFilter] = useState<'all' | Status | 'ignored'>('all')
  const [sort, setSort] = useLocalStorage<SortKey>('lab:dependency-dashboard:sort', 'status')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [current, setCurrent] = useState('1.0.0')
  const [latest, setLatest] = useState('1.1.0')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)

  const enriched = useMemo(
    () =>
      deps.map((d) => ({
        ...d,
        status: statusOf(d.current, d.latest),
      })),
    [deps],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enriched
      .filter((d) => {
        if (q && !d.name.toLowerCase().includes(q) && !d.notes.toLowerCase().includes(q)) return false
        if (filter === 'ignored') return d.ignored
        if (d.ignored) return filter === 'all'
        if (filter === 'all') return true
        return d.status === filter
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'current') return a.current.localeCompare(b.current, undefined, { numeric: true })
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (byStatus !== 0) return byStatus
        return a.name.localeCompare(b.name)
      })
  }, [enriched, filter, sort, query])

  const counts = useMemo(() => {
    const c = { ok: 0, patch: 0, minor: 0, major: 0, unknown: 0, ignored: 0 }
    enriched.forEach((d) => {
      if (d.ignored) c.ignored++
      else c[d.status]++
    })
    return c
  }, [enriched])

  function exportCsv() {
    const header = 'name,current,latest,status,ignored,notes'
    const body = enriched
      .map(
        (d) =>
          `${d.name},${d.current},${d.latest},${d.status},${d.ignored},${JSON.stringify(d.notes)}`,
      )
      .join('\n')
    downloadText('dependencies.csv', `${header}\n${body}`, 'text/csv;charset=utf-8')
  }

  function bumpToLatest(id: string) {
    setDeps((xs) => xs.map((x) => (x.id === id ? { ...x, current: x.latest } : x)))
  }

  function toggleIgnore(id: string) {
    setDeps((xs) => xs.map((x) => (x.id === id ? { ...x, ignored: !x.ignored } : x)))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" onClick={exportCsv}>
          匯出 CSV
        </button>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">可更新 {counts.patch + counts.minor + counts.major}</div>
        <div className="metric panel">重大 {counts.major}</div>
        <div className="metric panel">
          已最新 {counts.ok} · 忽略 {counts.ignored}
        </div>
      </div>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(
            [
              ['all', '全部'],
              ['major', 'major'],
              ['minor', 'minor'],
              ['patch', 'patch'],
              ['ok', '最新'],
              ['ignored', '已忽略'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="field"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="搜尋套件或備註…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="row" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              排序
            </span>
            <select className="field" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ width: 120 }}>
              <option value="status">狀態優先</option>
              <option value="name">名稱</option>
              <option value="current">目前版本</option>
            </select>
          </label>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setDeps(DEFAULT_DEPS)}
            title="還原示範套件清單"
          >
            重置示範資料
          </button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="field" placeholder="套件名" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="field"
            style={{ width: 110 }}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="目前"
            title="目前版本"
          />
          <input
            className="field"
            style={{ width: 110 }}
            value={latest}
            onChange={(e) => setLatest(e.target.value)}
            placeholder="最新"
            title="最新版本"
          />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!name.trim()) return
              setDeps((xs) => [
                {
                  id: uid('d'),
                  name: name.trim(),
                  current: current.trim() || '0.0.0',
                  latest: latest.trim() || '0.0.0',
                  ignored: false,
                  notes: '',
                },
                ...xs,
              ])
              setName('')
            }}
          >
            新增
          </button>
        </div>
        <ul className="list">
          {rows.map((d) => (
            <li key={d.id} className="stack" style={{ gap: 6, padding: '10px 0', borderBottom: '1px solid var(--border, #3333)' }}>
              <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <strong className="mono" style={{ flex: 1, minWidth: 100, opacity: d.ignored ? 0.55 : 1 }}>
                  {d.name}
                </strong>
                <span className="muted mono">{d.current}</span>
                <span>→</span>
                <span className="mono">{d.latest}</span>
                <span className="tag">{statusLabel(d.status)}</span>
                {d.ignored && <span className="tag">忽略</span>}
                <button
                  type="button"
                  className="btn teal sm"
                  disabled={d.status === 'ok' || d.ignored}
                  onClick={() => bumpToLatest(d.id)}
                >
                  更新
                </button>
                <button type="button" className={`btn sm ${d.ignored ? 'accent' : 'ghost'}`} onClick={() => toggleIgnore(d.id)}>
                  {d.ignored ? '取消忽略' : '忽略'}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setEditingNotes(editingNotes === d.id ? null : d.id)}
                >
                  備註
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setDeps((xs) => xs.filter((x) => x.id !== d.id))}>
                  刪
                </button>
              </div>
              {(editingNotes === d.id || d.notes) && (
                <input
                  className="field"
                  value={d.notes}
                  placeholder="備註（例如：延後到下個 sprint）"
                  onChange={(e) =>
                    setDeps((xs) => xs.map((x) => (x.id === d.id ? { ...x, notes: e.target.value } : x)))
                  }
                  onBlur={() => setEditingNotes(null)}
                  autoFocus={editingNotes === d.id}
                />
              )}
            </li>
          ))}
          {!rows.length && <p className="muted">沒有符合篩選的套件。</p>}
        </ul>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          示範資料，版本狀態依 semver 比對。可標記忽略、寫備註，並匯出 CSV。
        </p>
      </div>
    </ProjectShell>
  )
}
