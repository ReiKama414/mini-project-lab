import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('oauth-playground')!

type Provider = 'GitHub' | 'Google' | 'Discord'
type Step = 1 | 2 | 3 | 4
type Token = { provider: Provider; access: string; idToken: string; scope: string; at: number }

const defaultScopes: Record<Provider, string[]> = {
  GitHub: ['read:user', 'repo', 'gist'],
  Google: ['openid', 'email', 'profile'],
  Discord: ['identify', 'email', 'guilds'],
}

function b64url(obj: unknown) {
  const json = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function mockJwt(payload: Record<string, unknown>) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const body = b64url(payload)
  return `${header}.${body}.signature_demo`
}

function decodeJwtPayload(token: string) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = decodeURIComponent(
      escape(atob(part.replace(/-/g, '+').replace(/_/g, '/'))),
    )
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export default function Page() {
  const [provider, setProvider] = useState<Provider>('GitHub')
  const [clientId, setClientId] = useLocalStorage('lab:oauth-playground:client', 'lab_demo_client_id')
  const [selected, setSelected] = useLocalStorage<string[]>('lab:oauth-playground:scopes', ['read:user'])
  const [customScope, setCustomScope] = useState('')
  const [step, setStep] = useState<Step>(1)
  const [code, setCode] = useState('')
  const [tokens, setTokens] = useLocalStorage<Token[]>('lab:oauth-playground', [])
  const [log, setLog] = useState<string[]>([])
  const [viewToken, setViewToken] = useState<Token | null>(null)

  const scopes = useMemo(() => {
    const base = defaultScopes[provider]
    const extra = selected.filter((s) => !base.includes(s))
    return [...base, ...extra]
  }, [provider, selected])

  const decoded = viewToken ? decodeJwtPayload(viewToken.idToken) : null

  function goAuthorize() {
    const authUrl = `https://auth.example/${provider.toLowerCase()}/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(selected.join(' '))}&response_type=code`
    setLog([`1. Redirect → ${authUrl}`, '2. 使用者同意授權…'])
    setStep(2)
  }

  function receiveCallback() {
    const c = `code_${uid('').slice(0, 8)}`
    setCode(c)
    setLog((l) => [...l, `3. Callback ?code=${c}`])
    setStep(3)
  }

  function exchange() {
    const access = `atk_${uid('').slice(0, 12)}`
    const idToken = mockJwt({
      sub: 'user_42',
      email: 'demo@lab.app',
      name: 'Lab Demo',
      provider,
      scope: selected.join(' '),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      client_id: clientId,
    })
    const tok: Token = { provider, access, idToken, scope: selected.join(' '), at: Date.now() }
    setTokens((xs) => [tok, ...xs].slice(0, 20))
    setViewToken(tok)
    setLog((l) => [...l, `4. POST /oauth/token → access_token=${access}`, `   id_token=${idToken.slice(0, 40)}…`])
    setStep(4)
  }

  function resetFlow() {
    setStep(1)
    setCode('')
    setLog([])
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(['GitHub', 'Google', 'Discord'] as Provider[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`btn sm ${provider === p ? 'accent' : 'ghost'}`}
            onClick={() => {
              setProvider(p)
              setSelected([defaultScopes[p][0]!])
              resetFlow()
            }}
          >
            {p}
          </button>
        ))}
        <span className="tag">步驟 {step}/4</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <label className="label">client_id</label>
          <input className="field mono" value={clientId} onChange={(e) => setClientId(e.target.value)} />

          <label className="label">Scopes</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {scopes.map((s) => (
              <button
                key={s}
                type="button"
                className={`btn sm ${selected.includes(s) ? 'teal' : 'ghost'}`}
                onClick={() => setSelected((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]))}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="row">
            <input className="field mono" placeholder="自訂 scope" value={customScope} onChange={(e) => setCustomScope(e.target.value)} />
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => {
                const s = customScope.trim()
                if (!s) return
                setSelected((xs) => (xs.includes(s) ? xs : [...xs, s]))
                setCustomScope('')
              }}
            >
              加入
            </button>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {step === 1 && (
              <button type="button" className="btn accent" onClick={goAuthorize}>
                1. Authorize
              </button>
            )}
            {step === 2 && (
              <button type="button" className="btn accent" onClick={receiveCallback}>
                2. 模擬 Callback
              </button>
            )}
            {step === 3 && (
              <button type="button" className="btn accent" onClick={exchange}>
                3. Exchange Code → Token
              </button>
            )}
            {step === 4 && (
              <button type="button" className="btn ghost" onClick={resetFlow}>
                重新開始
              </button>
            )}
            {code && <span className="mono muted">code={code}</span>}
          </div>

          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'var(--bg-muted)', padding: 12, borderRadius: 8 }}>
            {log.join('\n') || '流程日誌…'}
          </pre>
        </div>

        <div className="panel stack">
          <div className="label">Token / JWT Payload</div>
          <ul className="list">
            {tokens.map((t, i) => (
              <li key={i} className="list-item stack" style={{ cursor: 'pointer' }} onClick={() => setViewToken(t)}>
                <strong>{t.provider}</strong>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {t.access}
                </span>
                <span className="tag">{t.scope}</span>
              </li>
            ))}
            {!tokens.length && <li className="list-item muted">尚無 token</li>}
          </ul>
          {viewToken && (
            <div className="stack">
              <div className="row">
                <button type="button" className="btn sm ghost" onClick={() => copyText(viewToken.idToken)}>
                  複製 id_token
                </button>
              </div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 280, overflow: 'auto' }}>
                {JSON.stringify(decoded, null, 2) || '無法解碼'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
