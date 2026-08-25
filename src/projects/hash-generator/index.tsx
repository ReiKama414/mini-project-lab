import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('hash-generator') ?? {
  slug: 'hash-generator',
  title: '雜湊產生器',
  description: '以 Web Crypto 計算 SHA 雜湊。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

async function digest(algo: Algo, text: string) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Page() {
  const [input, setInput] = useState('hello')
  const [algo, setAlgo] = useLocalStorage<Algo>('lab:hash-generator:algo', 'SHA-256')
  const [hex, setHex] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.removeItem('lab:hash-generator:input')
    } catch {
      /* ignore */
    }
  }, [])

  async function run() {
    if (!isNonEmpty(input)) {
      setError('請輸入文字')
      return
    }
    setBusy(true)
    setError('')
    try {
      setHex(await digest(algo, input))
      setCopied(false)
    } catch {
      setError('計算失敗（瀏覽器可能不支援此演算法）')
      setHex('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          以瀏覽器 Web Crypto 本機計算。輸入內容不寫入 localStorage。SHA-1 僅供相容舊系統，不建議用於安全性用途。
        </p>
        <label className="stack">
          <span className="label">輸入文字</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={6}
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
        <label className="stack">
          <span className="label">演算法</span>
          <select className="field" value={algo} onChange={(e) => setAlgo(e.target.value as Algo)}>
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-384">SHA-384</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={() => void run()} disabled={!isNonEmpty(input) || busy}>
            {busy ? '計算中…' : '計算'}
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
          <button type="button" className="btn ghost" disabled={!hex} onClick={() => downloadText('hash.txt', hex)}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {hex && (
          <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {hex}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
