import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('password-generator')!

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*-_=+?~',
}

const AMBIGUOUS = /[0OIl1]/g

function securePick(pool: string) {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return pool[arr[0]! % pool.length]!
}

function strengthScore(pwd: string) {
  let score = 0
  if (pwd.length >= 12) score += 1
  if (pwd.length >= 16) score += 1
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1
  return score
}

const STRENGTH = ['很弱', '弱', '普通', '強', '很強', '極強']

export default function Page() {
  const [length, setLength] = useState(20)
  const [opts, setOpts] = useState({ lower: true, upper: true, digits: true, symbols: true })
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true)
  const [pwd, setPwd] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useLocalStorage<string[]>('lab:password-generator:history', [])

  const score = useMemo(() => strengthScore(pwd), [pwd])

  function generate() {
    const required: string[] = []
    let pool = ''
    ;(
      [
        ['lower', SETS.lower],
        ['upper', SETS.upper],
        ['digits', SETS.digits],
        ['symbols', SETS.symbols],
      ] as const
    ).forEach(([k, set]) => {
      if (!opts[k]) return
      let s = set
      if (excludeAmbiguous) s = s.replace(AMBIGUOUS, '')
      pool += s
      required.push(securePick(s))
    })
    if (!pool) return
    const out = [...required]
    while (out.length < length) out.push(securePick(pool))
    // shuffle
    for (let i = out.length - 1; i > 0; i--) {
      const arr = new Uint32Array(1)
      crypto.getRandomValues(arr)
      const j = arr[0]! % (i + 1)
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    const result = out.join('')
    setPwd(result)
    setCopied(false)
    setHistory([result, ...history.filter((h) => h !== result)].slice(0, 8))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">長度：{length}</span>
            <input
              className="field"
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>
          <div className="row">
            {(
              [
                ['lower', '小寫'],
                ['upper', '大寫'],
                ['digits', '數字'],
                ['symbols', '符號'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={opts[k]}
                  onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={() => setExcludeAmbiguous(!excludeAmbiguous)}
            />
            排除易混淆字元（0 O I l 1）
          </label>
          <div className="row">
            <button className="btn accent" onClick={generate}>
              產生密碼
            </button>
            <button
              className="btn ghost"
              disabled={!pwd}
              onClick={async () => {
                await copyText(pwd)
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          {pwd && (
            <>
              <div className="metric mono" style={{ wordBreak: 'break-all', fontSize: 18 }}>
                {pwd}
              </div>
              <div className="progress">
                <span style={{ width: `${(score / 5) * 100}%` }} />
              </div>
              <p className="muted">強度：{STRENGTH[score]} · 使用 Web Crypto 亂數</p>
            </>
          )}
        </div>
        <div className="panel stack">
          <h3>最近產生</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            僅存在本機，請勿用於真實重要帳號後長期留存。
          </p>
          <ul className="list">
            {history.map((h) => (
              <li key={h} className="list-item">
                <code className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {h}
                </code>
                <button className="btn ghost sm" onClick={() => void copyText(h)}>
                  複製
                </button>
              </li>
            ))}
            {!history.length && <p className="muted">尚無紀錄</p>}
          </ul>
          {!!history.length && (
            <button className="btn ghost sm" onClick={() => setHistory([])}>
              清空歷史
            </button>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
