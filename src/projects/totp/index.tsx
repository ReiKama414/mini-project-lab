import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useState } from 'react'
import * as OTPAuth from 'otpauth'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('totp') ?? {
  slug: 'totp',
  title: 'TOTP 驗證碼',
  description: '本機產生／驗證 TOTP 代碼。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

function randomSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32
}

export default function Page() {
  const [remember, setRemember] = useLocalStorage('lab:totp:remember', false)
  const [storedSecret, setStoredSecret] = useLocalStorage('lab:totp:secret', '')
  const [storedLabel, setStoredLabel] = useLocalStorage('lab:totp:label', 'Demo:user@example.com')
  const [secret, setSecret] = useState(() => (remember && storedSecret ? storedSecret : randomSecret()))
  const [label, setLabel] = useState(() => storedLabel || 'Demo:user@example.com')
  const [code, setCode] = useState('')
  const [remain, setRemain] = useState(30)
  const [check, setCheck] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (remember) {
      setStoredSecret(secret)
      setStoredLabel(label)
    } else {
      try {
        localStorage.removeItem('lab:totp:secret')
      } catch {
        /* ignore */
      }
      setStoredSecret('')
    }
  }, [remember, secret, label, setStoredSecret, setStoredLabel])

  useEffect(() => {
    function tick() {
      try {
        if (!isNonEmpty(secret)) {
          setError('請輸入 Base32 secret')
          setCode('')
          return
        }
        const totp = new OTPAuth.TOTP({
          issuer: 'MiniLab',
          label,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase()),
        })
        setCode(totp.generate())
        setRemain(totp.period - (Math.floor(Date.now() / 1000) % totp.period))
        setError('')
      } catch {
        setError('Secret 無效（需 Base32）')
        setCode('')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [secret, label])

  function verify() {
    try {
      const totp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase()),
      })
      setOk((totp.validate({ token: check.trim(), window: 1 }) ?? null) !== null)
    } catch {
      setOk(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Secret 預設只留在記憶體。勾選「記住」才會寫入本機（請勿在公用電腦使用）。
        </p>
        <label className="stack">
          <span className="label">Label</span>
          <input className="field" value={label} maxLength={80} onChange={(e) => setLabel(limitText(e.target.value, 80))} />
        </label>
        <label className="stack">
          <span className="label">Base32 Secret</span>
          <div className="row" style={{ gap: 8 }}>
            <input
              className={`field mono${error ? ' is-invalid' : ''}`}
              value={secret}
              maxLength={128}
              onChange={(e) => setSecret(limitText(e.target.value, 128))}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn sm ghost" onClick={() => setSecret(randomSecret())}>
              產生
            </button>
          </div>
          <div className="field-meta">
            <span>{charCount(secret)} / 128</span>
          </div>
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          記住 secret（寫入 localStorage）
        </label>
        {error && <p className="field-error">{error}</p>}
        {code && (
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="metric mono" style={{ fontSize: 36, letterSpacing: 4 }}>
              {code}
            </span>
            <span className="tag">{remain}s</span>
            <button
              type="button"
              className="btn sm ghost"
              onClick={async () => {
                await copyText(code)
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>
        )}
        <label className="stack">
          <span className="label">驗證代碼</span>
          <input className="field mono" value={check} maxLength={8} onChange={(e) => setCheck(limitText(e.target.value, 8))} />
        </label>
        <button type="button" className="btn teal" onClick={verify} disabled={!isNonEmpty(check)}>
          驗證
        </button>
        {ok === true && <p className="field-hint">驗證通過</p>}
        {ok === false && <p className="field-error">驗證失敗</p>}
      </div>
    </ProjectShell>
  )
}
