import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('webhook-tester')!

const BODY_MAX = 50000
const HEADERS_MAX = 4000
const SECRET_MAX = 200
const URL_MAX = 2048
const FILTER_MAX = 120

type Event = {
  id: string
  at: number
  headers: string
  body: string
  eventName: string
  status: number
  signature: string
  valid: boolean
}

const STATUS_OPTIONS = [200, 201, 202, 204, 400, 401, 403, 404, 422, 500, 502]

const SAMPLE_PAYLOADS: { event: string; body: string }[] = [
  {
    event: 'payment.succeeded',
    body: JSON.stringify({ event: 'payment.succeeded', amount: 1990, currency: 'TWD', invoice_id: 'inv_1001' }, null, 2),
  },
  {
    event: 'payment.failed',
    body: JSON.stringify({ event: 'payment.failed', amount: 500, reason: 'card_declined', invoice_id: 'inv_1002' }, null, 2),
  },
  {
    event: 'user.created',
    body: JSON.stringify({ event: 'user.created', user: { id: 'u_42', email: 'ada@lab.test' } }, null, 2),
  },
  {
    event: 'user.updated',
    body: JSON.stringify({ event: 'user.updated', user: { id: 'u_42', name: 'Ada Lovelace' }, changed: ['name'] }, null, 2),
  },
  {
    event: 'subscription.canceled',
    body: JSON.stringify({ event: 'subscription.canceled', plan: 'Pro', effective_at: '2026-09-01' }, null, 2),
  },
  {
    event: 'shipment.delivered',
    body: JSON.stringify({ event: 'shipment.delivered', tracking: 'TW123456', carrier: 'local' }, null, 2),
  },
]

function eventNameFromBody(body: string) {
  try {
    const j = JSON.parse(body) as { event?: string; type?: string }
    return j.event || j.type || 'unknown'
  } catch {
    return 'invalid-json'
  }
}

/** 簡易 HMAC-demo：非真實加密，僅示意簽名字串 */
function simpleHmac(secret: string, payload: string) {
  const raw = `${secret}:${payload}`
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `sha256=${(h >>> 0).toString(16).padStart(8, '0')}`
}

