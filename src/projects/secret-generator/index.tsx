import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('secret-generator') ?? {
  slug: 'secret-generator',
  title: '密鑰／Secret 產生',
  description: '產生 hex／base64 隨機密鑰。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

export default function Page() {
  const [bytes, setBytes] = useLocalStorage('lab:secret-generator:bytes', 32)
  const [fmt, setFmt] = useLocalStorage<'hex' | 'base64'>('lab:secret-generator:fmt', 'hex')
  const [out, setOut] = useState('')
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(true)
  const n = clamp(bytes, 8, 64)

  function generate() {
    const arr = new Uint8Array(n)
    crypto.getRandomValues(arr)
    if (fmt === 'hex') setOut([...arr].map((b) => b.toString(16).padStart(2, '0')).join(''))
    else {
      let bin = ''
      arr.forEach((b) => {
        bin += String.fromCharCode(b)
      })
      setOut(btoa(bin))
    }
    setCopied(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          以 Web Crypto 亂數產生密鑰。輸出只留在記憶體，不寫入 localStorage。位元組數與格式設定可記住。
        </p>
        <label className="stack">
          <span className="label">
            位元組：{n}（{n * 8} bit）
          </span>
          <input
            className="field"
            type="range"
            min={8}
            max={64}
            value={n}
            onChange={(e) => setBytes(clamp(parseNumber(e.target.value, 32), 8, 64))}
          />
        </label>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <input type="radio" checked={fmt === 'hex'} onChange={() => setFmt('hex')} />
            Hex
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="radio" checked={fmt === 'base64'} onChange={() => setFmt('base64')} />
            Base64
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={generate}>
            產生
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!out}
            onClick={async () => {
              await copyText(out)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" disabled={!out} onClick={() => setShow((v) => !v)}>
            {show ? '隱藏' : '顯示'}
          </button>
        </div>
        {out && (
          <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {show ? out : '•'.repeat(Math.min(out.length, 64))}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
