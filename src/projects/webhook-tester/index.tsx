import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('webhook-tester')!

type Event = { id: string; at: number; headers: string; body: string; eventName: string }

function eventNameFromBody(body: string) {
  try {
    const j = JSON.parse(body) as { event?: string; type?: string }
    return j.event || j.type || 'unknown'
  } catch {
    return 'invalid-json'
  }
}

export default function Page() {
  const [events, setEvents] = useLocalStorage<Event[]>('lab:webhook-tester', [])
  const [body, setBody] = useState('{\n  "event": "payment.succeeded",\n  "amount": 1990\n}')
  const [headers, setHeaders] = useState('Content-Type: application/json\nX-Signature: demo')
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [jsonErr, setJsonErr] = useState('')
  const [endpoint] = useLocalStorage('lab:webhook-tester:endpoint', 'https://hooks.lab.local/receive')

  const current = events.find((e) => e.id === sel) || events[0]

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) => e.eventName.toLowerCase().includes(q) || e.body.toLowerCase().includes(q))
  }, [events, filter])

  function validateJson() {
    try {
      JSON.parse(body)
      setJsonErr('')
      return true
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Invalid JSON')
      return false
    }
  }

  function pretty() {
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2))
      setJsonErr('')
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  function pushEvent(h: string, b: string) {
    const ev: Event = { id: uid('wh'), at: Date.now(), headers: h, body: b, eventName: eventNameFromBody(b) }
    setEvents((xs) => [ev, ...xs].slice(0, 80))
    setSel(ev.id)
  }

  function send() {
    if (!validateJson()) return
    pushEvent(headers, body)
  }

  function replay() {
    if (!current) return
    pushEvent(current.headers, current.body)
  }

  function curlFor(ev: Event) {
    const hdr = ev.headers
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `-H ${JSON.stringify(l)}`)
      .join(' \\\n  ')
    return `curl -X POST ${JSON.stringify(endpoint)} \\\n  ${hdr} \\\n  -d ${JSON.stringify(ev.body)}`
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">模擬 Headers</label>
          <textarea className="field" rows={4} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          <label className="label">Payload (JSON)</label>
          <textarea className="field mono" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          {jsonErr && <p style={{ color: 'var(--rose)', margin: 0 }}>{jsonErr}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn ghost sm" onClick={validateJson}>
              驗證 JSON
            </button>
            <button type="button" className="btn ghost sm" onClick={pretty}>
              Pretty Print
            </button>
            <button type="button" className="btn accent" onClick={send}>
              送出 Webhook
            </button>
            <button type="button" className="btn ghost" onClick={() => setEvents([])}>
              清空
            </button>
          </div>
        </div>
        <div className="panel stack">
          <div className="row">
            <input className="field" placeholder="篩選 event…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
            <span className="muted">{filtered.length}</span>
          </div>
          <ul className="list">
            {filtered.map((e) => (
              <li key={e.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(e.id)}>
                <span className="tag">{e.eventName}</span>{' '}
                <span className="mono muted">{new Date(e.at).toLocaleTimeString('zh-TW')}</span>
              </li>
            ))}
            {!filtered.length && <li className="list-item muted">尚無事件</li>}
          </ul>
          {current && (
            <div className="stack">
              <div className="row">
                <button type="button" className="btn sm teal" onClick={replay}>
                  Replay
                </button>
                <button type="button" className="btn sm ghost" onClick={() => copyText(curlFor(current))}>
                  複製 curl
                </button>
              </div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                {current.headers}
              </pre>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'var(--bg-muted)', padding: 12, borderRadius: 8, fontSize: 12 }}>
                {current.body}
              </pre>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 11, maxHeight: 140, overflow: 'auto' }}>
                {curlFor(current)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
