import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { IconReset, IconTarget } from '../../components/icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('currency-converter')!

const AMOUNT_MIN = 0
const AMOUNT_MAX = 1_000_000_000_000
const FILTER_MAX = 40
const CODE_FILTER_MAX = 24

/** 離線／API 全掛時的備援（約略參考值，非即時） */
const FALLBACK: Record<string, number> = {
  USD: 1,
  TWD: 31.5,
  EUR: 0.92,
  JPY: 149,
  GBP: 0.79,
  CNY: 7.24,
  HKD: 7.82,
  KRW: 1350,
  AUD: 1.52,
  CAD: 1.36,
  SGD: 1.34,
  THB: 35.5,
  MYR: 4.7,
  PHP: 58,
  VND: 25400,
  IDR: 16200,
  CHF: 0.88,
  NZD: 1.68,
}

const LABELS: Record<string, string> = {
  USD: '美元',
  TWD: '新台幣',
  EUR: '歐元',
  JPY: '日圓',
  GBP: '英鎊',
  CNY: '人民幣',
  HKD: '港幣',
  KRW: '韓元',
  AUD: '澳幣',
  CAD: '加幣',
  SGD: '新加坡幣',
  THB: '泰銖',
  MYR: '馬來西亞令吉',
  PHP: '菲律賓披索',
  VND: '越南盾',
  IDR: '印尼盾',
  CHF: '瑞士法郎',
  NZD: '紐西蘭幣',
  INR: '印度盧比',
  MOP: '澳門幣',
}

const POPULAR = [
  'TWD',
  'USD',
  'EUR',
  'JPY',
  'CNY',
  'HKD',
  'GBP',
  'KRW',
  'SGD',
  'AUD',
  'CAD',
  'THB',
  'MYR',
  'PHP',
  'CHF',
  'NZD',
]

const PAIR_PRESETS: { label: string; from: string; to: string; amount?: number }[] = [
  { label: 'TWD → USD', from: 'TWD', to: 'USD', amount: 1000 },
  { label: 'USD → TWD', from: 'USD', to: 'TWD', amount: 100 },
  { label: 'TWD → JPY', from: 'TWD', to: 'JPY', amount: 3000 },
  { label: 'EUR → TWD', from: 'EUR', to: 'TWD', amount: 50 },
  { label: 'TWD → CNY', from: 'TWD', to: 'CNY', amount: 1000 },
  { label: 'USD → KRW', from: 'USD', to: 'KRW', amount: 50 },
]

const AMOUNT_CHIPS = [100, 500, 1000, 3000, 10000]

type Pair = { from: string; to: string }
type HistoryItem = {
  id: string
  at: number
  amount: number
  from: string
  to: string
  result: number
  rate: number
}
type RateSource = 'open.er-api' | 'frankfurter' | 'fallback' | 'cache'

type CachedRates = {
  rates: Record<string, number>
  asOf: string
  source: RateSource
  fetchedAt: number
}

function labelOf(code: string) {
  return LABELS[code] ? `${code} · ${LABELS[code]}` : code
}

function mergeRates(base: Record<string, number>) {
  const next: Record<string, number> = { USD: 1, ...base }
  for (const [k, v] of Object.entries(FALLBACK)) {
    if (next[k] == null) next[k] = v
  }
  return next
}

async function fetchOpenErApi(): Promise<CachedRates> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error(`open.er-api HTTP ${res.status}`)
  const data = (await res.json()) as {
    result?: string
    rates?: Record<string, number>
    time_last_update_utc?: string
    time_last_update_unix?: number
  }
  if (data.result !== 'success' || !data.rates) throw new Error('open.er-api 回傳異常')
  const asOf = data.time_last_update_utc
    ? `更新 ${new Date(data.time_last_update_utc).toLocaleString('zh-TW')}`
    : '即時匯率'
  return {
    rates: mergeRates(data.rates),
    asOf,
    source: 'open.er-api',
    fetchedAt: Date.now(),
  }
}

