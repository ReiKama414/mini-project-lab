import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as OTPAuth from 'otpauth'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('totp-qr') ?? {
  slug: 'totp-qr',
  title: 'TOTP QR',
  description: '產生 otpauth URI 與 QR Code。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

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
  const [copied, setCopied] = useState(false)
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
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Secret 預設只留在記憶體。勾選「記住」才會寫入本機。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">Issuer</span>
            <input className="field" value={issuer} maxLength={40} onChange={(e) => setIssuer(limitText(e.target.value, 40))} />
          </label>
          <label className="stack">
            <span className="label">Label</span>
            <input className="field" value={label} maxLength={80} onChange={(e) => setLabel(limitText(e.target.value, 80))} />
          </label>
        </div>
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
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          記住 secret（寫入 localStorage）
        </label>
        {error && <p className="field-error">{error}</p>}
        {uri && (
          <>
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
            <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {uri}
            </pre>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn accent"
                onClick={async () => {
                  await copyText(uri)
                  setCopied(true)
                }}
              >
                {copied ? '已複製' : '複製 otpauth URI'}
              </button>
              <button type="button" className="btn teal" onClick={downloadPng}>
                下載 QR PNG
              </button>
              <button type="button" className="btn ghost" onClick={() => downloadText('totp-uri.txt', uri)}>
                下載 URI
              </button>
            </div>
          </>
        )}
      </div>
    </ProjectShell>
  )
}
