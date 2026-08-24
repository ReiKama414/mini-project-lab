import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('server-monitor')!

type Metrics = { cpu: number; mem: number; disk: number; netIn: number; netOut: number; load: number }

export default function Page() {
  const [host, setHost] = useLocalStorage('lab:server-monitor:host', 'prod-web-01')
  const [m, setM] = useState<Metrics>({ cpu: 32, mem: 58, disk: 71, netIn: 12, netOut: 8, load: 1.2 })
  const [history, setHistory] = useState<number[]>(Array.from({ length: 24 }, () => randomInt(10, 70)))

  useEffect(() => {
    const id = setInterval(() => {
      setM((prev) => ({
        cpu: Math.min(100, Math.max(5, prev.cpu + randomInt(-8, 8))),
        mem: Math.min(100, Math.max(20, prev.mem + randomInt(-3, 3))),
        disk: Math.min(100, Math.max(40, prev.disk + randomInt(-1, 1))),
        netIn: randomInt(5, 40),
        netOut: randomInt(3, 30),
        load: Number((Math.random() * 3).toFixed(2)),
      }))
      setHistory((h) => [...h.slice(1), randomInt(10, 90)])
    }, 1500)
    return () => clearInterval(id)
  }, [])

  const cards: { label: string; value: string; pct?: number }[] = [
    { label: 'CPU', value: `${m.cpu}%`, pct: m.cpu },
    { label: 'Memory', value: `${m.mem}%`, pct: m.mem },
    { label: 'Disk', value: `${m.disk}%`, pct: m.disk },
    { label: 'Load', value: String(m.load) },
    { label: 'Net In', value: `${m.netIn} MB/s` },
    { label: 'Net Out', value: `${m.netOut} MB/s` },
  ]

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12 }}>
        <input className="field" value={host} onChange={(e) => setHost(e.target.value)} />
        <span className="tag">live mock</span>
      </div>
      <div className="grid-3">
        {cards.map((c) => (
          <div key={c.label} className="panel metric stack">
            <div className="muted">{c.label}</div>
            <div style={{ fontSize: 24 }}>{c.value}</div>
            {c.pct !== undefined && (
              <div className="progress">
                <div style={{ width: `${c.pct}%`, height: 6, borderRadius: 4, background: c.pct > 85 ? '#ef4444' : '#22c55e' }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <div className="label">CPU 歷史</div>
        <div className="row" style={{ alignItems: 'flex-end', height: 80, gap: 4 }}>
          {history.map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${v}%`, background: '#38bdf8', borderRadius: 2, minWidth: 6 }} />
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}
