import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('nanoid-generator') ?? {
  slug: 'nanoid-generator',
  title: 'NanoID 產生器',
  description: '本機產生 URL 安全短 ID。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const SIZE_MIN = 4
const SIZE_MAX = 64
const COUNT_MIN = 1
const COUNT_MAX = 200

function nanoid(size: number) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < size; i++) id += ALPHA[bytes[i]! & 63]!
  return id
}

export default function Page() {
  const [size, setSize] = useLocalStorage('lab:nanoid-generator:size', 21)
  const [count, setCount] = useLocalStorage('lab:nanoid-generator:count', 5)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const s = clamp(size, SIZE_MIN, SIZE_MAX)
  const n = clamp(count, COUNT_MIN, COUNT_MAX)

  function generate() {
    setList(Array.from({ length: n }, () => nanoid(s)))
    setCopied(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          使用 Web Crypto 亂數與 URL 安全字元集（A–Z a–z 0–9 _-）。非官方 nanoid 套件，行為相近。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">
              長度（{SIZE_MIN}–{SIZE_MAX}）
            </span>
            <input
              className="field"
              type="number"
              min={SIZE_MIN}
              max={SIZE_MAX}
              value={s}
              onChange={(e) => setSize(clamp(parseNumber(e.target.value, 21), SIZE_MIN, SIZE_MAX))}
            />
          </label>
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
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={generate}>
            產生
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
            onClick={() => downloadText('nanoids.txt', list.join('\n'))}
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
