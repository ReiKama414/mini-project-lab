import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('oauth-playground')!

type Provider = 'GitHub' | 'Google' | 'Discord'
type Token = { provider: Provider; access: string; scope: string; at: number }

const scopes: Record<Provider, string[]> = {
  GitHub: ['read:user', 'repo', 'gist'],
  Google: ['openid', 'email', 'profile'],
  Discord: ['identify', 'email', 'guilds'],
}

export default function Page() {
  const [provider, setProvider] = useState<Provider>('GitHub')
  const [selected, setSelected] = useState<string[]>(['read:user'])
  const [tokens, setTokens] = useLocalStorage<Token[]>('lab:oauth-playground', [])
  const [step, setStep] = useState<'authorize' | 'callback' | 'done'>('authorize')
  const [log, setLog] = useState<string[]>([])

  function authorize() {
    setLog([`Redirect → ${provider} authorize?scope=${selected.join('%20')}`, 'User consents…', 'Callback with ?code=demo_code'])
    setStep('callback')
  }

  function exchange() {
    const access = `atk_${uid('').slice(0, 12)}`
    setTokens((xs) => [{ provider, access, scope: selected.join(' '), at: Date.now() }, ...xs])
    setLog((l) => [...l, `POST /oauth/token → access_token=${access}`])
    setStep('done')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">Provider</div>
          <div className="row">
            {(['GitHub', 'Google', 'Discord'] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`btn sm ${provider === p ? 'accent' : 'ghost'}`}
                onClick={() => {
                  setProvider(p)
                  setSelected([scopes[p][0]!])
                  setStep('authorize')
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="label">Scopes</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {scopes[provider].map((s) => (
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
          {step === 'authorize' && (
            <button type="button" className="btn accent" onClick={authorize}>
              Simulate Authorize
            </button>
          )}
          {step === 'callback' && (
            <button type="button" className="btn accent" onClick={exchange}>
              Exchange Code → Token
            </button>
          )}
          {step === 'done' && (
            <button type="button" className="btn ghost" onClick={() => setStep('authorize')}>
              再試一次
            </button>
          )}
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {log.join('\n') || '流程日誌…'}
          </pre>
        </div>
        <div className="panel">
          <div className="label">已取得 Tokens</div>
          <ul className="list">
            {tokens.map((t, i) => (
              <li key={i} className="list-item stack">
                <strong>{t.provider}</strong>
                <span className="mono muted">{t.access}</span>
                <span className="tag">{t.scope}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
