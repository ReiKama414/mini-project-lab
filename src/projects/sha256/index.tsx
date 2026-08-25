import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useState } from 'react'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('sha256') ?? {
  slug: 'sha256',
  title: 'SHA-256',
  description: '文字或檔案 SHA-256 雜湊。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 32 * 1024 * 1024

async function sha256Bytes(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Page() {
  const [input, setInput] = useState('hello')
  const [hex, setHex] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.removeItem('lab:sha256:input')
    } catch {
      /* ignore */
    }
  }, [])

  async function hashText() {
    if (!isNonEmpty(input)) {
      setError('請輸入文字')
      return
    }
    setBusy(true)
    setError('')
    try {
      setHex(await sha256Bytes(new TextEncoder().encode(input)))
      setInfo(`文字 · ${charCount(input)} 字元`)
      setCopied(false)
    } catch {
      setError('計算失敗')
      setHex('')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    try {
      setHex(await sha256Bytes(await file.arrayBuffer()))
      setInfo(`${file.name} · ${formatBytes(file.size)}`)
      setCopied(false)
    } catch {
      setError('讀取或計算失敗')
      setHex('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          以 Web Crypto 本機計算 SHA-256。文字輸入不寫入 localStorage；大檔案會顯示忙碌狀態。
        </p>
        <label className="stack">
          <span className="label">文字</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={5}
            value={input}
            maxLength={MAX}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <div className="row">
          <button type="button" className="btn accent" disabled={busy || !isNonEmpty(input)} onClick={() => void hashText()}>
            {busy ? '計算中…' : '計算文字'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!hex}
            onClick={async () => {
              await copyText(hex)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" disabled={!hex} onClick={() => downloadText('sha256.txt', hex)}>
            下載
          </button>
        </div>
        <label className="stack">
          <span className="label">或選擇檔案（上限 {formatBytes(FILE_MAX)}）</span>
          <input className="field" type="file" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </label>
        {busy && <p className="field-hint">計算中，大檔案請稍候…</p>}
        {error && <p className="field-error">{error}</p>}
        {info && !busy && <p className="field-hint">{info}</p>}
        {hex && (
          <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {hex}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
