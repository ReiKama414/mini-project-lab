import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('jwt-generator') ?? {
  slug: 'jwt-generator',
  title: 'JWT Generator',
  description: '本機以 HS256 產生 JWT（Web Crypto）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['dev', 'security'],
}

const MAX = 8000
const SECRET_MAX = 256

function bytesToB64url(bytes: Uint8Array) {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToB64url(text: string) {
  return bytesToB64url(new TextEncoder().encode(text))
}

async function hmacSign(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return bytesToB64url(new Uint8Array(sig))
}

export default function Page() {
  const [header, setHeader] = useLocalStorage(
    'lab:jwt-generator:header',
    '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
  )
  const [payload, setPayload] = useLocalStorage(
    'lab:jwt-generator:payload',
    '{\n  "sub": "123",\n  "name": "Ada",\n  "iat": 1516239022\n}',
  )
  const [secret, setSecret] = useState('demo-secret-change-me')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (!isNonEmpty(header) || !isNonEmpty(payload)) {
      setError('請填寫 header 與 payload')
      return
    }
    if (!isNonEmpty(secret)) {
      setError('請填寫 HMAC secret')
      return
    }
    setBusy(true)
    setError('')
    try {
      const h = JSON.parse(header) as Record<string, unknown>
      const p = JSON.parse(payload)
      h.alg = 'HS256'
      h.typ = h.typ ?? 'JWT'
      const head = textToB64url(JSON.stringify(h))
      const body = textToB64url(JSON.stringify(p))
      const data = `${head}.${body}`
      const sig = await hmacSign(limitText(secret, SECRET_MAX), data)
      setToken(`${data}.${sig}`)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 無效')
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          以瀏覽器 Web Crypto 產生 <strong>HS256</strong> JWT。Secret 不寫入 localStorage、不上傳。僅供開發／測試。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">Header JSON</span>
            <textarea
              className="field mono"
              rows={6}
              value={header}
              maxLength={MAX}
              onChange={(e) => setHeader(limitText(e.target.value, MAX))}
            />
            <div className="field-meta">
              <span>
                {charCount(header)} / {MAX}
              </span>
            </div>
          </label>
          <label className="stack">
            <span className="label">Payload JSON</span>
            <textarea
              className="field mono"
              rows={6}
              value={payload}
              maxLength={MAX}
              onChange={(e) => setPayload(limitText(e.target.value, MAX))}
            />
            <div className="field-meta">
              <span>
                {charCount(payload)} / {MAX}
              </span>
            </div>
          </label>
        </div>
        <label className="stack">
          <span className="label">HMAC Secret</span>
          <input
            className={`field mono${!isNonEmpty(secret) ? ' is-invalid' : ''}`}
            type="password"
            value={secret}
            maxLength={SECRET_MAX}
            autoComplete="off"
            onChange={(e) => setSecret(limitText(e.target.value, SECRET_MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(secret)} / {SECRET_MAX}
            </span>
          </div>
        </label>
        <div className="row">
          <button type="button" className="btn accent" disabled={busy} onClick={() => void generate()}>
            {busy ? '產生中…' : '產生 HS256 JWT'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!token}
            onClick={async () => {
              await copyText(token)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {token && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {token}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
