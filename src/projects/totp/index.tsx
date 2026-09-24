import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useState } from 'react'
import * as OTPAuth from 'otpauth'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'totp',
  title: 'TOTP 驗證碼',
  description: '本機產生／驗證 TOTP 代碼（SHA1／30 秒）',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['security'],
}
const meta = getProject('totp') ?? fallback

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
  const [copied, setCopied] = useState<string | null>(null)

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

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

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
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!code}
            onClick={() => void copyVal(code, 'code')}
            icon="copy"
          >
            {copied === 'code' ? '已複製' : '複製代碼'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!secret}
            onClick={() => void copyVal(secret.replace(/\s/g, '').toUpperCase(), 'secret')}
            icon="copy"
          >
            {copied === 'secret' ? '已複製' : '複製 Secret'}
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">SHA1 · 6 位 · 30s</span>
              {code && <span className="tag">{remain}s</span>}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              記住 secret（寫入 localStorage）
            </label>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">設定</h3>
              <ActionButton
                className="btn sm ghost"
                icon="none"
                onClick={() => {
                  setSecret(randomSecret())
                  setOk(null)
                }}
              >
                新 Secret
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="stack" style={{ gap: 12 }}>
              <label className="stack">
                <span className="label">Label</span>
                <input
                  className="field"
                  value={label}
                  maxLength={80}
                  onChange={(e) => setLabel(limitText(e.target.value, 80))}
                />
              </label>
              <label className="stack">
                <span className="label">Base32 Secret</span>
                <input
                  className={`field mono${error ? ' is-invalid' : ''}`}
                  value={secret}
                  maxLength={128}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setSecret(limitText(e.target.value, 128))}
                />
                <div className="field-meta">
                  <span>預設不寫入本機</span>
                  <span>{charCount(secret)} / 128</span>
                </div>
              </label>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">驗證碼</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!code}
                icon="copy"
                iconOnly
                tooltip={copied === 'code' ? '已複製' : '複製'}
                onClick={() => void copyVal(code, 'code')}
              />
            </div>
            {code ? (
              <div className="stack" style={{ gap: 16 }}>
                <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
                  <span className="metric mono" style={{ fontSize: 36, letterSpacing: 4, margin: 0 }}>
                    {code}
                  </span>
                  <span className="tag">{remain}s</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${(remain / 30) * 100}%`, background: 'var(--accent, #2a9d8f)' }} />
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <span className="label">驗證代碼</span>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      className="field mono"
                      value={check}
                      maxLength={8}
                      placeholder="6 位數字"
                      onChange={(e) => {
                        setCheck(limitText(e.target.value, 8))
                        setOk(null)
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn teal"
                      onClick={verify}
                      disabled={!isNonEmpty(check)}
                    >
                      驗證
                    </button>
                  </div>
                  {ok === true && <p className="field-hint">驗證通過（±1 視窗）</p>}
                  {ok === false && <p className="field-error">驗證失敗</p>}
                </div>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                有效 Secret 會即時顯示 TOTP
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">規格</span>
              <strong>RFC 6238 TOTP：SHA1、6 碼、30 秒週期（otpauth）</strong>
            </li>
            <li>
              <span className="muted">驗證</span>
              <strong>允許 ±1 時間視窗，以容忍輕微時鐘偏差</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>Secret 預設只在記憶體；勾選「記住」才寫入本機</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>TOTP QR（產生 otpauth URI／QR）</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
