import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta = getProject('random-number')!

const RANGE_MIN = -1_000_000_000
const RANGE_MAX = 1_000_000_000
const COUNT_MIN = 1
const COUNT_MAX = 200
const DEC_MIN = 0
const DEC_MAX = 8

type HistoryItem = {
  line: string
  min: number
  max: number
}

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

function normalizeHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryItem[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item) {
      out.push({ line: item, min: 1, max: 100 })
      continue
    }
    if (item && typeof item === 'object' && 'line' in item) {
      const row = item as HistoryItem
      const line = String(row.line)
      if (!line) continue
      out.push({
        line,
        min: Number.isFinite(row.min) ? row.min : 1,
        max: Number.isFinite(row.max) ? row.max : 100,
      })
    }
  }
  return out
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
  const [historyRaw, setHistoryRaw] = useLocalStorage<HistoryItem[] | string[]>(
    'lab:random-number:history',
    [],
  )
  const history = normalizeHistory(historyRaw)
  const [copied, setCopied] = useState(false)

  function setHistory(next: HistoryItem[] | ((prev: HistoryItem[]) => HistoryItem[])) {
    setHistoryRaw((prev) => {
      const current = normalizeHistory(prev)
      return typeof next === 'function' ? next(current) : next
    })
  }

  function generate() {
    const loRaw = Number.isFinite(min) ? min : NaN
    const hiRaw = Number.isFinite(max) ? max : NaN
    if (!Number.isFinite(loRaw) || !Number.isFinite(hiRaw)) {
      setError('請輸入有效數字')
      setResults([])
      return
    }
    const lo = Math.min(clamp(loRaw, RANGE_MIN, RANGE_MAX), clamp(hiRaw, RANGE_MIN, RANGE_MAX))
    const hi = Math.max(clamp(loRaw, RANGE_MIN, RANGE_MAX), clamp(hiRaw, RANGE_MIN, RANGE_MAX))
    const n = clamp(count, COUNT_MIN, COUNT_MAX)
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
        out = Array.from({ length: n }, () => cryptoFloat(lo, hi, clamp(decimals, DEC_MIN, DEC_MAX)))
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
      setHistory((h) => [{ line, min: lo, max: hi }, ...h.filter((x) => x.line !== line)].slice(0, 12))
    } catch {
      setError('產生失敗')
      setResults([])
    }
  }

  function setRange(raw: string, set: (n: number) => void) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setError('請輸入有效數字')
      return
    }
    setError('')
    set(clamp(n, RANGE_MIN, RANGE_MAX))
  }

  function applyRange(item: HistoryItem) {
    setMin(clamp(item.min, RANGE_MIN, RANGE_MAX))
    setMax(clamp(item.max, RANGE_MIN, RANGE_MAX))
    setError('')
  }

  async function copyResults() {
    if (!results.length) return
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const text = results.join(', ')

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="grid-3">
            <label className="stack">
              <span className="label">最小值</span>
              <input
                className={`field${error ? ' is-invalid' : ''}`}
                type="number"
                min={RANGE_MIN}
                max={RANGE_MAX}
                value={min}
                onChange={(e) => setRange(e.target.value, setMin)}
              />
            </label>
            <label className="stack">
              <span className="label">最大值</span>
              <input
                className={`field${error ? ' is-invalid' : ''}`}
                type="number"
                min={RANGE_MIN}
                max={RANGE_MAX}
                value={max}
                onChange={(e) => setRange(e.target.value, setMax)}
              />
            </label>
            <label className="stack">
              <span className="label">數量</span>
              <input
                className="field"
                type="number"
                min={COUNT_MIN}
                max={COUNT_MAX}
                value={count}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) {
                    setError('請輸入有效數字')
                    return
                  }
                  setError('')
                  setCount(clamp(n, COUNT_MIN, COUNT_MAX))
                }}
              />
              <p className="field-hint">{COUNT_MIN}–{COUNT_MAX}</p>
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
                  min={DEC_MIN}
                  max={DEC_MAX}
                  style={{ width: 72 }}
                  value={decimals}
                  onChange={(e) => {
                    const n = parseNumber(e.target.value)
                    if (!Number.isFinite(n)) return
                    setDecimals(clamp(n, DEC_MIN, DEC_MAX))
                  }}
                />
              </label>
            )}
          </div>
          <div className="row">
            <button className="btn accent" onClick={generate} disabled={error === '請輸入有效數字'}>
              產生
            </button>
            <button className="btn ghost" disabled={!results.length} onClick={() => void copyResults()}>
              {copied ? '已複製' : '複製'}
            </button>
            <button
              className="btn ghost"
              disabled={!results.length}
              onClick={() => downloadText('numbers.txt', results.join('\n'))}
            >
              下載 .txt
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
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
              <li key={`${h.line}-${i}`} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <code className="mono" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.line}
                  </code>
                  <span className="muted" style={{ fontSize: 11 }}>
                    範圍 {h.min}–{h.max}
                  </span>
                </div>
                <button className="btn ghost sm" onClick={() => applyRange(h)}>
                  套用範圍
                </button>
                <button className="btn ghost sm" onClick={() => void copyText(h.line)}>
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
