import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('dependency-dashboard')!

type Dep = { id: string; name: string; current: string; latest: string; type: 'prod' | 'dev' }

function outdated(a: string, b: string) {
  return a !== b
}

export default function Page() {
  const [deps, setDeps] = useLocalStorage<Dep[]>('lab:dependency-dashboard', [
    { id: '1', name: 'react', current: '18.3.1', latest: '19.0.0', type: 'prod' },
    { id: '2', name: 'vite', current: '5.4.0', latest: '6.0.1', type: 'dev' },
    { id: '3', name: 'typescript', current: '5.6.2', latest: '5.6.2', type: 'dev' },
    { id: '4', name: 'zod', current: '3.23.8', latest: '3.24.1', type: 'prod' },
  ])

  const stale = deps.filter((d) => outdated(d.current, d.latest)).length

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">套件 {deps.length}</div>
        <div className="metric panel">可更新 {stale}</div>
        <div className="metric panel">最新 {deps.length - stale}</div>
      </div>
      <div className="panel">
        <button
          type="button"
          className="btn ghost sm"
          style={{ marginBottom: 8 }}
          onClick={() => setDeps((xs) => [...xs, { id: uid('d'), name: 'lodash', current: '4.17.21', latest: '4.17.21', type: 'prod' }])}
        >
          新增示範套件
        </button>
        <ul className="list">
          {deps.map((d) => (
            <li key={d.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong className="mono">{d.name}</strong> <span className="tag">{d.type}</span>
              </div>
              <div className="row">
                <span className="mono muted">{d.current}</span>
                <span>→</span>
                <span className="mono">{d.latest}</span>
                {outdated(d.current, d.latest) ? (
                  <button type="button" className="btn sm teal" onClick={() => setDeps((xs) => xs.map((x) => (x.id === d.id ? { ...x, current: x.latest } : x)))}>
                    更新
                  </button>
                ) : (
                  <span className="tag">最新</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
