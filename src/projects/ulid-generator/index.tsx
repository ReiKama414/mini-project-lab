import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('ulid-generator') ?? {
  slug: 'ulid-generator',
  title: 'ULID 產生器',
  description: '產生可排序的 ULID。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const COUNT_MIN = 1
const COUNT_MAX = 200

function encodeTime(ms: number) {
  let t = ms
  let out = ''
  for (let i = 0; i < 10; i++) {
    out = ENC[t % 32]! + out
    t = Math.floor(t / 32)
  }
  return out
}

function encodeRandom() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = ''
  let acc = 0
  let bits = 0
  for (const b of bytes) {
    acc = (acc << 8) | b
    bits += 8
    while (bits >= 5 && out.length < 16) {
      bits -= 5
      out += ENC[(acc >> bits) & 31]!
    }
  }
  while (out.length < 16) out += ENC[0]!
  return out.slice(0, 16)
}

function ulid(ms = Date.now()) {
  return encodeTime(ms) + encodeRandom()
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:ulid-generator:count', 5)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const n = clamp(count, COUNT_MIN, COUNT_MAX)

  function generate() {
    const base = Date.now()
    setList(Array.from({ length: n }, (_, i) => ulid(base + i)))
    setCopied(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          ULID = 時間戳（Crockford Base32）+ Web Crypto 亂數。同毫秒批次會遞增時間以利排序；非完整 monotonic ULID 規格實作。
        </p>
        <label className="stack">
          <span className="label">
            數量（{COUNT_MIN}–{COUNT_MAX}）
          </span>
          <input
            className="field"
            type="number"
            min={COUNT_MIN}
            max={COUNT_MAX}
            value={n}
            onChange={(e) => setCount(clamp(parseNumber(e.target.value, 5), COUNT_MIN, COUNT_MAX))}
          />
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={generate}>
            產生 ULID
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!list.length}
            onClick={async () => {
              await copyText(list.join('\n'))
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製全部'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!list.length}
            onClick={() => downloadText('ulids.txt', list.join('\n'))}
          >
            下載
          </button>
        </div>
        <ul className="list">
          {list.map((id) => (
            <li key={id} className="list-item">
              <code className="mono" style={{ flex: 1 }}>
                {id}
              </code>
              <button type="button" className="btn sm ghost" onClick={() => void copyText(id)}>
                複製
              </button>
            </li>
          ))}
          {!list.length && <p className="muted">尚未產生</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
