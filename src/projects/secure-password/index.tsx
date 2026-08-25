import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('secure-password') ?? {
  slug: 'secure-password',
  title: '安全密碼產生',
  description: 'Web Crypto 產生高熵密碼。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGIT = '0123456789'
const SYMBOL = '!@#$%^&*-_=+'
const POOL = LOWER + UPPER + DIGIT + SYMBOL

function make(len: number) {
  const out: string[] = []
  const bytes = new Uint32Array(len)
  crypto.getRandomValues(bytes)
  // Guarantee at least one of each class when length allows
  const required = [LOWER, UPPER, DIGIT, SYMBOL]
  for (let i = 0; i < Math.min(required.length, len); i++) {
    const set = required[i]!
    out.push(set[bytes[i]! % set.length]!)
  }
  for (let i = out.length; i < len; i++) out.push(POOL[bytes[i]! % POOL.length]!)
  // Fisher–Yates with crypto
  const mix = new Uint32Array(out.length)
  crypto.getRandomValues(mix)
  for (let i = out.length - 1; i > 0; i--) {
    const j = mix[i]! % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out.join('')
}

export default function Page() {
  const [len, setLen] = useLocalStorage('lab:secure-password:len', 24)
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const n = clamp(len, 12, 64)

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          使用 crypto.getRandomValues。密碼只留在記憶體，不寫入 localStorage。長度設定可記住。
        </p>
        <label className="stack">
          <span className="label">長度：{n}（12–64）</span>
          <input
            className="field"
            type="range"
            min={12}
            max={64}
            value={n}
            onChange={(e) => setLen(clamp(parseNumber(e.target.value, 24), 12, 64))}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              setPwd(make(n))
              setCopied(false)
            }}
          >
            產生
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!pwd}
            onClick={async () => {
              await copyText(pwd)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" disabled={!pwd} onClick={() => setShow((v) => !v)}>
            {show ? '隱藏' : '顯示'}
          </button>
        </div>
        {pwd && (
          <div className="metric mono" style={{ wordBreak: 'break-all' }}>
            {show ? pwd : '•'.repeat(Math.min(pwd.length, 48))}
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
