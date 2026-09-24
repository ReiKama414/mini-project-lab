import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as OTPAuth from 'otpauth'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'totp-qr',
  title: 'TOTP QR',
  description: '產生 otpauth URI 與設定用 QR Code',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['security'],
}
const meta = getProject('totp-qr') ?? fallback

const PRESETS = [
  { label: 'App 示範', issuer: 'MiniLab', account: 'user@example.com' },
  { label: 'GitHub 風格', issuer: 'GitHub', account: 'octocat' },
  { label: '公司 SSO', issuer: 'Acme Corp', account: 'ada@acme.example' },
]

function randomSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32
}

export default function Page() {
  const [remember, setRemember] = useLocalStorage('lab:totp-qr:remember', false)
  const [storedIssuer, setStoredIssuer] = useLocalStorage('lab:totp-qr:issuer', 'MiniLab')
  const [storedLabel, setStoredLabel] = useLocalStorage('lab:totp-qr:label', 'user@example.com')
  const [storedSecret, setStoredSecret] = useLocalStorage('lab:totp-qr:secret', '')
  const [issuer, setIssuer] = useState(() => storedIssuer || 'MiniLab')
  const [label, setLabel] = useState(() => storedLabel || 'user@example.com')
  const [secret, setSecret] = useState(() => (remember && storedSecret ? storedSecret : randomSecret()))
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const qrWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (remember) {
      setStoredIssuer(issuer)
      setStoredLabel(label)
      setStoredSecret(secret)
    } else {
      try {
        localStorage.removeItem('lab:totp-qr:secret')
      } catch {
        /* ignore */
      }
      setStoredSecret('')
    }
  }, [remember, issuer, label, secret, setStoredIssuer, setStoredLabel, setStoredSecret])

  const { uri, error } = useMemo(() => {
    try {
      if (!isNonEmpty(secret) || !isNonEmpty(label)) {
        return { uri: '', error: '請填寫 label 與 secret' }
      }
      const totp = new OTPAuth.TOTP({
        issuer,
        label,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase()),
      })
      return { uri: totp.toString(), error: '' }
    } catch {
      return { uri: '', error: 'Secret 無效' }
    }
  }, [issuer, label, secret])

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function downloadPng() {
    const svg = qrWrapRef.current?.querySelector('svg')
    if (!svg || !uri) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 400, 400)
      ctx.drawImage(img, 0, 0, 400, 400)
      canvas.toBlob((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = 'totp-qr.png'
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!uri}
            onClick={() => void copyVal(uri, 'uri')}
            icon="copy"
          >
            {copied === 'uri' ? '已複製' : '複製 URI'}
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!uri} onClick={downloadPng} icon="download">
            下載 QR
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">otpauth://totp</span>
              {uri && <span className="tag">就緒</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setIssuer(p.issuer)
                    setLabel(p.account)
                    setHint(`已套用「${p.label}」`)
                  }}
                >
                  {p.label}
                </button>
              ))}
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
              <h3 className="pw-panel-title">帳號設定</h3>
              <ActionButton
                className="btn sm ghost"
                icon="none"
                onClick={() => {
                  setSecret(randomSecret())
                  setHint('已產生新 Secret')
                }}
              >
                新 Secret
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            {hint && !error && <p className="field-hint">{hint}</p>}
            <div className="stack" style={{ gap: 12 }}>
              <div className="grid-2">
                <label className="stack">
                  <span className="label">Issuer</span>
                  <input
                    className="field"
                    value={issuer}
                    maxLength={40}
                    onChange={(e) => setIssuer(limitText(e.target.value, 40))}
                  />
                </label>
                <label className="stack">
                  <span className="label">Label</span>
                  <input
                    className="field"
                    value={label}
                    maxLength={80}
                    onChange={(e) => setLabel(limitText(e.target.value, 80))}
                  />
                </label>
              </div>
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
              </label>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">QR／URI</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!uri}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'uri' ? '已複製' : '複製 URI'}
                  onClick={() => void copyVal(uri, 'uri')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!uri}
                  icon="download"
                  iconOnly
                  tooltip="下載 URI"
                  onClick={() => downloadText('totp-uri.txt', uri)}
                />
              </div>
            </div>
            {uri ? (
              <div className="stack" style={{ gap: 12 }}>
                <div
                  ref={qrWrapRef}
                  style={{
                    padding: 16,
                    background: '#fff',
                    borderRadius: 12,
                    display: 'inline-block',
                    border: '1px solid var(--border)',
                  }}
                >
                  <QRCodeSVG value={uri} size={200} />
                </div>
                <pre className="xc-pre mono" style={{ wordBreak: 'break-all', fontSize: 12 }}>
                  {uri}
                </pre>
                <ActionButton className="btn sm teal" onClick={downloadPng} icon="download">
                  下載 QR PNG
                </ActionButton>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                填寫後會產生 QR 與 otpauth URI
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">URI</span>
              <strong>標準 otpauth://totp/…，可用 Authenticator 掃描</strong>
            </li>
            <li>
              <span className="muted">參數</span>
              <strong>SHA1、6 碼、30 秒（與 TOTP 工具一致）</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>Secret 預設只在記憶體；公用電腦請勿勾選記住</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>TOTP Generator（即時驗證碼）</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
