import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useState } from 'react'
import { copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('file-hash-checker') ?? {
  slug: 'file-hash-checker',
  title: '檔案雜湊核對',
  description: '計算檔案 SHA-256 並與預期值比對。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const FILE_MAX = 64 * 1024 * 1024

async function sha256(buf: ArrayBuffer) {
  const dig = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Page() {
  const [expect, setExpect] = useState('')
  const [hex, setHex] = useState('')
  const [info, setInfo] = useState('')
  const [match, setMatch] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.removeItem('lab:file-hash-checker:expect')
    } catch {
      /* ignore */
    }
  }, [])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      setHex('')
      setMatch(null)
      return
    }
    setBusy(true)
    setError('')
    setMatch(null)
    try {
      const h = await sha256(await file.arrayBuffer())
      setHex(h)
      setInfo(`${file.name} · ${formatBytes(file.size)}`)
      setCopied(false)
      if (isNonEmpty(expect)) setMatch(h.toLowerCase() === expect.trim().toLowerCase().replace(/\s/g, ''))
      else setMatch(null)
    } catch {
      setError('計算失敗')
      setHex('')
      setMatch(null)
    } finally {
      setBusy(false)
    }
  }

  function onExpectChange(v: string) {
    const next = limitText(v, 128)
    setExpect(next)
    if (hex && isNonEmpty(next)) {
      setMatch(hex.toLowerCase() === next.trim().toLowerCase().replace(/\s/g, ''))
    } else {
      setMatch(null)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          以 Web Crypto 本機計算 SHA-256，檔案不上傳。預期雜湊只留在記憶體。大檔案會顯示忙碌狀態。
        </p>
        <label className="stack">
          <span className="label">選擇檔案（上限 {formatBytes(FILE_MAX)}）</span>
          <input className="field" type="file" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="stack">
          <span className="label">預期 SHA-256（選填）</span>
          <input
            className="field mono"
            value={expect}
            maxLength={128}
            placeholder="64 位十六進位"
            autoComplete="off"
            onChange={(e) => onExpectChange(e.target.value)}
          />
        </label>
        {busy && <p className="field-hint">計算中，大檔案請稍候…</p>}
        {error && <p className="field-error">{error}</p>}
        {info && !busy && <p className="field-hint">{info}</p>}
        {hex && (
          <>
            <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
              {hex}
            </pre>
            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={async () => {
                  await copyText(hex)
                  setCopied(true)
                }}
              >
                {copied ? '已複製' : '複製雜湊'}
              </button>
              <button type="button" className="btn ghost" onClick={() => downloadText('sha256.txt', hex)}>
                下載
              </button>
            </div>
          </>
        )}
        {match === true && <p className="field-hint">與預期值相符</p>}
        {match === false && <p className="field-error">與預期值不符</p>}
      </div>
    </ProjectShell>
  )
}
