import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, limitText, charCount, parseNumber, uid } from '../../lib/utils'

const meta = getProject('currency-converter')!

const AMOUNT_MIN = 0
const AMOUNT_MAX = 1_000_000_000_000
const FILTER_MAX = 40

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
}

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

const PAIR_PRESETS: { label: string; from: string; to: string; amount?: number }[] = [
  { label: 'TWD → USD', from: 'TWD', to: 'USD', amount: 1000 },
  { label: 'USD → TWD', from: 'USD', to: 'TWD', amount: 100 },
  { label: 'TWD → JPY', from: 'TWD', to: 'JPY', amount: 3000 },
  { label: 'EUR → TWD', from: 'EUR', to: 'TWD', amount: 50 },
  { label: 'USD → KRW', from: 'USD', to: 'KRW', amount: 50 },
]

export default function Page() {
  const [amount, setAmount] = useLocalStorage('lab:currency-converter:amount', 1000)
  const [from, setFrom] = useLocalStorage('lab:currency-converter:from', 'TWD')
  const [to, setTo] = useLocalStorage('lab:currency-converter:to', 'USD')
  const [favorites, setFavorites] = useLocalStorage<Pair[]>('lab:currency-converter:favs', [
    { from: 'TWD', to: 'USD' },
    { from: 'USD', to: 'TWD' },
  ])
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:currency-converter:history', [])
  const [watch, setWatch] = useLocalStorage<string[]>('lab:currency-converter:watch', ['USD', 'EUR', 'JPY', 'HKD'])
  const [rates, setRates] = useState(FALLBACK)
  const [asOf, setAsOf] = useState('示範匯率')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [histFilter, setHistFilter] = useState('')
  const [amountError, setAmountError] = useState('')
  const codes = useMemo(() => Object.keys(rates).sort(), [rates])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD')
      if (!res.ok) throw new Error('無法取得匯率')
      const data = (await res.json()) as { date: string; rates: Record<string, number> }
      const next: Record<string, number> = { USD: 1, ...data.rates }
      for (const k of Object.keys(FALLBACK)) {
        if (next[k] == null) next[k] = FALLBACK[k]!
      }
      setRates(next)
      setAsOf(`即時 ${data.date}（Frankfurter）`)
    } catch (e) {
      setRates(FALLBACK)
      setAsOf('示範匯率（離線）')
      setError(e instanceof Error ? e.message : '載入失敗，已改用示範匯率')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const result = useMemo(() => {
    const fr = rates[from]
    const tr = rates[to]
    if (fr == null || tr == null) return 0
    const usd = amount / fr
    return usd * tr
  }, [amount, from, to, rates])

  const amountOk = Number.isFinite(amount) && amount >= AMOUNT_MIN && amount <= AMOUNT_MAX && !amountError
  const canSave = amountOk && Number.isFinite(result)

  const rateOne = useMemo(() => {
    const fr = rates[from]
    const tr = rates[to]
    if (fr == null || tr == null) return 0
    return (1 / fr) * tr
  }, [from, to, rates])

  const rateText = `1 ${from} = ${rateOne.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}`

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
      ].slice(0, 30),
    )
  }

  function onAmountChange(raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setAmountError('請輸入有效數字')
      return
    }
    setAmountError('')
    setAmount(clamp(n, AMOUNT_MIN, AMOUNT_MAX))
  }

  function toggleFavorite() {
    const exists = favorites.some((f) => f.from === from && f.to === to)
    if (exists) {
      setFavorites((xs) => xs.filter((f) => !(f.from === from && f.to === to)))
    } else {
      setFavorites((xs) => [{ from, to }, ...xs].slice(0, 12))
    }
  }

  function isFav(a: string, b: string) {
    return favorites.some((f) => f.from === a && f.to === b)
  }

  function exportHistory() {
    const lines = [
      '時間,金額,從,到,結果,匯率',
      ...history.map((h) =>
        [new Date(h.at).toISOString(), h.amount, h.from, h.to, h.result.toFixed(4), h.rate.toFixed(6)].join(','),
      ),
    ]
    downloadText('fx-history.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? '更新中…' : '重新抓匯率'}
          </button>
          <button type="button" className="btn ghost sm" onClick={saveHistory} disabled={!canSave}>
            存入歷史
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">{asOf}</span>
        <span className="tag">幣別 {codes.length}</span>
        <span className="tag">歷史 {history.length}</span>
        <span className="tag">收藏 {favorites.length}</span>
        {error && <span className="tag" style={{ background: 'var(--rose-soft)', color: 'var(--rose)' }}>{error}</span>}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div>
            <div className="label">常用兌換</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {PAIR_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setFrom(p.from)
                    setTo(p.to)
                    if (p.amount != null) setAmount(p.amount)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {!!favorites.length && (
            <div>
              <div className="label">收藏幣對</div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {favorites.map((f) => (
                  <button
                    key={`${f.from}-${f.to}`}
                    type="button"
                    className={`btn sm ${from === f.from && to === f.to ? 'accent' : 'ghost'}`}
                    onClick={() => {
                      setFrom(f.from)
                      setTo(f.to)
                    }}
                  >
                    {f.from}→{f.to}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="stack">
            <span className="label">金額</span>
            <input
              className={`field${amountError ? ' is-invalid' : ''}`}
              type="number"
              min={AMOUNT_MIN}
              max={AMOUNT_MAX}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
            />
            {amountError && <p className="field-error">{amountError}</p>}
            <p className="field-hint">
              {AMOUNT_MIN}–{AMOUNT_MAX.toLocaleString()}
            </p>
          </label>

          <div className="grid-2">
            <label className="stack">
              <span className="label">從</span>
              <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
                {codes.map((c) => (
                  <option key={c} value={c}>
                    {c} {LABELS[c] ? `· ${LABELS[c]}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span className="label">到</span>
              <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
                {codes.map((c) => (
                  <option key={c} value={c}>
                    {c} {LABELS[c] ? `· ${LABELS[c]}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setFrom(to)
                setTo(from)
              }}
            >
              ⇄ 交換
            </button>
            <button type="button" className={`btn sm ${isFav(from, to) ? 'accent' : 'ghost'}`} onClick={toggleFavorite}>
              {isFav(from, to) ? '已收藏' : '收藏此幣對'}
            </button>
            <span className="muted mono">{rateText}</span>
          </div>

          <div className="metric">
            <div className="muted">換算結果</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => void copyText(`${amount} ${from} = ${result.toFixed(4)} ${to}`)}
            >
              複製結果
            </button>
            <button type="button" className="btn teal" onClick={saveHistory} disabled={!canSave}>
              存入歷史
            </button>
          </div>

          <div>
            <div className="label">對照表基準：{from}（可加入監看幣）</div>
            <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              {['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'HKD', 'KRW', 'SGD', 'AUD', 'CAD', 'TWD']
                .filter((c) => codes.includes(c))
                .map((c) => (
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
            <ul className="list">
              {watchRows.map((r) => (
                <li key={r.code} className="list-item">
                  <span>
                    <strong>{r.code}</strong> {LABELS[r.code] || ''}
                  </span>
                  <span className="mono">
                    {r.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => setTo(r.code)}
                  >
                    設為目標
                  </button>
                </li>
              ))}
              {!watchRows.length && <p className="muted">選擇監看幣別以顯示對照表</p>}
            </ul>
          </div>
        </div>

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>換算歷史</h3>
            <div className="row">
              <button type="button" className="btn sm ghost" disabled={!history.length} onClick={exportHistory}>
                匯出
              </button>
              <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
                清空
              </button>
            </div>
          </div>
          <input
            className="field"
            placeholder="篩選歷史…"
            value={histFilter}
            maxLength={FILTER_MAX}
            onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
          />
          <div className="field-meta">
            <span className="field-hint">篩選字串</span>
            <span>
              {charCount(histFilter)} / {FILTER_MAX}
            </span>
          </div>
          <ul className="list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="list-item stack">
                <strong>
                  {h.amount.toLocaleString()} {h.from} → {h.result.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                  {h.to}
                </strong>
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(h.at).toLocaleString('zh-TW')} · 1 {h.from} = {h.rate.toFixed(6)} {h.to}
                </span>
                <div className="row">
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setAmount(h.amount)
                      setFrom(h.from)
                      setTo(h.to)
                    }}
                  >
                    套用
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void copyText(`${h.amount} ${h.from} = ${h.result.toFixed(4)} ${h.to}`)}
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                  >
                    刪
                  </button>
                </div>
              </li>
            ))}
            {!filteredHistory.length && <p className="muted">尚無歷史，按「存入歷史」保留這次換算</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
