import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, randomInt, uid } from '../../lib/utils'

const meta = getProject('passwordless-login')!

type Session = { email: string; at: number; method: 'otp' | 'magic' } | null
type Step = 'email' | 'sent' | 'session'
type LogItem = {
  id: string
  at: number
  email: string
  method: 'otp' | 'magic'
  action: 'send' | 'login' | 'logout' | 'fail'
  detail: string
}

const EMAIL_PRESETS = ['demo@lab.local', 'you@example.com', 'dev@northstar.tw']

export default function Page() {
  const [email, setEmail] = useLocalStorage('lab:passwordless-login:email', '')
  const [session, setSession] = useLocalStorage<Session>('lab:passwordless-login', null)
  const [logs, setLogs] = useLocalStorage<LogItem[]>('lab:passwordless-login:logs', [])
  const [step, setStep] = useState<Step>(session ? 'session' : 'email')
  const [mode, setMode] = useLocalStorage<'otp' | 'magic'>('lab:passwordless-login:mode', 'otp')
  const [code, setCode] = useState('')
  const [expected, setExpected] = useState('')
  const [magicToken, setMagicToken] = useState('')
  const [err, setErr] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [msg, setMsg] = useState('')
  const [logFilter, setLogFilter] = useState<'全部' | 'login' | 'send' | 'fail'>('全部')

  useEffect(() => {
    if (session) setStep('session')
  }, [session])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const filteredLogs = useMemo(() => {
    if (logFilter === '全部') return logs
    return logs.filter((l) => l.action === logFilter)
  }, [logs, logFilter])

  const stats = useMemo(() => {
    const logins = logs.filter((l) => l.action === 'login').length
    const fails = logs.filter((l) => l.action === 'fail').length
    const sends = logs.filter((l) => l.action === 'send').length
    const otp = logs.filter((l) => l.method === 'otp' && l.action === 'login').length
    const magic = logs.filter((l) => l.method === 'magic' && l.action === 'login').length
    return { logins, fails, sends, otp, magic }
  }, [logs])

  function pushLog(partial: Omit<LogItem, 'id' | 'at'>) {
    setLogs((xs) => [{ id: uid('auth'), at: Date.now(), ...partial }, ...xs].slice(0, 40))
  }

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
      pushLog({ email: email.trim(), method: 'otp', action: 'send', detail: `OTP ${c}` })
    } else {
      const token = uid('magic')
      setMagicToken(token)
      setExpected('')
      setMsg(`已寄出魔法連結（示範 token：${token}）`)
      pushLog({ email: email.trim(), method: 'magic', action: 'send', detail: token })
    }
    setCode('')
  }

  function verifyOtp() {
    if (code.trim() === expected) {
      setSession({ email: email.trim(), at: Date.now(), method: 'otp' })
      setStep('session')
      setErr('')
      setMsg('')
      pushLog({ email: email.trim(), method: 'otp', action: 'login', detail: 'OTP 驗證成功' })
    } else {
      setErr('驗證碼錯誤')
      pushLog({ email: email.trim(), method: 'otp', action: 'fail', detail: 'OTP 錯誤' })
    }
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
    pushLog({ email: email.trim(), method: 'magic', action: 'login', detail: magicToken })
  }

  function logout() {
    if (session) {
      pushLog({
        email: session.email,
        method: session.method,
        action: 'logout',
        detail: '使用者登出',
      })
    }
    setSession(null)
    setStep('email')
    setMsg('')
    setExpected('')
    setMagicToken('')
    setCode('')
    setErr('')
  }

  function exportLogs() {
    const lines = [
      '時間,Email,方式,動作,詳情',
      ...logs.map((l) =>
        [new Date(l.at).toISOString(), l.email, l.method, l.action, `"${l.detail.replace(/"/g, '""')}"`].join(','),
      ),
    ]
    downloadText('auth-logs.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  const logPanel = (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>驗證紀錄</h3>
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!logs.length} onClick={exportLogs}>
            匯出 CSV
          </button>
          <button type="button" className="btn sm ghost" disabled={!logs.length} onClick={() => setLogs([])}>
            清空
          </button>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(['全部', 'login', 'send', 'fail'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn sm ${logFilter === f ? 'accent' : 'ghost'}`}
            onClick={() => setLogFilter(f)}
          >
            {f === '全部' ? '全部' : f === 'login' ? '登入' : f === 'send' ? '寄送' : '失敗'}
          </button>
        ))}
      </div>
      <ul className="list">
        {filteredLogs.slice(0, 12).map((l) => (
          <li key={l.id} className="list-item stack">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="tag">{l.action}</span>
              <span className="tag">{l.method}</span>
              <strong style={{ fontSize: 13 }}>{l.email}</strong>
            </div>
            <span className="muted mono" style={{ fontSize: 11 }}>
              {new Date(l.at).toLocaleString('zh-TW')} · {l.detail}
            </span>
          </li>
        ))}
        {!filteredLogs.length && <p className="muted">尚無紀錄</p>}
      </ul>
    </div>
  )

  const statsRow = (
    <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
      <span className="metric">登入 {stats.logins}</span>
      <span className="tag">寄送 {stats.sends}</span>
      <span className="tag">失敗 {stats.fails}</span>
      <span className="tag">OTP {stats.otp}</span>
      <span className="tag">Magic {stats.magic}</span>
    </div>
  )

  if (step === 'session' && session) {
    return (
      <ProjectShell
        meta={meta}
        actions={
          <button type="button" className="btn sm danger" onClick={logout}>
            登出
          </button>
        }
      >
        {statsRow}
        <div className="grid-2">
          <div className="panel stack">
            <h3 style={{ margin: 0 }}>已登入工作階段</h3>
            <div className="list-item stack">
              <div className="muted">Email</div>
              <strong>{session.email}</strong>
            </div>
            <div className="row">
              <span className="tag">{session.method === 'otp' ? 'OTP 登入' : 'Magic Link 登入'}</span>
              <span className="muted mono">{new Date(session.at).toLocaleString('zh-TW')}</span>
            </div>
            <p className="muted">Session 已寫入 localStorage，重新整理後仍會保持登入。</p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => void copyText(session.email)}>
                複製 Email
              </button>
              <button type="button" className="btn danger" onClick={logout}>
                登出
              </button>
            </div>
          </div>
          {logPanel}
        </div>
      </ProjectShell>
    )
  }

  return (
    <ProjectShell meta={meta}>
      {statsRow}
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <button
              type="button"
              className={`btn sm ${mode === 'otp' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('otp')}
            >
              OTP
            </button>
            <button
              type="button"
              className={`btn sm ${mode === 'magic' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('magic')}
            >
              Magic Link
            </button>
          </div>

          <div>
            <div className="label">Email 預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {EMAIL_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="btn sm ghost"
                  disabled={step === 'sent'}
                  onClick={() => setEmail(e)}
                >
                  {e}
                </button>
              ))}
            </div>
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
              <input
                className="field mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 位數驗證碼"
                maxLength={6}
              />
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn accent" onClick={verifyOtp}>
                  驗證登入
                </button>
                <button type="button" className="btn ghost" onClick={send} disabled={cooldown > 0}>
                  {cooldown > 0 ? `重送 ${cooldown}s` : '重送'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setStep('email')}>
                  重填 Email
                </button>
                {expected && (
                  <button type="button" className="btn ghost sm" onClick={() => void copyText(expected)}>
                    複製示範碼
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'sent' && mode === 'magic' && (
            <>
              <p className="muted">{msg}</p>
              <div className="list-item mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                lab://auth/callback?token={magicToken}
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn accent" onClick={consumeMagic}>
                  模擬點擊連結
                </button>
                <button type="button" className="btn ghost" onClick={send} disabled={cooldown > 0}>
                  {cooldown > 0 ? `重送 ${cooldown}s` : '重送'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setStep('email')}>
                  重填 Email
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void copyText(`lab://auth/callback?token=${magicToken}`)}
                >
                  複製連結
                </button>
              </div>
            </>
          )}

          {err && <p style={{ color: 'var(--rose)' }}>{err}</p>}
          {cooldown > 0 && step === 'email' && <p className="muted">重送冷卻中：{cooldown}s</p>}
          <p className="muted" style={{ fontSize: 12 }}>
            純前端示範：OTP／Magic Link 僅模擬流程，不會真的寄信。
          </p>
        </div>
        {logPanel}
      </div>
    </ProjectShell>
  )
}