async function fetchFrankfurter(): Promise<CachedRates> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD')
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`)
  const data = (await res.json()) as { date?: string; rates?: Record<string, number> }
  if (!data.rates) throw new Error('Frankfurter 回傳異常')
  return {
    rates: mergeRates(data.rates),
    asOf: `備援匯率 · ${data.date ?? '—'}`,
    source: 'frankfurter',
    fetchedAt: Date.now(),
  }
}

export default function Page() {
  const [amount, setAmount] = useLocalStorage('lab:currency-converter:amount', 1000)
  const [from, setFrom] = useLocalStorage('lab:currency-converter:from', 'TWD')
  const [to, setTo] = useLocalStorage('lab:currency-converter:to', 'USD')
  const [favorites, setFavorites] = useLocalStorage<Pair[]>('lab:currency-converter:favs', [
    { from: 'TWD', to: 'USD' },
    { from: 'USD', to: 'TWD' },
  ])
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:currency-converter:history', [])
  const [watch, setWatch] = useLocalStorage<string[]>('lab:currency-converter:watch', [
    'USD',
    'EUR',
    'JPY',
    'HKD',
    'CNY',
  ])
  const [cached, setCached] = useLocalStorage<CachedRates | null>('lab:currency-converter:cache', null)

  const [rates, setRates] = useState(() => cached?.rates ?? FALLBACK)
  const [asOf, setAsOf] = useState(() => cached?.asOf ?? '示範匯率')
  const [source, setSource] = useState<RateSource>(() => cached?.source ?? 'fallback')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [histFilter, setHistFilter] = useState('')
  const [codeFilter, setCodeFilter] = useState('')
  const [amountDraft, setAmountDraft] = useState<string | null>(null)
  const [amountInvalid, setAmountInvalid] = useState(false)
  const [copied, setCopied] = useState(false)

  const codes = useMemo(() => {
    const keys = Object.keys(rates)
    const pop = POPULAR.filter((c) => keys.includes(c))
    const rest = keys.filter((c) => !pop.includes(c)).sort()
    return [...pop, ...rest]
  }, [rates])

  const filteredCodes = useMemo(() => {
    const q = codeFilter.trim().toUpperCase()
    if (!q) return codes
    return codes.filter((c) => {
      const label = LABELS[c] ?? ''
      return c.includes(q) || label.includes(codeFilter.trim())
    })
  }, [codes, codeFilter])

  const applyRates = useCallback(
    (payload: CachedRates, persist: boolean) => {
      setRates(payload.rates)
      setAsOf(payload.asOf)
      setSource(payload.source)
      if (persist) setCached(payload)
      setFrom((prev) => (payload.rates[prev] != null ? prev : 'TWD' in payload.rates ? 'TWD' : 'USD'))
      setTo((prev) => (payload.rates[prev] != null ? prev : 'USD' in payload.rates ? 'USD' : Object.keys(payload.rates)[0] ?? 'USD'))
    },
    [setCached, setFrom, setTo],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const errors: string[] = []
    try {
      try {
        const primary = await fetchOpenErApi()
        applyRates(primary, true)
        return
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'open.er-api 失敗')
      }
      try {
        const secondary = await fetchFrankfurter()
        applyRates(secondary, true)
        setError(`主來源失敗（${errors.join('；')}），已改用 Frankfurter 備援`)
        return
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Frankfurter 失敗')
      }
      if (cached?.rates) {
        applyRates(
          {
            ...cached,
            asOf: `${cached.asOf}（快取）`,
            source: 'cache',
          },
          false,
        )
        setError(`線上來源皆失敗，使用上次快取。${errors.join('；')}`)
        return
      }
      applyRates(
        {
          rates: FALLBACK,
          asOf: '示範匯率（離線）',
          source: 'fallback',
          fetchedAt: Date.now(),
        },
        false,
      )
      setError(`無法取得即時匯率：${errors.join('；')}`)
    } finally {
      setLoading(false)
    }
  }, [applyRates, cached])

  useEffect(() => {
    void load()
    // 僅掛載時抓一次；手動「重新抓匯率」再更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const result = useMemo(() => {
    const fr = rates[from]
    const tr = rates[to]
    if (fr == null || tr == null) return 0
    return (amount / fr) * tr
  }, [amount, from, to, rates])

  const rateOne = useMemo(() => {
    const fr = rates[from]
    const tr = rates[to]
    if (fr == null || tr == null) return 0
    return (1 / fr) * tr
  }, [from, to, rates])

  const rateInverse = useMemo(() => (rateOne ? 1 / rateOne : 0), [rateOne])

  const amountOk =
    Number.isFinite(amount) && amount >= AMOUNT_MIN && amount <= AMOUNT_MAX && !amountInvalid
  const canSave = amountOk && Number.isFinite(result)

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => `${h.from}${h.to}${h.amount}`.toLowerCase().includes(q))
  }, [history, histFilter])

  const watchRows = useMemo(() => {
    const fr = rates[from]
    if (fr == null) return []
    return watch
      .filter((c) => c !== from && rates[c] != null)
      .map((c) => ({
        code: c,
        value: (amount / fr) * rates[c]!,
        rate: (1 / fr) * rates[c]!,
      }))
  }, [watch, rates, from, amount])

  function commitAmount(raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setAmountInvalid(true)
      setAmount(clamp(amount, AMOUNT_MIN, AMOUNT_MAX))
      return
    }
    const next = clamp(n, AMOUNT_MIN, AMOUNT_MAX)
    setAmountInvalid(n < AMOUNT_MIN || n > AMOUNT_MAX)
    setAmount(next)
  }

  function saveHistory() {
    if (!canSave) return
    setHistory((h) =>
      [
        {
          id: uid('fx'),
          at: Date.now(),
          amount,
          from,
          to,
          result,
          rate: rateOne,
        },
        ...h,
      ].slice(0, 40),
    )
  }

  function toggleFavorite() {
    const exists = favorites.some((f) => f.from === from && f.to === to)
    if (exists) {
      setFavorites((xs) => xs.filter((f) => !(f.from === from && f.to === to)))
    } else {
      setFavorites((xs) => [{ from, to }, ...xs].slice(0, 16))
    }
  }

  function removeFavorite(pair: Pair) {
    setFavorites((xs) => xs.filter((f) => !(f.from === pair.from && f.to === pair.to)))
  }

  function isFav(a: string, b: string) {
    return favorites.some((f) => f.from === a && f.to === b)
  }

  async function copyResult() {
    await copyText(
      `${amount.toLocaleString()} ${from} = ${result.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}\n1 ${from} = ${rateOne.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function exportHistory(kind: string) {
    if (!history.length || !kind) return
    if (kind === 'csv') {
      const lines = [
        '時間,金額,從,到,結果,匯率',
        ...history.map((h) =>
          [new Date(h.at).toISOString(), h.amount, h.from, h.to, h.result.toFixed(4), h.rate.toFixed(6)].join(','),
        ),
      ]
      downloadText('fx-history.csv', `\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8')
      return
    }
    if (kind === 'txt') {
      const text = history
        .map(
          (h) =>
            `${new Date(h.at).toLocaleString('zh-TW')} · ${h.amount} ${h.from} → ${h.result.toFixed(4)} ${h.to}（匯率 ${h.rate.toFixed(6)}）`,
        )
        .join('\n')
      downloadText('fx-history.txt', text, 'text/plain;charset=utf-8')
      return
    }
    if (kind === 'copy') {
      void copyText(
        history
          .map((h) => `${h.amount} ${h.from} = ${h.result.toFixed(4)} ${h.to}`)
          .join('\n'),
      )
    }
  }

  const sourceTag =
    source === 'open.er-api'
      ? '即時'
      : source === 'frankfurter'
        ? '備援'
        : source === 'cache'
          ? '快取'
          : '示範'

  const rounded = useMemo(() => {
    // 依常見慣例：JPY/KRW/VND/IDR 無小數，其餘最多 2 位顯示（完整仍可複製）
    const zeroDec = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK'])
    const digits = zeroDec.has(to) ? 0 : 2
    const factor = 10 ** digits
    return {
      digits,
      display: (Math.round(result * factor) / factor).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    }
  }, [result, to])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
          <IconReset size={15} strokeWidth={2.25} />
          {loading ? '更新中…' : '重新抓匯率'}
        </button>
      }
    >
      <div className="fx-calc">
        <section className="panel fx-status">
          <p className="fx-status-meta">{asOf}</p>
          <div className="fx-status-tags">
            <span className="tag">{sourceTag}</span>
            <span className="tag">{codes.length} 幣</span>
            {error ? null : <span className="muted" style={{ fontSize: 12 }}>僅供參考</span>}
          </div>
          {error && <p className="field-error fx-status-error">{error}</p>}
        </section>

        <div className="fx-main">
          <section className="panel fx-converter">
            <h3 className="fx-panel-title">換算</h3>

            <div className="fx-amount-block">
              <label className="fx-field">
                <span className="label">金額</span>
                <input
                  className={`field${amountInvalid ? ' is-invalid' : ''}`}
                  type="number"
                  inputMode="decimal"
                  min={AMOUNT_MIN}
                  max={AMOUNT_MAX}
                  value={amountDraft ?? String(amount)}
                  onChange={(e) => {
                    const raw = e.target.value
                    setAmountDraft(raw)
                    setAmountInvalid(false)
                    if (!raw.trim()) return
                    const n = parseNumber(raw)
                    if (Number.isFinite(n)) setAmount(n)
                  }}
                  onBlur={() => {
                    const raw = amountDraft
                    setAmountDraft(null)
                    commitAmount(raw ?? String(amount))
                  }}
                />
                {amountInvalid && (
                  <p className="field-error">
                    請輸入 {AMOUNT_MIN}–{AMOUNT_MAX.toLocaleString()} 之間的數字
                  </p>
                )}
              </label>
              <div className="fx-chips">
                {AMOUNT_CHIPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn sm ${amount === n ? 'accent' : 'ghost'}`}
                    onClick={() => {
                      setAmountDraft(null)
                      setAmountInvalid(false)
                      setAmount(n)
                    }}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="fx-pair">
              <label className="fx-field">
                <span className="label">從</span>
                <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {(filteredCodes.includes(from) ? filteredCodes : [from, ...filteredCodes]).map((c) => (
                    <option key={c} value={c}>
                      {labelOf(c)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn ghost fx-swap"
                aria-label="交換幣別"
                title="交換幣別"
                onClick={() => {
                  setFrom(to)
                  setTo(from)
                }}
              >
                ⇄
              </button>
              <label className="fx-field">
                <span className="label">到</span>
                <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
                  {(filteredCodes.includes(to) ? filteredCodes : [to, ...filteredCodes]).map((c) => (
                    <option key={c} value={c}>
                      {labelOf(c)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="fx-filter-row">
              <label className="fx-field">
                <span className="label">篩選幣別</span>
                <input
                  className="field"
                  placeholder="TWD、日圓…"
                  value={codeFilter}
                  maxLength={CODE_FILTER_MAX}
                  onChange={(e) => setCodeFilter(limitText(e.target.value, CODE_FILTER_MAX))}
                />
              </label>
              <span className="fx-filter-count">
                {filteredCodes.length}/{codes.length}
              </span>
            </div>

            <div className="fx-result">
              <div className="muted">換算結果</div>
              <div className="fx-result-num">
                {rounded.display} <span className="fx-result-code">{to}</span>
              </div>
              <p className="muted mono fx-rate-lines">
                精確值 {result.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to}
                <br />
                1 {from} = {rateOne.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to}
                <br />
                1 {to} = {rateInverse.toLocaleString(undefined, { maximumFractionDigits: 6 })} {from}
              </p>
            </div>

            <div className="fx-actions">
              <button type="button" className="btn accent" onClick={() => void copyResult()} disabled={!canSave}>
                {copied ? '已複製' : '複製結果'}
              </button>
              <button type="button" className="btn teal" onClick={saveHistory} disabled={!canSave}>
                存入歷史
              </button>
              <button
                type="button"
                className={`btn ghost ${isFav(from, to) ? 'accent' : ''}`}
                onClick={toggleFavorite}
              >
                {isFav(from, to) ? '取消收藏' : '收藏此幣對'}
              </button>
            </div>
          </section>

          <div className="fx-side">
            <section className="panel fx-presets">
              <h3 className="fx-panel-title" style={{ marginBottom: '0.55rem' }}>
                常用兌換
              </h3>
              <div className="fx-presets-chips">
                {PAIR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`btn sm ${from === p.from && to === p.to ? 'accent' : 'ghost'}`}
                    onClick={() => {
                      setFrom(p.from)
                      setTo(p.to)
                      if (p.amount != null) {
                        setAmountDraft(null)
                        setAmountInvalid(false)
                        setAmount(p.amount)
                      }
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel fx-favs">
              <div className="fx-panel-head">
                <h3 className="fx-panel-title">收藏幣對</h3>
                {!!favorites.length && (
                  <DeleteButton
                    label="清空全部收藏"
                    title="一鍵刪除全部收藏"
                    onClick={() => {
                      if (!confirm(`確定刪除全部 ${favorites.length} 組收藏？`)) return
                      setFavorites([])
                    }}
                  />
                )}
              </div>
              {!favorites.length ? (
                <p className="muted fx-empty">尚未收藏</p>
              ) : (
                <ul className="list fx-fav-list">
                  {favorites.map((f) => {
                    const fr = rates[f.from]
                    const tr = rates[f.to]
                    const rate = fr && tr ? (1 / fr) * tr : 0
                    return (
                      <li key={`${f.from}-${f.to}`} className="list-item">
                        <button
                          type="button"
                          className="fx-fav-apply"
                          onClick={() => {
                            setFrom(f.from)
                            setTo(f.to)
                          }}
                        >
                          <strong>
                            {f.from} → {f.to}
                          </strong>
                          <span className="muted mono" style={{ fontSize: 12 }}>
                            1 {f.from} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {f.to}
                          </span>
                        </button>
                        <DeleteButton
                          label={`刪除 ${f.from}→${f.to}`}
                          onClick={() => removeFavorite(f)}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        <div className="fx-bottom">
          <section className="panel">
            <h3 className="fx-panel-title">監看對照 · 基準 {from}</h3>
            <div className="fx-watch-picks">
              {POPULAR.filter((c) => codes.includes(c)).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`btn sm ${watch.includes(c) ? 'accent' : 'ghost'}`}
                  onClick={() =>
                    setWatch((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c].slice(0, 10)))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <ul className="list fx-watch-list">
              {watchRows.map((r) => (
                <li key={r.code} className="list-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>
                      {r.code} {LABELS[r.code] || ''}
                    </strong>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      1 {from} = {r.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {r.code}
                    </div>
                  </div>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {r.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost fx-icon-btn"
                    aria-label={`設 ${r.code} 為目標`}
                    title={`設為目標：${r.code}`}
                    onClick={() => setTo(r.code)}
                  >
                    <IconTarget size={16} strokeWidth={2} />
                  </button>
                  <DeleteButton
                    label={`移除監看 ${r.code}`}
                    onClick={() => setWatch((xs) => xs.filter((x) => x !== r.code))}
                  />
                </li>
              ))}
              {!watchRows.length && <p className="muted fx-empty">點上方幣別加入監看</p>}
            </ul>
          </section>

          <section className="panel">
            <div className="fx-panel-head">
              <h3 className="fx-panel-title">換算歷史</h3>
              {!!history.length && (
                <div className="fx-hist-actions">
                  <select
                    className="field"
                    defaultValue=""
                    aria-label="匯出歷史"
                    onChange={(e) => {
                      const kind = e.target.value
                      e.target.value = ''
                      exportHistory(kind)
                    }}
                  >
                    <option value="" disabled>
                      匯出…
                    </option>
                    <option value="csv">下載 CSV</option>
                    <option value="txt">下載 TXT</option>
                    <option value="copy">複製文字</option>
                  </select>
                  <DeleteButton
                    label="清空全部歷史"
                    title="一鍵刪除全部歷史"
                    onClick={() => {
                      if (!confirm(`確定刪除全部 ${history.length} 筆歷史？`)) return
                      setHistory([])
                    }}
                  />
                </div>
              )}
            </div>
            <input
              className="field"
              placeholder="篩選歷史…"
              value={histFilter}
              maxLength={FILTER_MAX}
              onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
            />
            <ul className="list fx-hist-list">
              {filteredHistory.map((h) => (
                <li key={h.id} className="list-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>
                      {h.amount.toLocaleString()} {h.from} →{' '}
                      {h.result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {h.to}
                    </strong>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {new Date(h.at).toLocaleString('zh-TW')} · 1 {h.from} = {h.rate.toFixed(6)} {h.to}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setAmountDraft(null)
                      setAmountInvalid(false)
                      setAmount(h.amount)
                      setFrom(h.from)
                      setTo(h.to)
                    }}
                  >
                    套用
                  </button>
                  <DeleteButton
                    label="刪除此筆歷史"
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                  />
                </li>
              ))}
              {!filteredHistory.length && <p className="muted fx-empty">尚無歷史</p>}
            </ul>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
