import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { randomInt } from '../../lib/utils'

const meta = getProject('passwordless-login')!

type Session = { email: string; at: number } | null

export default function Page() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [expected, setExpected] = useState('')
  const [session, setSession] = useLocalStorage<Session>('lab:passwordless-login', null)
  const [err, setErr] = useState('')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  function sendLink() {
    if (!/.+@.+\..+/.test(email)) {
      setErr('請輸入有效 Email')
      return
    }
    const c = String(randomInt(100000, 999999))
    setExpected(c)
    setSent(true)
    setErr('')
    setCountdown(60)
    setCode('')
  }

  function verify() {
    if (code === expected) {
      setSession({ email, at: Date.now() })
      setSent(false)
      setErr('')
    } else setErr('驗證碼錯誤（示範碼會顯示在下方）')
  }

  if (session) {
    return (
      <ProjectShell meta={meta}>
        <div className="panel stack" style={{ maxWidth: 420 }}>
          <h3 style={{ margin: 0 }}>已登入</h3>
          <p>
            歡迎，<strong>{session.email}</strong>
          </p>
          <span className="muted mono">{new Date(session.at).toLocaleString('zh-TW')}</span>
          <button type="button" className="btn danger" onClick={() => setSession(null)}>
            登出
          </button>
        </div>
      </ProjectShell>
    )
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420 }}>
        <label className="label">Email 魔法連結（示範）</label>
        <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={sent} />
        {!sent ? (
          <button type="button" className="btn accent" onClick={sendLink}>
            寄送登入碼
          </button>
        ) : (
          <>
            <p className="muted">已寄出 6 位數碼（示範直接顯示：{expected}）{countdown > 0 && ` · ${countdown}s`}</p>
            <input className="field mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="輸入驗證碼" maxLength={6} />
            <div className="row">
              <button type="button" className="btn accent" onClick={verify}>
                驗證登入
              </button>
              <button type="button" className="btn ghost" onClick={() => setSent(false)}>
                重填 Email
              </button>
            </div>
          </>
        )}
        {err && <p style={{ color: '#f87171' }}>{err}</p>}
      </div>
    </ProjectShell>
  )
}
