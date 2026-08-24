import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('dependency-dashboard')!

type Dep = { id: string; name: string; current: string; latest: string }

function parse(v: string) {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return { major: +m[1]!, minor: +m[2]!, patch: +m[3]! }
}

function statusOf(current: string, latest: string) {
  const a = parse(current)
  const b = parse(latest)
  if (!a || !b) return 'unknown'
  if (a.major !== b.major) return 'major'
  if (a.minor !== b.minor) return 'minor'
  if (a.patch !== b.patch) return 'patch'
  return 'ok'
}

export default function Page() {
  const [deps, setDeps] = useLocalStorage<Dep[]>('lab:dependency-dashboard', [
    { id: '1', name: 'react', current: '19.0.0', latest: '19.2.8' },
    { id: '2', name: 'vite', current: '6.0.0', latest: '6.4.3' },
    { id: '3', name: 'lodash', current: '4.17.20', latest: '4.17.21' },
    { id: '4', name: 'left-pad', current: '1.3.0', latest: '1.3.0' },
  ])
  const [filter, setFilter] = useState<'all' | 'ok' | 'patch' | 'minor' | 'major'>('all')
  const [name, setName] = useState('')
  const [current, setCurrent] = useState('1.0.0')
  const [latest, setLatest] = useState('1.1.0')

  const rows = useMemo(() => {
    return deps
      .map((d) => ({ ...d, status: statusOf(d.current, d.latest) }))
      .filter((d) => filter === 'all' || d.status === filter)
  }, [deps, filter])

  const counts = useMemo(() => {
    const c = { ok: 0, patch: 0, minor: 0, major: 0, unknown: 0 }
    deps.forEach((d) => {
      const s = statusOf(d.current, d.latest) as keyof typeof c
      c[s]++
    })
    return c
  }, [deps])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">可更新 {counts.patch + counts.minor + counts.major}</div>
        <div className="metric panel">重大 {counts.major}</div>
        <div className="metric panel">已最新 {counts.ok}</div>
      </div>
      <div className="panel stack">
        <div className="row">
          {(['all', 'major', 'minor', 'patch', 'ok'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="row">
          <input className="field" placeholder="套件名" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" style={{ width: 110 }} value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input className="field" style={{ width: 110 }} value={latest} onChange={(e) => setLatest(e.target.value)} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!name.trim()) return
              setDeps((xs) => [
                { id: uid('d'), name: name.trim(), current, latest },
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
            <li key={d.id} className="list-item">
              <strong className="mono" style={{ flex: 1 }}>
                {d.name}
              </strong>
              <span className="muted">{d.current}</span>
              <span>→</span>
              <span className="mono">{d.latest}</span>
              <span className="tag">{d.status}</span>
              <button
                type="button"
                className="btn teal sm"
                disabled={d.status === 'ok'}
                onClick={() =>
                  setDeps((xs) =>
                    xs.map((x) => (x.id === d.id ? { ...x, current: x.latest } : x)),
                  )
                }
              >
                更新
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setDeps((xs) => xs.filter((x) => x.id !== d.id))}
              >
                刪
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
