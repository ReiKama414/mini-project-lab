import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'jwt-generator',
  title: 'JWT 產生器',
  description: '本機 Web Crypto 產生 HS256 JWT',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['dev', 'security'],
}
const meta = getProject('jwt-generator') ?? fallback

const MAX = 8000
const SECRET_MAX = 256

const PAYLOAD_SAMPLES = [
  {
    label: '基本',
    body: '{\n  "sub": "123",\n  "name": "Ada",\n  "iat": 1516239022\n}',
  },
  {
    label: '含角色',
    body: '{\n  "sub": "admin",\n  "roles": ["admin", "read"],\n  "iat": 1516239022\n}',
  },
  {
    label: '含 exp',
    body: `{\n  "sub": "user1",\n  "name": "Bob",\n  "iat": ${Math.floor(Date.now() / 1000)},\n  "exp": ${Math.floor(Date.now() / 1000) + 3600}\n}`,
  },
]

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
    PAYLOAD_SAMPLES[0]!.body,
  )
  const [secret, setSecret] = useState('demo-secret-change-me')
  const [showSecret, setShowSecret] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

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
      setCopied(null)
      setHint('已產生 HS256 JWT')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON 無效')
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!token}
            onClick={() => void copyVal(token, 'token')}
            icon="copy"
          >
            {copied === 'token' ? '已複製' : '複製 Token'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!token}
            onClick={() => downloadText('token.jwt', token, 'text/plain')}
            icon="download"
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">HS256</span>
              {token && <span className="tag">已產生</span>}
              {busy && <span className="tag">產生中…</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">Payload 範例</div>
            <div className="pw-chips">
              {PAYLOAD_SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setPayload(s.body)
                    setHint(`已套用「${s.label}」`)
                    setToken('')
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <ActionButton className="btn sm accent" disabled={busy} onClick={() => void generate()} icon="none">
              {busy ? '產生中…' : '產生 HS256 JWT'}
            </ActionButton>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">輸入</h3>
            </div>
            {error && <p className="field-error">{error}</p>}
            {hint && !error && <p className="field-hint">{hint}</p>}
            <div className="stack" style={{ gap: 12 }}>
              <label className="stack">
                <span className="label">Header JSON</span>
                <textarea
                  className="field mono"
                  rows={5}
                  value={header}
                  maxLength={MAX}
                  spellCheck={false}
                  onChange={(e) => setHeader(limitText(e.target.value, MAX))}
                />
                <div className="field-meta">
                  <span>alg 會固定為 HS256</span>
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
                  spellCheck={false}
                  onChange={(e) => setPayload(limitText(e.target.value, MAX))}
                />
                <div className="field-meta">
                  <span>
                    {charCount(payload)} / {MAX}
                  </span>
                </div>
              </label>
              <label className="stack">
                <span className="label">HMAC Secret</span>
                <div className="row" style={{ gap: 8 }}>
                  <input
                    className={`field mono${!isNonEmpty(secret) ? ' is-invalid' : ''}`}
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    maxLength={SECRET_MAX}
                    autoComplete="off"
                    onChange={(e) => setSecret(limitText(e.target.value, SECRET_MAX))}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn sm ghost" onClick={() => setShowSecret((v) => !v)}>
                    {showSecret ? '隱藏' : '顯示'}
                  </button>
                </div>
                <div className="field-meta">
                  <span>不寫入 localStorage</span>
                  <span>
                    {charCount(secret)} / {SECRET_MAX}
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">JWT 輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!token}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'token' ? '已複製' : '複製'}
                  onClick={() => void copyVal(token, 'token')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!token}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('token.jwt', token, 'text/plain')}
                />
              </div>
            </div>
            {token ? (
              <pre className="xc-pre mono" style={{ wordBreak: 'break-all' }}>
                {token}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                填寫後按「產生」即可取得 Token
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>僅支援 HS256（HMAC-SHA256），以 Web Crypto 簽署</strong>
            </li>
            <li>
              <span className="muted">用途</span>
              <strong>開發／測試用；正式環境請用後端金鑰管理與正確時鐘</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>Secret 與 Token 不寫入 localStorage、不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>JWT Decoder、Hash Generator</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
