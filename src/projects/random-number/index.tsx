import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText } from '../../lib/utils'

const meta = getProject('random-number')!

function cryptoInt(min: number, max: number) {
  const lo = Math.ceil(min)
  const hi = Math.floor(max)
  const range = hi - lo + 1
  if (range <= 0) return lo
  const arr = new Uint32Array(1)
  const limit = Math.floor(0xffffffff / range) * range
  let x = 0
  do {
    crypto.getRandomValues(arr)
    x = arr[0]!
  } while (x >= limit)
  return lo + (x % range)
}

function cryptoFloat(min: number, max: number, decimals: number) {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  const t = arr[0]! / 0xffffffff
  const v = min + t * (max - min)
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

export default function Page() {
  const [min, setMin] = useLocalStorage('lab:random-number:min', 1)
  const [max, setMax] = useLocalStorage('lab:random-number:max', 100)
  const [count, setCount] = useLocalStorage('lab:random-number:count', 5)
  const [unique, setUnique] = useLocalStorage('lab:random-number:unique', false)
  const [asFloat, setAsFloat] = useLocalStorage('lab:random-number:float', false)
  const [decimals, setDecimals] = useLocalStorage('lab:random-number:decimals', 2)
  const [results, setResults] = useState<(number | string)[]>([])
  const [error, setError] = useState('')
  const [history, setHistory] = useLocalStorage<string[]>('lab:random-number:history', [])
  const [copied, setCopied] = useState(false)

  function generate() {
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    const n = clamp(count, 1, 200)
    setError('')
    setCopied(false)

    try {
      let out: number[]
      if (asFloat) {
        if (unique) {
          setError('浮點數模式不支援「不重複」')
          setResults([])
          return
        }
        out = Array.from({ length: n }, () => cryptoFloat(lo, hi, clamp(decimals, 0, 8)))
      } else {
        const ilo = Math.ceil(lo)
        const ihi = Math.floor(hi)
        if (unique) {
          const span = ihi - ilo + 1
          if (n > span) {
            setError(`不重複時數量不可超過範圍大小（${span}）`)
            setResults([])
            return
          }
          const pool = Array.from({ length: span }, (_, i) => ilo + i)
          for (let i = pool.length - 1; i > 0; i--) {
            const j = cryptoInt(0, i)
            ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
          }
          out = pool.slice(0, n)
        } else {
          out = Array.from({ length: n }, () => cryptoInt(ilo, ihi))
        }
      }
      setResults(out)
      const line = out.join(', ')
      setHistory([line, ...history.filter((h) => h !== line)].slice(0, 12))
    } catch {
      setError('產生失敗')
      setResults([])
    }
  }

  const text = results.join(', ')

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="grid-3">
            <label className="stack">
              <span className="label">最小值</span>
              <input className="field" type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
            </label>
            <label className="stack">
              <span className="label">最大值</span>
              <input className="field" type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </label>
            <label className="stack">
              <span className="label">數量</span>
              <input
                className="field"
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} disabled={asFloat} />
              不重複
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={asFloat} onChange={(e) => setAsFloat(e.target.checked)} />
              浮點數
            </label>
            {asFloat && (
              <label className="row" style={{ gap: 6 }}>
                小數位
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={8}
                  style={{ width: 72 }}
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                />
              </label>
            )}
          </div>
          <div className="row">
            <button className="btn accent" onClick={generate}>
              產生
            </button>
            <button
              className="btn ghost"
              disabled={!results.length}
              onClick={async () => {
                await copyText(text)
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          {error && (
            <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
              {error}
            </p>
          )}
          {results.length > 0 && (
            <div className="metric mono" style={{ fontSize: 22, wordBreak: 'break-all' }}>
              {text}
            </div>
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            使用 Web Crypto <code>getRandomValues</code> 產生亂數。
          </p>
        </div>
        <div className="panel stack">
          <h3>歷史紀錄</h3>
          <ul className="list">
            {history.map((h, i) => (
              <li key={`${h}-${i}`} className="list-item">
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
