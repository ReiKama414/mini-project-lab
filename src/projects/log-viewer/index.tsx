import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, pick, uid } from '../../lib/utils'

const meta = getProject('log-viewer')!

type Level = 'info' | 'warn' | 'error' | 'debug'
type Log = { id: string; level: Level; msg: string; at: number; source: string }

const samples = [
  'Request completed GET /api/health 200',
  'Cache miss for key user:42',
  'Slow query detected 320ms',
  'JWT expired for session',
  'Worker job finished batch=12',
  'Rate limit approaching threshold',
  'Connection pool idle=3 active=7',
  'Retrying upstream request attempt=2',
  'Disk usage warning /var 82%',
  'Feature flag ai_suggest evaluated false',
]

const sources = ['api', 'worker', 'gateway', 'auth']

const LEVEL_LABEL: Record<Level | 'all', string> = {
  all: '全部',
  info: 'info',
  warn: 'warn',
  error: 'error',
  debug: 'debug',
}

function makeSampleBatch(n = 8): Log[] {
  return Array.from({ length: n }, () => ({
    id: uid('l'),
    level: pick(['info', 'info', 'debug', 'warn', 'error'] as Level[]),
    msg: pick(samples),
    at: Date.now() - Math.floor(Math.random() * 60000),
    source: pick(sources),
  })).sort((a, b) => b.at - a.at)
}

const color: Record<Level, string> = {
  info: 'var(--sky)',
  warn: 'var(--amber)',
  error: 'var(--rose)',
  debug: 'var(--ink-muted)',
}

const INITIAL: Log[] = [
  { id: 'seed1', level: 'info', msg: 'Request completed GET /api/health 200', at: Date.now() - 5000, source: 'api' },
  { id: 'seed2', level: 'warn', msg: 'Slow query detected 320ms', at: Date.now() - 4000, source: 'worker' },
  { id: 'seed3', level: 'debug', msg: 'Cache miss for key user:42', at: Date.now() - 3000, source: 'api' },
]

export default function Page() {
  const [logs, setLogs] = useLocalStorage<Log[]>('lab:log-viewer', INITIAL)
  const [filter, setFilter] = useState<'all' | Level>('all')
  const [q, setQ] = useState('')
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      const level = pick(['info', 'info', 'debug', 'warn', 'error'] as Level[])
      setLogs((xs) =>
        [{ id: uid('l'), level, msg: pick(samples), at: Date.now(), source: pick(sources) }, ...xs].slice(0, 300),
      )
    }, 1600)
    return () => clearInterval(id)
  }, [paused, setLogs])

  const list = Array.isArray(logs) ? logs : []

  const shown = useMemo(
    () =>
      list.filter(
        (l) =>
          (filter === 'all' || l.level === filter) &&
          (!q.trim() || `${l.msg} ${l.source}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [list, filter, q],
  )

  const levelCounts = useMemo(() => {
    const c: Record<Level, number> = { info: 0, warn: 0, error: 0, debug: 0 }
    list.forEach((l) => {
      c[l.level]++
    })
    return c
  }, [list])

  function generate() {
    setLogs((xs) => [...makeSampleBatch(15), ...(Array.isArray(xs) ? xs : [])].slice(0, 300))
  }

  function exportText() {
    return shown
      .map((l) => `${new Date(l.at).toISOString()} [${l.level.toUpperCase()}] (${l.source}) ${l.msg}`)
      .join('\n')
  }

  function exportLogs() {
    downloadText(`logs-${Date.now()}.txt`, exportText() || '(empty)', 'text/plain;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={generate}>
            產生樣本
          </button>
          <button type="button" className="btn sm ghost" disabled={!shown.length} onClick={() => void copyText(exportText())}>
            複製
          </button>
          <button type="button" className="btn sm teal" onClick={exportLogs}>
            匯出
          </button>
        </div>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">
          error <strong style={{ color: color.error }}>{levelCounts.error}</strong>
        </div>
        <div className="metric panel">
          warn <strong style={{ color: color.warn }}>{levelCounts.warn}</strong>
        </div>
        <div className="metric panel">
          總筆數 {list.length}
        </div>
      </div>
      <div className="panel row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          className="field"
          placeholder="搜尋訊息或來源…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
        {(['all', 'info', 'warn', 'error', 'debug'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
            onClick={() => setFilter(f)}
          >
            {LEVEL_LABEL[f]}
          </button>
        ))}
        <button type="button" className={`btn sm ${paused ? 'ghost' : 'teal'}`} onClick={() => setPaused((v) => !v)}>
          {paused ? '繼續串流' : '暫停串流'}
        </button>
        <button type="button" className="btn sm danger" onClick={() => setLogs([])}>
          清空
        </button>
      </div>
      <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
        顯示 {shown.length} / {list.length} · {paused ? '已暫停' : '即時串流中'}
      </div>
      <div className="panel mono" style={{ maxHeight: 480, overflow: 'auto', fontSize: 13 }}>
        {shown.map((l) => (
          <div key={l.id} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
            <span style={{ color: color[l.level] }}>[{l.level}]</span>{' '}
            <span className="tag" style={{ fontSize: 11 }}>
              {l.source}
            </span>{' '}
            <span className="muted">{new Date(l.at).toLocaleTimeString('zh-TW')}</span> {l.msg}
          </div>
        ))}
        {!shown.length && <p className="muted">尚無日誌（可按「產生樣本」或關閉暫停）</p>}
      </div>
    </ProjectShell>
  )
}