export default function Page() {
  const [events, setEvents] = useLocalStorage<Event[]>('lab:webhook-tester:v2', [])
  const [body, setBody] = useLocalStorage('lab:webhook-tester:body', SAMPLE_PAYLOADS[0]!.body)
  const [headers, setHeaders] = useLocalStorage(
    'lab:webhook-tester:headers',
    'Content-Type: application/json\nX-Signature: demo',
  )
  const [secret, setSecret] = useLocalStorage('lab:webhook-tester:secret', 'whsec_lab_demo')
  const [statusCode, setStatusCode] = useLocalStorage('lab:webhook-tester:status', 200)
  const [sel, setSel] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [jsonErr, setJsonErr] = useState('')
  const [jsonOk, setJsonOk] = useState(false)
  const [endpoint, setEndpoint] = useLocalStorage('lab:webhook-tester:endpoint', 'https://hooks.lab.local/receive')
  const [verifyMsg, setVerifyMsg] = useState('')

  const current = events.find((e) => e.id === sel) || events[0]
  const expectedSig = useMemo(() => simpleHmac(secret, body), [secret, body])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return events
    return events.filter(
      (e) =>
        e.eventName.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        String(e.status).includes(q),
    )
  }, [events, filter])

  function validateJson() {
    if (charCount(body) > BODY_MAX) {
      setJsonErr(`Payload 超過 ${BODY_MAX.toLocaleString()} 字上限`)
      setJsonOk(false)
      return false
    }
    if (!isNonEmpty(body)) {
      setJsonErr('Payload 不可空白')
      setJsonOk(false)
      return false
    }
    try {
      JSON.parse(body)
      setJsonErr('')
      setJsonOk(true)
      return true
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Invalid JSON')
      setJsonOk(false)
      return false
    }
  }

  function pretty() {
    if (charCount(body) > BODY_MAX) {
      setJsonErr(`Payload 超過 ${BODY_MAX.toLocaleString()} 字上限`)
      setJsonOk(false)
      return
    }
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2))
      setJsonErr('')
      setJsonOk(true)
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Invalid JSON')
      setJsonOk(false)
    }
  }

  function applySample(sample: (typeof SAMPLE_PAYLOADS)[0]) {
    setBody(sample.body)
    setJsonErr('')
    setJsonOk(true)
    const sig = simpleHmac(secret, sample.body)
    setHeaders(`Content-Type: application/json\nX-Signature: ${sig}\nX-Event: ${sample.event}`)
  }

  function signPayload() {
    const sig = simpleHmac(secret, body)
    const lines = headers
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^X-Signature:/i.test(l))
    lines.push(`X-Signature: ${sig}`)
    setHeaders(lines.join('\n'))
    setVerifyMsg(`已寫入簽章 ${sig}`)
  }

  function verifySignature() {
    const line = headers.split('\n').find((l) => /^X-Signature:/i.test(l.trim()))
    const got = line?.split(':').slice(1).join(':').trim() || ''
    const ok = got === expectedSig
    setVerifyMsg(ok ? `✓ 簽章相符（${got}）` : `✗ 不符：收到 ${got || '(空)'}，預期 ${expectedSig}`)
  }

  function pushEvent(h: string, b: string, status: number) {
    const sigLine = h.split('\n').find((l) => /^X-Signature:/i.test(l.trim()))
    const sig = sigLine?.split(':').slice(1).join(':').trim() || ''
    const expect = simpleHmac(secret, b)
    const ev: Event = {
      id: uid('wh'),
      at: Date.now(),
      headers: h,
      body: b,
      eventName: eventNameFromBody(b),
      status,
      signature: sig,
      valid: sig === expect,
    }
    setEvents((xs) => [ev, ...xs].slice(0, 80))
    setSel(ev.id)
  }

  function send() {
    if (charCount(body) > BODY_MAX) {
      setJsonErr(`Payload 超過 ${BODY_MAX.toLocaleString()} 字上限`)
      setJsonOk(false)
      return
    }
    if (!validateJson()) return
    pushEvent(limitText(headers, HEADERS_MAX), limitText(body, BODY_MAX), statusCode)
  }

  const endpointOk = isValidHttpUrl(normalizeHttpUrl(endpoint))
  const bodyTooBig = charCount(body) > BODY_MAX
  const canSend = isNonEmpty(body) && !bodyTooBig

  function replay() {
    if (!current) return
    pushEvent(current.headers, current.body, current.status)
  }

  function curlFor(ev: Event) {
    const hdr = ev.headers
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `-H ${JSON.stringify(l)}`)
      .join(' \\\n  ')
    return `curl -X POST ${JSON.stringify(endpoint)} \\\n  ${hdr} \\\n  -d ${JSON.stringify(ev.body)}\n# 預期回應 HTTP ${ev.status}`
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>
          範例事件
        </span>
        {SAMPLE_PAYLOADS.map((s) => (
          <button key={s.event} type="button" className="btn sm ghost" onClick={() => applySample(s)}>
            {s.event}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">Endpoint（用於 curl）</span>
            <input
              className={cn('field mono', !endpointOk && 'is-invalid')}
              maxLength={URL_MAX}
              value={endpoint}
              onChange={(e) => setEndpoint(limitText(e.target.value, URL_MAX))}
              onBlur={() => {
                const n = normalizeHttpUrl(endpoint)
                if (isValidHttpUrl(n)) setEndpoint(n)
              }}
            />
            <div className="field-meta">
              <span className={!endpointOk ? 'warn' : undefined}>{endpointOk ? 'URL 有效' : '請輸入 http(s) URL'}</span>
              <span>{charCount(endpoint)}/{URL_MAX}</span>
            </div>
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="stack" style={{ flex: 1, minWidth: 160 }}>
              <span className="label">Webhook Secret</span>
              <input
                className="field mono"
                maxLength={SECRET_MAX}
                value={secret}
                onChange={(e) => setSecret(limitText(e.target.value, SECRET_MAX))}
              />
              <div className="field-meta">
                <span className="field-hint">簽章用密鑰</span>
                <span>{charCount(secret)}/{SECRET_MAX}</span>
              </div>
            </label>
            <label className="stack">
              <span className="label">回應狀態碼</span>
              <select className="field" value={statusCode} onChange={(e) => setStatusCode(Number(e.target.value))} style={{ width: 100 }}>
                {STATUS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="stack">
            <span className="label">模擬 Headers</span>
            <textarea
              className="field"
              rows={4}
              maxLength={HEADERS_MAX}
              value={headers}
              onChange={(e) => setHeaders(limitText(e.target.value, HEADERS_MAX))}
            />
            <div className="field-meta">
              <span className="field-hint">每行一個 Header</span>
              <span>{charCount(headers)}/{HEADERS_MAX}</span>
            </div>
          </label>
          <label className="stack">
            <span className="label">Payload (JSON)</span>
            <textarea
              className={cn('field mono', (jsonErr || bodyTooBig || !isNonEmpty(body)) && 'is-invalid')}
              rows={10}
              maxLength={BODY_MAX}
              value={body}
              onChange={(e) => {
                setBody(limitText(e.target.value, BODY_MAX))
                setJsonOk(false)
                setJsonErr('')
              }}
            />
            <div className="field-meta">
              <span className={bodyTooBig || !isNonEmpty(body) ? 'warn' : undefined}>
                {bodyTooBig ? '超過大小上限' : isNonEmpty(body) ? '可驗證／送出' : '請輸入 JSON'}
              </span>
              <span>{charCount(body)}/{BODY_MAX}</span>
            </div>
          </label>
          <div className="list-item muted mono" style={{ fontSize: 12 }}>
            預期簽章（HMAC-demo）：{expectedSig}
          </div>
          {(jsonErr || bodyTooBig) && (
            <p className="field-error">
              {bodyTooBig ? `Payload 超過 ${BODY_MAX.toLocaleString()} 字上限` : `JSON 錯誤：${jsonErr}`}
            </p>
          )}
          {jsonOk && !jsonErr && !bodyTooBig && <p className="field-hint">JSON 有效</p>}
          {verifyMsg && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{verifyMsg}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn ghost sm" onClick={validateJson} disabled={!isNonEmpty(body)}>
              驗證 JSON
            </button>
            <button type="button" className="btn ghost sm" onClick={pretty} disabled={!isNonEmpty(body) || bodyTooBig}>
              Pretty Print
            </button>
            <button type="button" className="btn ghost sm" onClick={signPayload} disabled={!isNonEmpty(body)}>
              產生簽章
            </button>
            <button type="button" className="btn ghost sm" onClick={verifySignature}>
              驗證簽章
            </button>
            <button type="button" className="btn accent" onClick={send} disabled={!canSend}>
              送出 → {statusCode}
            </button>
            <button type="button" className="btn ghost" onClick={() => setEvents([])}>
              清空
            </button>
          </div>
        </div>
        <div className="panel stack">
          <div className="row">
            <input
              className="field"
              maxLength={FILTER_MAX}
              placeholder="篩選 event / 狀態碼…"
              value={filter}
              onChange={(e) => setFilter(limitText(e.target.value, FILTER_MAX))}
              style={{ flex: 1 }}
            />
            <span className="muted">{filtered.length}</span>
          </div>
          <ul className="list">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="list-item"
                style={{
                  cursor: 'pointer',
                  outline: current?.id === e.id ? '2px solid var(--accent)' : undefined,
                }}
                onClick={() => setSel(e.id)}
              >
                <span className="tag">{e.eventName}</span>{' '}
                <span className={`tag ${e.status < 400 ? '' : ''}`} style={{ background: e.status < 400 ? 'var(--teal-soft)' : 'var(--rose-soft)' }}>
                  {e.status}
                </span>{' '}
                <span className="tag">{e.valid ? 'sig✓' : 'sig✗'}</span>{' '}
                <span className="mono muted">{new Date(e.at).toLocaleTimeString('zh-TW')}</span>
              </li>
            ))}
            {!filtered.length && <li className="list-item muted">尚無事件</li>}
          </ul>
          {current && (
            <div className="stack">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn sm teal" onClick={replay}>
                  Replay
                </button>
                <button type="button" className="btn sm ghost" onClick={() => void copyText(curlFor(current))}>
                  複製 curl
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => downloadText(`webhook-${current.id}.sh`, curlFor(current))}
                >
                  下載 curl
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                HTTP {current.status} · 簽章 {current.valid ? '有效' : '無效'} · {current.signature || '(無)'}
              </div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                {current.headers}
              </pre>
              <pre
                className="mono"
                style={{
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  background: 'var(--bg-muted)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
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
