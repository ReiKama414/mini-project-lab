import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt, uid } from '../../lib/utils'

const meta = getProject('docker-dashboard')!

type Ctn = { id: string; name: string; image: string; status: 'running' | 'exited'; cpu: number; mem: number }

export default function Page() {
  const [ctns, setCtns] = useLocalStorage<Ctn[]>('lab:docker-dashboard', [
    { id: '1', name: 'web', image: 'nginx:alpine', status: 'running', cpu: 3.2, mem: 64 },
    { id: '2', name: 'api', image: 'node:20', status: 'running', cpu: 12.5, mem: 256 },
    { id: '3', name: 'db', image: 'postgres:16', status: 'running', cpu: 8.1, mem: 512 },
    { id: '4', name: 'worker', image: 'redis:7', status: 'exited', cpu: 0, mem: 0 },
  ])

  useEffect(() => {
    const id = setInterval(() => {
      setCtns((xs) =>
        xs.map((c) =>
          c.status === 'running'
            ? { ...c, cpu: Number((Math.random() * 40).toFixed(1)), mem: Math.max(32, c.mem + randomInt(-20, 20)) }
            : c,
        ),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [setCtns])

  const running = ctns.filter((c) => c.status === 'running').length

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">Containers {ctns.length}</div>
        <div className="metric panel">Running {running}</div>
        <div className="metric panel">Stopped {ctns.length - running}</div>
      </div>
      <div className="panel">
        <button
          type="button"
          className="btn sm ghost"
          style={{ marginBottom: 8 }}
          onClick={() => setCtns((xs) => [...xs, { id: uid('c'), name: 'sidecar', image: 'busybox', status: 'running', cpu: 1, mem: 16 }])}
        >
          啟動示範容器
        </button>
        <ul className="list">
          {ctns.map((c) => (
            <li key={c.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{c.name}</strong> <span className="mono muted">{c.image}</span>
                <div className="muted">
                  CPU {c.cpu}% · MEM {c.mem}MB
                </div>
              </div>
              <div className="row">
                <span className="tag" style={{ background: c.status === 'running' ? '#14532d' : '#444' }}>
                  {c.status}
                </span>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() =>
                    setCtns((xs) =>
                      xs.map((x) =>
                        x.id === c.id
                          ? { ...x, status: x.status === 'running' ? 'exited' : 'running', cpu: x.status === 'running' ? 0 : 2, mem: x.status === 'running' ? 0 : 32 }
                          : x,
                      ),
                    )
                  }
                >
                  {c.status === 'running' ? 'Stop' : 'Start'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
