import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('oauth-playground')!

const CLIENT_MAX = 120
const REDIRECT_MAX = 2048
const SCOPE_MAX = 80
const JWT_MAX = 8000

type Provider = 'GitHub' | 'Google' | 'Discord'
type Step = 1 | 2 | 3 | 4
type Token = {
  id: string
  provider: Provider
  access: string
  idToken: string
  scope: string
  at: number
  revoked?: boolean
  state: string
  nonce: string
  pkce: boolean
}

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
    const json = decodeURIComponent(escape(atob(part.replace(/-/g, '+').replace(/_/g, '/'))))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function randomCode(n = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function mockCodeChallenge(verifier: string) {
  // 簡易 demo：非真實 SHA-256，僅展示 PKCE 流程字串
  let h = 0
  for (let i = 0; i < verifier.length; i++) h = (h * 31 + verifier.charCodeAt(i)) >>> 0
  return `chal_${h.toString(16)}_${verifier.slice(0, 8)}`
}

export default function Page() {
  const [provider, setProvider] = useState<Provider>('GitHub')
  const [clientId, setClientId] = useLocalStorage('lab:oauth-playground:client', 'lab_demo_client_id')
  const [redirect, setRedirect] = useLocalStorage('lab:oauth-playground:redirect', 'https://app.lab.local/oauth/callback')
  const [selected, setSelected] = useLocalStorage<string[]>('lab:oauth-playground:scopes', ['read:user'])
  const [customScope, setCustomScope] = useState('')
  const [usePkce, setUsePkce] = useLocalStorage('lab:oauth-playground:pkce', true)
  const [step, setStep] = useState<Step>(1)
  const [code, setCode] = useState('')
  const [state, setState] = useState('')
  const [nonce, setNonce] = useState('')
  const [verifier, setVerifier] = useState('')
  const [challenge, setChallenge] = useState('')
  const [tokens, setTokens] = useLocalStorage<Token[]>('lab:oauth-playground:tokens-v2', [])
  const [log, setLog] = useLocalStorage<string[]>('lab:oauth-playground:log', [])
  const [viewToken, setViewToken] = useState<Token | null>(null)
  const [manualJwt, setManualJwt] = useState('')

  const scopes = useMemo(() => {
    const base = defaultScopes[provider]
    const extra = selected.filter((s) => !base.includes(s))
    return [...base, ...extra]
  }, [provider, selected])

  const decoded = viewToken ? decodeJwtPayload(viewToken.idToken) : manualJwt ? decodeJwtPayload(manualJwt) : null

  function goAuthorize() {
    const st = `st_${uid('').slice(0, 10)}`
    const nn = `n_${uid('').slice(0, 10)}`
    setState(st)
    setNonce(nn)
    let v = ''
    let ch = ''
    if (usePkce) {
      v = randomCode(43)
      ch = mockCodeChallenge(v)
      setVerifier(v)
      setChallenge(ch)
    } else {
      setVerifier('')
      setChallenge('')
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      scope: selected.join(' '),
      response_type: 'code',
      state: st,
      nonce: nn,
    })
    if (usePkce) {
      params.set('code_challenge', ch)
      params.set('code_challenge_method', 'S256')
    }
    const authUrl = `https://auth.example/${provider.toLowerCase()}/authorize?${params.toString()}`
    const lines = [
      `1. Redirect → ${authUrl}`,
      `   state=${st}`,
      `   nonce=${nn}`,
      usePkce ? `   PKCE code_challenge=${ch}` : '   PKCE 關閉',
      '2. 使用者同意授權…',
    ]
    setLog(lines)
    setStep(2)
  }

  function receiveCallback() {
    const c = `code_${uid('').slice(0, 8)}`
    setCode(c)
    setLog((l) => [...l, `3. Callback ${redirect}?code=${c}&state=${state}`, '   ✓ state 比對通過'])
    setStep(3)
  }

  function exchange() {
    if (usePkce) {
      setLog((l) => [...l, `3.5 驗證 PKCE：code_verifier=${verifier.slice(0, 12)}… ↔ challenge`])
    }
    const access = `atk_${uid('').slice(0, 12)}`
    const idToken = mockJwt({
      sub: 'user_42',
      email: 'demo@lab.app',
      name: 'Lab Demo',
      provider,
      scope: selected.join(' '),
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      client_id: clientId,
      aud: clientId,
    })
    const tok: Token = {
      id: uid('tok'),
      provider,
      access,
      idToken,
      scope: selected.join(' '),
      at: Date.now(),
      state,
      nonce,
      pkce: usePkce,
    }
    setTokens((xs) => [tok, ...xs].slice(0, 20))
    setViewToken(tok)
    setLog((l) => [
      ...l,
      `4. POST /oauth/token → access_token=${access}`,
      `   id_token=${idToken.slice(0, 48)}…`,
      `   nonce 寫入 JWT payload`,
    ])
    setStep(4)
  }

  function revoke(id: string) {
    setTokens((xs) => xs.map((t) => (t.id === id ? { ...t, revoked: true } : t)))
    const t = tokens.find((x) => x.id === id)
    if (t) setLog((l) => [...l, `REVOKE ${t.access} @ ${new Date().toLocaleTimeString('zh-TW')}`])
    if (viewToken?.id === id) setViewToken((vt) => (vt ? { ...vt, revoked: true } : vt))
  }

  function resetFlow() {
    setStep(1)
    setCode('')
    setState('')
    setNonce('')
    setVerifier('')
    setChallenge('')
  }

  function exportLog() {
    downloadText(
      'oauth-flow-log.txt',
      [`# OAuth Playground Log`, `exported: ${new Date().toISOString()}`, '', ...log].join('\n'),
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={exportLog} disabled={!log.length}>
            匯出日誌
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setLog([])}>
            清空日誌
          </button>
        </div>
      }
    >
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
        <label className="row" style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={usePkce} onChange={(e) => setUsePkce(e.target.checked)} />
          PKCE
        </label>
        <span className="tag">步驟 {step}/4</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <label className="label">client_id</label>
          <input className={cn('field mono', !isNonEmpty(clientId) && 'is-invalid')} maxLength={CLIENT_MAX} value={clientId} onChange={(e) => setClientId(limitText(e.target.value, CLIENT_MAX))} />
            <div className="field-meta"><span className={!isNonEmpty(clientId) ? 'warn' : undefined}>{isNonEmpty(clientId) ? 'Client ID OK' : '請填 Client ID'}</span><span>{charCount(clientId)}/{CLIENT_MAX}</span></div>
          <label className="label">redirect_uri</label>
          <input className={cn('field mono', !isValidHttpUrl(normalizeHttpUrl(redirect)) && 'is-invalid')} maxLength={REDIRECT_MAX} value={redirect} onChange={(e) => setRedirect(limitText(e.target.value, REDIRECT_MAX))} onBlur={() => { const n = normalizeHttpUrl(redirect); if (isValidHttpUrl(n)) setRedirect(n) }} />
            <div className="field-meta"><span className={!isValidHttpUrl(normalizeHttpUrl(redirect)) ? 'warn' : undefined}>{isValidHttpUrl(normalizeHttpUrl(redirect)) ? 'Redirect URI 有效' : '需為 http(s) URL'}</span><span>{charCount(redirect)}/{REDIRECT_MAX}</span></div>

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
            <input className="field mono" maxLength={SCOPE_MAX} placeholder="自訂 scope" value={customScope} onChange={(e) => setCustomScope(limitText(e.target.value, SCOPE_MAX))} />
            <div className="field-meta"><span className="field-hint">選填 scope</span><span>{charCount(customScope)}/{SCOPE_MAX}</span></div>
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

          {(state || nonce || challenge) && (
            <div className="list-item stack" style={{ gap: 4, fontSize: 12 }}>
              {state && (
                <div>
                  <span className="muted">state</span> <span className="mono">{state}</span>
                </div>
              )}
              {nonce && (
                <div>
                  <span className="muted">nonce</span> <span className="mono">{nonce}</span>
                </div>
              )}
              {usePkce && challenge && (
                <div>
                  <span className="muted">code_challenge</span> <span className="mono">{challenge}</span>
                </div>
              )}
              {usePkce && verifier && (
                <div>
                  <span className="muted">code_verifier</span> <span className="mono">{verifier.slice(0, 24)}…</span>
                </div>
              )}
            </div>
          )}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {step === 1 && (
              <button type="button" className="btn accent" onClick={goAuthorize} disabled={!isNonEmpty(clientId) || !isValidHttpUrl(normalizeHttpUrl(redirect))}>
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

          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'var(--bg-muted)', padding: 12, borderRadius: 8, maxHeight: 220, overflow: 'auto' }}>
            {log.join('\n') || '流程日誌…'}
          </pre>
        </div>

        <div className="panel stack">
          <div className="label">Token / JWT Payload Viewer</div>
          <ul className="list">
            {tokens.map((t) => (
              <li key={t.id} className="list-item stack" style={{ cursor: 'pointer', opacity: t.revoked ? 0.55 : 1 }} onClick={() => setViewToken(t)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{t.provider}</strong>
                  <div className="row">
                    {t.pkce && <span className="tag">PKCE</span>}
                    {t.revoked ? <span className="tag">已撤銷</span> : <span className="tag">有效</span>}
                  </div>
                </div>
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {t.access}
                </span>
                <span className="tag">{t.scope}</span>
                {!t.revoked && (
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      revoke(t.id)
                    }}
                  >
                    撤銷 Token
                  </button>
                )}
              </li>
            ))}
            {!tokens.length && <li className="list-item muted">尚無 token</li>}
          </ul>
          <label className="label">貼上 JWT 解碼</label>
          <textarea className="field mono" rows={2} maxLength={JWT_MAX} value={manualJwt} onChange={(e) => setManualJwt(limitText(e.target.value, JWT_MAX))} placeholder="header.payload.sig" />
              <div className="field-meta"><span className="field-hint">手動貼上 JWT</span><span>{charCount(manualJwt)}/{JWT_MAX}</span></div>
          {viewToken && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn sm ghost" onClick={() => void copyText(viewToken.idToken)}>
                複製 id_token
              </button>
              <button type="button" className="btn sm ghost" onClick={() => void copyText(viewToken.access)}>
                複製 access_token
              </button>
              {!viewToken.revoked && (
                <button type="button" className="btn sm danger" onClick={() => revoke(viewToken.id)}>
                  撤銷
                </button>
              )}
            </div>
          )}
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 280, overflow: 'auto' }}>
            {JSON.stringify(decoded, null, 2) || '尚無可解碼內容'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
