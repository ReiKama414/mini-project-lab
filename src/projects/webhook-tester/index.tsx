import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('webhook-tester')!

type Event = { id: string; at: number; headers: string; body: string; status: number }

function tryPretty(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function isJson(raw: string) {
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

export default function Page() {
  const [events, setEvents] = useLocalStorage<Event[]>('lab:webhook-tester', [])
  const [body, setBody] = useState('{\n  "event": "payment.succeeded",\n  "amount": 1990\n}')
  const [headers, setHeaders] = useState('Content-Type: application/json\nX-Signature: demo_sig')
  const [status, setStatus] = useState(200)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return events
    return events.filter(
      (e) => e.body.toLowerCase().includes(s) || e.headers.toLowerCase().includes(s),
    )
  }, [events, q])

  const current = filtered.find((e) => e.id === sel) || filtered[0]

  function send(replay?: Event) {
    const ev: Event = replay
      ? { ...replay, id: uid('wh'), at: Date.now() }
      : {
          id: uid('wh'),
          at: Date.now(),
          headers,
          body: tryPretty(body),
          status,
        }
    setEvents((xs) => [ev, ...xs].slice(0, 80))
    setSel(ev.id)
  }

  const curl = current
    ? `curl -X POST 'https://example.com/webhook' \\\n${current.headers
        .split('\n')
        .filter(Boolean)
        .map((h) => {
          const i = h.indexOf(':')
          const k = h.slice(0, i).trim()
          const v = h.slice(i + 1).trim()
          return `  -H '${k}: ${v}'`
        })
        .join(' \\\n')} \\\n  -d '${current.body.replace(/'/g, `'\\''`)}'`
    : ''

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">模擬 Headers</label>
          <textarea className="field" rows={4} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          <label className="label">Payload</label>
          <textarea className="field mono" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="row">
            <span className={`tag ${isJson(body) ? '' : ''}`} style={{ background: isJson(body) ? 'var(--teal-soft)' : 'var(--rose-soft)' }}>
              {isJson(body) ? 'JSON 有效' : '非 JSON／格式錯誤'}
            </span>
            <select className="field" style={{ width: 120 }} value={status} onChange={(e) => setStatus(+e.target.value)}>
              {[200, 201, 400, 401, 500].map((s) => (
                <option key={s} value={s}>
                  HTTP {s}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button type="button" className="btn accent" onClick={() => send()}>
              送出 Webhook
            </button>
            <button type="button" className="btn ghost" onClick={() => setBody(tryPretty(body))}>
              格式化 JSON
            </button>
            <button type="button" className="btn ghost" onClick={() => setEvents([])}>
              清空
            </button>
          </div>
        </div>
        <div className="panel stack">
          <input
            className="field"
            placeholder="搜尋事件…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="list" style={{ maxHeight: 180, overflow: 'auto' }}>
            {filtered.map((e) => (
              <li
                key={e.id}
                className="list-item"
                style={{ cursor: 'pointer', background: current?.id === e.id ? 'var(--accent-soft)' : undefined }}
                onClick={() => setSel(e.id)}
              >
                <span className="tag">{e.status}</span>
                <span style={{ flex: 1 }} className="mono muted">
                  {new Date(e.at).toLocaleTimeString()}
                </span>
                <button type="button" className="btn ghost sm" onClick={(ev) => { ev.stopPropagation(); send(e) }}>
                  重放
                </button>
              </li>
            ))}
            {!filtered.length && <p className="muted">尚無事件</p>}
          </ul>
          {current && (
            <>
              <label className="label">Headers</label>
              <pre className="mono panel" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{current.headers}</pre>
              <label className="label">Body</label>
              <pre className="mono panel" style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{current.body}</pre>
              <button type="button" className="btn ghost" onClick={() => void copyText(curl)}>
                複製為 cURL
              </button>
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
