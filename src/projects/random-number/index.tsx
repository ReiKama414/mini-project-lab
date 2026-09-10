import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('random-number')!

const RANGE_MIN = -1_000_000_000
const RANGE_MAX = 1_000_000_000
const COUNT_MIN = 1
const COUNT_MAX = 500
const DEC_MIN = 0
const DEC_MAX = 8
const HISTORY_CAP = 24
const SHUFFLE_SPAN_MAX = 100_000
const COUNT_PRESETS = [1, 5, 10, 20, 50, 100]

type OutFmt = 'nl' | 'comma' | 'json' | 'csv'
type HistoryItem = {
  id: string
  at: number
  values: number[]
  min: number
  max: number
  asFloat: boolean
  decimals: number
  unique: boolean
}

const RANGE_PRESETS: { label: string; min: number; max: number; float?: boolean }[] = [
  { label: '1–10', min: 1, max: 10 },
  { label: '1–100', min: 1, max: 100 },
  { label: '骰子 d6', min: 1, max: 6 },
  { label: '骰子 d20', min: 1, max: 20 },
  { label: '百分比', min: 0, max: 100 },
  { label: '0–1 浮點', min: 0, max: 1, float: true },
]

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

function shuffleInPlace(pool: number[]) {
  for (let i = pool.length - 1; i > 0; i--) {
    const j = cryptoInt(0, i)
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool
}

function uniqueInts(lo: number, hi: number, n: number) {
  const span = hi - lo + 1
  if (n > span) throw new Error(`不重複時數量不可超過範圍大小（${span}）`)
  if (span <= SHUFFLE_SPAN_MAX) {
    const pool = Array.from({ length: span }, (_, i) => lo + i)
    shuffleInPlace(pool)
    return pool.slice(0, n)
  }
  const seen = new Set<number>()
  const out: number[] = []
  const maxAttempts = Math.max(n * 40, 400)
  for (let i = 0; i < maxAttempts && out.length < n; i++) {
    const v = cryptoInt(lo, hi)
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  if (out.length < n) throw new Error('大範圍不重複取樣失敗，請減少數量後重試')
  return out
}

function normalizeHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryItem[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item) {
      const values = item
        .split(/[,\s]+/)
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x))
      out.push({
        id: uid('rn'),
        at: 0,
        values,
        min: 1,
        max: 100,
        asFloat: false,
        decimals: 2,
        unique: false,
      })
      continue
    }
    if (item && typeof item === 'object') {
      const row = item as Partial<HistoryItem> & { line?: string }
      let values = Array.isArray(row.values) ? row.values.filter((x) => Number.isFinite(x)) : []
      if (!values.length && typeof row.line === 'string') {
        values = row.line
          .split(/[,\s]+/)
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x))
      }
      if (!values.length) continue
      out.push({
        id: String(row.id || uid('rn')),
        at: Number.isFinite(row.at) ? Number(row.at) : 0,
        values,
        min: Number.isFinite(row.min) ? Number(row.min) : 1,
        max: Number.isFinite(row.max) ? Number(row.max) : 100,
        asFloat: Boolean(row.asFloat),
        decimals: Number.isFinite(row.decimals) ? Number(row.decimals) : 2,
        unique: Boolean(row.unique),
      })
    }
  }
  return out
}

function joinValues(list: number[], fmt: OutFmt) {
  if (fmt === 'comma') return list.join(', ')
  if (fmt === 'json') return JSON.stringify(list)
  if (fmt === 'csv') return ['value', ...list.map(String)].join('\n')
  return list.join('\n')
}

function resultStats(list: number[]) {
  if (!list.length) {
    return { sum: 0, mean: 0, median: 0, min: 0, max: 0, std: 0, unique: 0, dupRate: 0 }
  }
  const sorted = [...list].sort((a, b) => a - b)
  const sum = list.reduce((a, b) => a + b, 0)
  const mean = sum / list.length
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  const variance = list.reduce((a, b) => a + (b - mean) ** 2, 0) / list.length
  const unique = new Set(list).size
  return {
    sum,
    mean: Math.round(mean * 1e6) / 1e6,
    median: Math.round(median * 1e6) / 1e6,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    std: Math.round(Math.sqrt(variance) * 1e6) / 1e6,
    unique,
    dupRate: Math.round(((list.length - unique) / list.length) * 1000) / 10,
  }
}

