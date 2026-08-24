import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick, uid } from '../../lib/utils'

const meta = getProject('log-viewer')!

type Log = { id: string; level: 'info' | 'warn' | 'error' | 'debug'; msg: string; at: number }

const samples = [
  'Request completed GET /api/health 200',
  'Cache miss for key user:42',
  'Slow query detected 320ms',
  'JWT expired for session',
  'Worker job finished batch=12',
  'Rate limit approaching threshold',
]

export default function Page() {
  const [logs, setLogs] = useLocalStorage<Log[]>('lab:log-viewer', [])
  const [filter, setFilter] = useState<'all' | Log['level']>('all')
  const [q, setQ] = useState('')
  const [live, setLive] = useState(true)

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      const level = pick(['info', 'info', 'debug', 'warn', 'error'] as Log['level'][])
      setLogs((xs) => [{ id: uid('l'), level, msg: pick(samples), at: Date.now() }, ...xs].slice(0, 200))
    }, 1800)
    return () => clearInterval(id)
  }, [live, setLogs])

  const shown = logs.filter((l) => (filter === 'all' || l.level === filter) && l.msg.toLowerCase().includes(q.toLowerCase()))

  const color: Record<Log['level'], string> = { info: '#38bdf8', warn: '#fbbf24', error: '#f87171', debug: '#94a3b8' }

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <input className="field" placeholder="搜尋…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        {(['all', 'info', 'warn', 'error', 'debug'] as const).map((f) => (
          <button key={f} type="button" className={`btn sm ${filter === f ? 'accent' : 'ghost'}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <button type="button" className={`btn sm ${live ? 'teal' : 'ghost'}`} onClick={() => setLive((v) => !v)}>
          {live ? 'Live ON' : 'Live OFF'}
        </button>
        <button type="button" className="btn sm danger" onClick={() => setLogs([])}>
          清空
        </button>
      </div>
      <div className="panel mono" style={{ maxHeight: 480, overflow: 'auto', fontSize: 13 }}>
        {shown.map((l) => (
          <div key={l.id} style={{ borderBottom: '1px solid #1e293b', padding: '6px 0' }}>
            <span style={{ color: color[l.level] }}>[{l.level}]</span>{' '}
            <span className="muted">{new Date(l.at).toLocaleTimeString()}</span> {l.msg}
          </div>
        ))}
        {!shown.length && <p className="muted">尚無日誌</p>}
      </div>
    </ProjectShell>
  )
}
