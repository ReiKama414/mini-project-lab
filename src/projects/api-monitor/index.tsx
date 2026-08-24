import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('api-monitor')!

type Ep = { name: string; method: string; p50: number; p95: number; errorRate: number; ok: boolean }

export default function Page() {
  const [eps, setEps] = useLocalStorage<Ep[]>('lab:api-monitor', [
    { name: '/v1/users', method: 'GET', p50: 45, p95: 120, errorRate: 0.2, ok: true },
    { name: '/v1/orders', method: 'POST', p50: 90, p95: 260, errorRate: 1.1, ok: true },
    { name: '/v1/search', method: 'GET', p50: 150, p95: 480, errorRate: 3.4, ok: false },
    { name: '/v1/webhooks', method: 'POST', p50: 70, p95: 200, errorRate: 0.5, ok: true },
  ])

  useEffect(() => {
    const id = setInterval(() => {
      setEps((xs) =>
        xs.map((e) => {
          const p50 = Math.max(20, e.p50 + randomInt(-15, 15))
          const p95 = Math.max(p50 + 30, e.p95 + randomInt(-40, 40))
          const errorRate = Math.max(0, Number((e.errorRate + (Math.random() - 0.5)).toFixed(1)))
          return { ...e, p50, p95, errorRate, ok: errorRate < 2.5 && p95 < 500 }
        }),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [setEps])

  const healthy = eps.filter((e) => e.ok).length

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">Endpoints {eps.length}</div>
        <div className="metric panel">Healthy {healthy}</div>
        <div className="metric panel">Alerts {eps.length - healthy}</div>
      </div>
      <div className="panel">
        <ul className="list">
          {eps.map((e) => (
            <li key={e.name} className="list-item">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <span className="tag">{e.method}</span> <strong className="mono">{e.name}</strong>
                </div>
                <span className={`tag ${e.ok ? '' : ''}`} style={{ background: e.ok ? '#14532d' : '#7f1d1d' }}>
                  {e.ok ? 'OK' : 'DEGRADED'}
                </span>
              </div>
              <div className="grid-3" style={{ marginTop: 8 }}>
                <span className="muted">p50 {e.p50}ms</span>
                <span className="muted">p95 {e.p95}ms</span>
                <span className="muted">err {e.errorRate}%</span>
              </div>
              <div className="progress" style={{ marginTop: 6 }}>
                <div style={{ width: `${Math.min(100, e.p95 / 5)}%`, height: 6, borderRadius: 4, background: e.ok ? '#22c55e' : '#f97316' }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
