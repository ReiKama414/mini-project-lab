import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt, uid } from '../../lib/utils'

const meta = getProject('passwordless-login')!

type Session = { email: string; at: number; method: 'otp' | 'magic' } | null
type Step = 'email' | 'sent' | 'session'

export default function Page() {
  const [email, setEmail] = useLocalStorage('lab:passwordless-login:email', '')
  const [session, setSession] = useLocalStorage<Session>('lab:passwordless-login', null)
  const [step, setStep] = useState<Step>(session ? 'session' : 'email')
  const [mode, setMode] = useState<'otp' | 'magic'>('otp')
  const [code, setCode] = useState('')
  const [expected, setExpected] = useState('')
  const [magicToken, setMagicToken] = useState('')
  const [err, setErr] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (session) setStep('session')
  }, [session])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  function send() {
    if (!/.+@.+\..+/.test(email.trim())) {
      setErr('請輸入有效 Email')
      return
    }
    if (cooldown > 0) return
    setErr('')
    setCooldown(45)
    setStep('sent')
    if (mode === 'otp') {
      const c = String(randomInt(100000, 999999))
      setExpected(c)
      setMagicToken('')
      setMsg(`已寄出 OTP（示範顯示：${c}）`)
    } else {
      const token = uid('magic')
      setMagicToken(token)
      setExpected('')
      setMsg(`已寄出魔法連結（示範 token：${token}）`)
    }
    setCode('')
  }

  function verifyOtp() {
    if (code.trim() === expected) {
      setSession({ email: email.trim(), at: Date.now(), method: 'otp' })
      setStep('session')
      setErr('')
      setMsg('')
    } else setErr('驗證碼錯誤')
  }

  function consumeMagic() {
    if (!magicToken) {
      setErr('尚無魔法連結')
      return
    }
    setSession({ email: email.trim(), at: Date.now(), method: 'magic' })
    setStep('session')
    setErr('')
    setMsg('')
  }

  function logout() {
    setSession(null)
    setStep('email')
    setMsg('')
    setExpected('')
    setMagicToken('')
  }

  if (step === 'session' && session) {
    return (
      <ProjectShell meta={meta}>
        <div className="panel stack" style={{ maxWidth: 440 }}>
          <h3 style={{ margin: 0 }}>已登入</h3>
          <p>
            歡迎，<strong>{session.email}</strong>
          </p>
          <span className="tag">{session.method === 'otp' ? 'OTP' : 'Magic Link'}</span>
          <span className="muted mono">{new Date(session.at).toLocaleString('zh-TW')}</span>
          <button type="button" className="btn danger" onClick={logout}>
            登出
          </button>
        </div>
      </ProjectShell>
    )
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 460 }}>
        <div className="row">
          <button type="button" className={`btn sm ${mode === 'otp' ? 'accent' : 'ghost'}`} onClick={() => setMode('otp')}>
            OTP
          </button>
          <button type="button" className={`btn sm ${mode === 'magic' ? 'accent' : 'ghost'}`} onClick={() => setMode('magic')}>
            Magic Link
          </button>
        </div>

        <label className="label">Email</label>
        <input
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={step === 'sent'}
        />

        {step === 'email' && (
          <button type="button" className="btn accent" onClick={send} disabled={cooldown > 0}>
            {cooldown > 0 ? `請等待 ${cooldown}s` : mode === 'otp' ? '寄送登入碼' : '寄送魔法連結'}
          </button>
        )}

        {step === 'sent' && mode === 'otp' && (
          <>
            <p className="muted">{msg}</p>
            <input className="field mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位數驗證碼" maxLength={6} />
            <div className="row">
              <button type="button" className="btn accent" onClick={verifyOtp}>
                驗證登入
              </button>
              <button type="button" className="btn ghost" onClick={send} disabled={cooldown > 0}>
                {cooldown > 0 ? `重送 ${cooldown}s` : '重送'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setStep('email')}>
                重填 Email
              </button>
            </div>
          </>
        )}

        {step === 'sent' && mode === 'magic' && (
          <>
            <p className="muted">{msg}</p>
            <div className="list-item mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              lab://auth/callback?token={magicToken}
            </div>
            <div className="row">
              <button type="button" className="btn accent" onClick={consumeMagic}>
                模擬點擊連結
              </button>
              <button type="button" className="btn ghost" onClick={send} disabled={cooldown > 0}>
                {cooldown > 0 ? `重送 ${cooldown}s` : '重送'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setStep('email')}>
                重填 Email
              </button>
            </div>
          </>
        )}

        {err && <p style={{ color: 'var(--rose)' }}>{err}</p>}
      </div>
    </ProjectShell>
  )
}