export default function Page() {
  const [min, setMin] = useLocalStorage('lab:random-number:min', 1)
  const [max, setMax] = useLocalStorage('lab:random-number:max', 100)
  const [count, setCount] = useLocalStorage('lab:random-number:count', 5)
  const [unique, setUnique] = useLocalStorage('lab:random-number:unique', false)
  const [asFloat, setAsFloat] = useLocalStorage('lab:random-number:float', false)
  const [decimals, setDecimals] = useLocalStorage('lab:random-number:decimals', 2)
  const [sorted, setSorted] = useLocalStorage('lab:random-number:sorted', false)
  const [fmt, setFmt] = useLocalStorage<OutFmt>('lab:random-number:fmt', 'comma')
  const [results, setResults] = useState<number[]>([])
  const [error, setError] = useState('')
  const [historyRaw, setHistoryRaw] = useLocalStorage<HistoryItem[] | string[]>(
    'lab:random-number:history-v2',
    [],
  )
  const history = useMemo(() => normalizeHistory(historyRaw), [historyRaw])
  const [copied, setCopied] = useState(false)

  const safeCount = clamp(Number.isFinite(count) ? count : COUNT_MIN, COUNT_MIN, COUNT_MAX)
  const safeDec = clamp(Number.isFinite(decimals) ? decimals : 2, DEC_MIN, DEC_MAX)
  const loBound = Math.min(
    clamp(Number.isFinite(min) ? min : 1, RANGE_MIN, RANGE_MAX),
    clamp(Number.isFinite(max) ? max : 100, RANGE_MIN, RANGE_MAX),
  )
  const hiBound = Math.max(
    clamp(Number.isFinite(min) ? min : 1, RANGE_MIN, RANGE_MAX),
    clamp(Number.isFinite(max) ? max : 100, RANGE_MIN, RANGE_MAX),
  )
  const intSpan = Math.floor(hiBound) - Math.ceil(loBound) + 1
  const stats = useMemo(() => resultStats(results), [results])
  const joined = useMemo(() => joinValues(results, fmt), [results, fmt])

  function setHistory(next: HistoryItem[] | ((prev: HistoryItem[]) => HistoryItem[])) {
    setHistoryRaw((prev) => {
      const current = normalizeHistory(prev)
      return typeof next === 'function' ? next(current) : next
    })
  }

  function generate() {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      setError('請輸入有效數字')
      setResults([])
      return
    }
    const lo = loBound
    const hi = hiBound
    const n = safeCount
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
        out = Array.from({ length: n }, () => cryptoFloat(lo, hi, safeDec))
      } else {
        const ilo = Math.ceil(lo)
        const ihi = Math.floor(hi)
        if (ihi < ilo) {
          setError('整數範圍無效')
          setResults([])
          return
        }
        out = unique ? uniqueInts(ilo, ihi, n) : Array.from({ length: n }, () => cryptoInt(ilo, ihi))
      }
      if (sorted) out = [...out].sort((a, b) => a - b)
      setResults(out)
      setHistory((h) =>
        [
          {
            id: uid('num'),
            at: Date.now(),
            values: out,
            min: lo,
            max: hi,
            asFloat,
            decimals: safeDec,
            unique,
          },
          ...h,
        ].slice(0, HISTORY_CAP),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '產生失敗')
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

  function applyPreset(p: (typeof RANGE_PRESETS)[number]) {
    setMin(p.min)
    setMax(p.max)
    if (p.float) setAsFloat(true)
    else setAsFloat(false)
    setError('')
  }

  function applyHistory(item: HistoryItem) {
    setMin(clamp(item.min, RANGE_MIN, RANGE_MAX))
    setMax(clamp(item.max, RANGE_MIN, RANGE_MAX))
    setAsFloat(item.asFloat)
    setDecimals(item.decimals)
    setUnique(item.unique)
    setResults(item.values)
    setError('')
  }

  async function copyResults() {
    if (!joined) return
    await copyText(joined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row rnd-shell-actions">
          <ActionButton className="btn sm accent" onClick={generate}>
            產生
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!results.length} onClick={() => void copyResults()}>
            {copied ? '已複製' : '複製'}
          </ActionButton>
        </div>
      }
    >
      <div className="rnd-calc">
        <div className="pw-stats">
          <span className="metric">
            {loBound} – {hiBound}
          </span>
          <span className="tag">{asFloat ? `浮點 ${safeDec} 位` : '整數'}</span>
          <span className="tag">數量 {safeCount}</span>
          {!asFloat && <span className="tag">範圍 {intSpan.toLocaleString()}</span>}
          <span className="tag">結果 {results.length}</span>
        </div>

        <div className="rnd-main">
          <section className="panel rnd-settings">
            <h3 className="pw-panel-title">產生設定</h3>

            <div className="pw-block">
              <div className="label">常用範圍</div>
              <div className="pw-chips">
                {RANGE_PRESETS.map((p) => (
                  <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rnd-fields-2">
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
            </div>

            <label className="stack">
              <span className="label">
                數量：{safeCount}（{COUNT_MIN}–{COUNT_MAX}）
              </span>
              <input
                className="field"
                type="range"
                min={COUNT_MIN}
                max={COUNT_MAX}
                value={safeCount}
                onChange={(e) => {
                  setError('')
                  setCount(clamp(parseNumber(e.target.value, COUNT_MIN), COUNT_MIN, COUNT_MAX))
                }}
              />
              <input
                className="field"
                type="number"
                min={COUNT_MIN}
                max={COUNT_MAX}
                value={safeCount}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) {
                    setError('請輸入有效數字')
                    return
                  }
                  setError('')
                  setCount(clamp(n, COUNT_MIN, COUNT_MAX))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generate()
                }}
              />
            </label>
            <div className="pw-chips">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${safeCount === n ? 'accent' : 'ghost'}`}
                  onClick={() => {
                    setError('')
                    setCount(n)
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="pw-block">
              <div className="label">模式</div>
              <div className="pw-chips">
                <label className={`pw-check-chip${!asFloat ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={!asFloat} onChange={() => setAsFloat(false)} />
                  整數
                </label>
                <label className={`pw-check-chip${asFloat ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={asFloat} onChange={() => setAsFloat(true)} />
                  浮點數
                </label>
                <label className={`pw-check-chip${unique ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={unique}
                    disabled={asFloat}
                    onChange={(e) => setUnique(e.target.checked)}
                  />
                  不重複
                </label>
                <label className={`pw-check-chip${sorted ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} />
                  結果排序
                </label>
              </div>
              {asFloat && (
                <label className="stack" style={{ marginTop: '0.35rem' }}>
                  <span className="label">小數位：{safeDec}</span>
                  <input
                    className="field"
                    type="range"
                    min={DEC_MIN}
                    max={DEC_MAX}
                    value={safeDec}
                    onChange={(e) => setDecimals(clamp(parseNumber(e.target.value, 2), DEC_MIN, DEC_MAX))}
                  />
                </label>
              )}
              {unique && asFloat && <p className="field-error">浮點數無法保證不重複</p>}
              {unique && !asFloat && safeCount > intSpan && (
                <p className="field-error">
                  不重複數量不可超過範圍 {intSpan.toLocaleString()}
                </p>
              )}
            </div>

            <div className="pw-block">
              <div className="label">輸出格式</div>
              <div className="pw-chips">
                {(
                  [
                    ['comma', '逗號'],
                    ['nl', '換行'],
                    ['json', 'JSON'],
                    ['csv', 'CSV'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn sm ${fmt === k ? 'accent' : 'ghost'}`}
                    onClick={() => setFmt(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pw-actions">
              <ActionButton className="btn accent" onClick={generate}>
                產生
              </ActionButton>
              <ActionButton className="btn ghost" disabled={!results.length} onClick={() => void copyResults()} icon="copy">
                {copied ? '已複製' : '複製'}
              </ActionButton>
              <ActionButton
                className="btn ghost"
                disabled={!results.length}
                onClick={() =>
                  downloadText(
                    fmt === 'csv' ? 'numbers.csv' : fmt === 'json' ? 'numbers.json' : 'numbers.txt',
                    joined,
                    fmt === 'csv' ? 'text/csv;charset=utf-8' : undefined,
                  )
                }
              >
                下載
              </ActionButton>
              <ActionButton className="btn ghost" disabled={!results.length} onClick={() => setResults([])}>
                清空結果
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
          </section>

          <aside className="rnd-side">
            <section className="panel rnd-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">產生結果</h3>
                <span className="tag">{results.length} 筆</span>
              </div>
              {!results.length && (
                <p className="muted" style={{ margin: 0 }}>
                  調整左側設定後按「產生」
                </p>
              )}
              {results.length > 0 && (
                <>
                  <div className="rnd-hero mono">{results.length <= 12 ? results.join(', ') : results.slice(0, 12).join(', ') + '…'}</div>
                  <ul className="rnd-result-list">
                    {results.map((v, i) => (
                      <li key={`${v}-${i}`} className="rnd-result-item">
                        <span className="mono">{v}</span>
                        <ActionButton
                          className="btn sm ghost"
                          onClick={() => void copyText(String(v))}
                          icon="copy"
                          iconOnly
                          tooltip="複製"
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="panel rnd-info">
              <h3 className="pw-panel-title">更多資訊</h3>
              <ul className="pw-info-list">
                <li>
                  <span className="muted">範圍</span>
                  <strong>
                    {loBound} – {hiBound}
                  </strong>
                </li>
                {!asFloat && (
                  <li>
                    <span className="muted">整數個數</span>
                    <strong>{intSpan.toLocaleString()}</strong>
                  </li>
                )}
                <li>
                  <span className="muted">加總</span>
                  <strong className="mono">{results.length ? stats.sum : '—'}</strong>
                </li>
                <li>
                  <span className="muted">平均</span>
                  <strong className="mono">{results.length ? stats.mean : '—'}</strong>
                </li>
                <li>
                  <span className="muted">中位數</span>
                  <strong className="mono">{results.length ? stats.median : '—'}</strong>
                </li>
                <li>
                  <span className="muted">最小／最大</span>
                  <strong className="mono">{results.length ? `${stats.min} / ${stats.max}` : '—'}</strong>
                </li>
                <li>
                  <span className="muted">標準差</span>
                  <strong className="mono">{results.length ? stats.std : '—'}</strong>
                </li>
                <li>
                  <span className="muted">不重複</span>
                  <strong>
                    {results.length ? `${stats.unique}/${results.length}` : '—'}
                  </strong>
                </li>
                <li>
                  <span className="muted">重複率</span>
                  <strong>{results.length ? `${stats.dupRate}%` : '—'}</strong>
                </li>
                <li>
                  <span className="muted">亂數來源</span>
                  <strong>crypto.getRandomValues</strong>
                </li>
              </ul>
              <p className="muted pw-hint">
                整數使用無偏差取樣；大範圍不重複改採集合抽樣，避免一次建立超大陣列。
              </p>
            </section>
          </aside>
        </div>

        <section className="panel rnd-history">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">歷史</h3>
            <ActionButton
              className="btn sm ghost"
              disabled={!history.length}
              onClick={() => {
                if (confirm('確定清空全部歷史？')) setHistory([])
              }}
            >
              清空
            </ActionButton>
          </div>
          {!history.length && (
            <p className="muted" style={{ margin: 0 }}>
              產生後會自動保存於此（本機）
            </p>
          )}
          <ul className="rnd-history-list">
            {history.map((h) => (
              <li key={h.id} className="rnd-history-card">
                <code className="mono rnd-history-text">
                  {h.values.length <= 8 ? h.values.join(', ') : `${h.values.slice(0, 8).join(', ')}…`}
                </code>
                <div className="pw-history-meta">
                  <span className="tag">
                    {h.min}–{h.max}
                  </span>
                  <span className="tag">{h.values.length} 筆</span>
                  <span className="tag">{h.asFloat ? '浮點' : '整數'}</span>
                  {h.unique && <span className="tag">不重複</span>}
                </div>
                {!!h.at && (
                  <div className="muted pw-history-time">{new Date(h.at).toLocaleString('zh-TW')}</div>
                )}
                <div className="pw-history-actions">
                  <ActionButton className="btn sm ghost" onClick={() => applyHistory(h)} icon="check">
                    還原
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyText(h.values.join(', '))}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    label="刪除"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
