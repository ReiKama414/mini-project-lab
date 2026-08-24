import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick, randomInt, uid } from '../../lib/utils'

const meta = getProject('docker-dashboard')!

type Ctn = {
  id: string
  name: string
  image: string
  status: 'running' | 'exited'
  cpu: number
  mem: number
  memLimit: number
  logs: string[]
}

const LOG_SNIPS = [
  'Listening on :8080',
  'GET /health 200 2ms',
  'Connected to redis',
  'Worker idle',
  'Slow query 120ms',
  'Graceful shutdown signal',
  'Ready for connections',
]

export default function Page() {
  const [ctns, setCtns] = useLocalStorage<Ctn[]>('lab:docker-dashboard', [
    { id: '1', name: 'web', image: 'nginx:alpine', status: 'running', cpu: 3.2, mem: 64, memLimit: 256, logs: ['nginx started', 'accepting connections'] },
    { id: '2', name: 'api', image: 'node:20', status: 'running', cpu: 12.5, mem: 256, memLimit: 512, logs: ['server listening :3000'] },
    { id: '3', name: 'db', image: 'postgres:16', status: 'running', cpu: 8.1, mem: 512, memLimit: 1024, logs: ['database system is ready'] },
    { id: '4', name: 'worker', image: 'redis:7', status: 'exited', cpu: 0, mem: 0, memLimit: 128, logs: ['Stopped'] },
  ])
  const [selected, setSelected] = useState('1')
  const [newName, setNewName] = useState('')
  const [newImage, setNewImage] = useState('busybox:latest')

  useEffect(() => {
    const id = setInterval(() => {
      setCtns((xs) =>
        xs.map((c) => {
          if (c.status !== 'running') return c
          const cpu = Number((Math.random() * 45).toFixed(1))
          const mem = Math.min(c.memLimit, Math.max(16, c.mem + randomInt(-24, 24)))
          const logs =
            Math.random() > 0.55
              ? [...c.logs, `${new Date().toLocaleTimeString()} ${pick(LOG_SNIPS)}`].slice(-40)
              : c.logs
          return { ...c, cpu, mem, logs }
        }),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [setCtns])

  const running = ctns.filter((c) => c.status === 'running').length
  const current = ctns.find((c) => c.id === selected) || ctns[0]

  function toggle(id: string) {
    setCtns((xs) =>
      xs.map((x) =>
        x.id === id
          ? {
              ...x,
              status: x.status === 'running' ? 'exited' : 'running',
              cpu: x.status === 'running' ? 0 : 2,
              mem: x.status === 'running' ? 0 : 32,
              logs: [
                ...x.logs,
                `${new Date().toLocaleTimeString()} ${x.status === 'running' ? 'Container stopped' : 'Container started'}`,
              ].slice(-40),
            }
          : x,
      ),
    )
  }

  function add() {
    const name = newName.trim() || `ctn_${ctns.length + 1}`
    const id = uid('c')
    setCtns((xs) => [
      ...xs,
      {
        id,
        name,
        image: newImage.trim() || 'busybox',
        status: 'running',
        cpu: 1,
        mem: 32,
        memLimit: 256,
        logs: [`${new Date().toLocaleTimeString()} Created ${name}`],
      },
    ])
    setSelected(id)
    setNewName('')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">Containers {ctns.length}</div>
        <div className="metric panel">Running {running}</div>
        <div className="metric panel">Stopped {ctns.length - running}</div>
      </div>

      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="field" placeholder="名稱" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 140 }} />
        <input className="field mono" placeholder="image" value={newImage} onChange={(e) => setNewImage(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button type="button" className="btn accent" onClick={add}>
          新增容器
        </button>
      </div>

      <div className="grid-2">
        <div className="panel">
          <ul className="list">
            {ctns.map((c) => (
              <li
                key={c.id}
                className="list-item stack"
                style={{ cursor: 'pointer', outline: selected === c.id ? '2px solid var(--accent)' : undefined }}
                onClick={() => setSelected(c.id)}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{c.name}</strong> <span className="mono muted">{c.image}</span>
                  </div>
                  <div className="row">
                    <span className="tag" style={{ background: c.status === 'running' ? 'var(--teal)' : '#888', color: '#fff' }}>
                      {c.status}
                    </span>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(c.id)
                      }}
                    >
                      {c.status === 'running' ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                    <span className="muted">CPU {c.cpu}%</span>
                    <span className="muted">
                      MEM {c.mem}/{c.memLimit} MB
                    </span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${Math.min(100, c.cpu)}%`, height: 6, borderRadius: 4, background: 'var(--sky)' }} />
                  </div>
                  <div className="progress">
                    <div
                      style={{
                        width: `${Math.min(100, (c.mem / c.memLimit) * 100)}%`,
                        height: 6,
                        borderRadius: 4,
                        background: 'var(--amber)',
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <div className="label">Logs · {current?.name || '—'}</div>
          <pre
            className="mono"
            style={{
              margin: 0,
              maxHeight: 420,
              overflow: 'auto',
              fontSize: 12,
              background: 'var(--bg-muted)',
              padding: 12,
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
            }}
          >
            {(current?.logs || []).join('\n') || '尚無日誌'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
