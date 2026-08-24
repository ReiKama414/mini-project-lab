import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('simple-analytics')!

export default function Page() {
  const [range, setRange] = useLocalStorage('lab:simple-analytics:range', '7d')
  const [stats, setStats] = useState({ visitors: 1240, pageviews: 3820, bounce: 42, duration: 186 })
  const [series, setSeries] = useState(() => Array.from({ length: 14 }, () => randomInt(40, 200)))

  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => ({
        visitors: s.visitors + randomInt(0, 5),
        pageviews: s.pageviews + randomInt(1, 12),
        bounce: Math.min(70, Math.max(25, s.bounce + randomInt(-1, 1))),
        duration: Math.max(60, s.duration + randomInt(-5, 5)),
      }))
      setSeries((xs) => [...xs.slice(1), randomInt(40, 220)])
    }, 2500)
    return () => clearInterval(id)
  }, [])

  const top = [
    { path: '/', views: 920 },
    { path: '/pricing', views: 410 },
    { path: '/docs', views: 288 },
    { path: '/blog', views: 176 },
  ]

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        {['24h', '7d', '30d'].map((r) => (
          <button key={r} type="button" className={`btn sm ${range === r ? 'accent' : 'ghost'}`} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">訪客 {stats.visitors.toLocaleString()}</div>
        <div className="metric panel">瀏覽 {stats.pageviews.toLocaleString()}</div>
        <div className="metric panel">跳出率 {stats.bounce}%</div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="label">流量趨勢</div>
          <div className="row" style={{ alignItems: 'flex-end', height: 120, gap: 4 }}>
            {series.map((v, i) => (
              <div key={i} style={{ flex: 1, height: `${(v / 220) * 100}%`, background: '#34d399', borderRadius: 3 }} />
            ))}
          </div>
          <p className="muted">平均停留 {Math.floor(stats.duration / 60)}分 {stats.duration % 60}秒</p>
        </div>
        <div className="panel">
          <div className="label">熱門路徑</div>
          <ul className="list">
            {top.map((t) => (
              <li key={t.path} className="list-item row" style={{ justifyContent: 'space-between' }}>
                <span className="mono">{t.path}</span>
                <span>{t.views}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
