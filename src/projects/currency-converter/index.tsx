import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'

const meta = getProject('currency-converter')!

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

export default function Page() {
  const [amount, setAmount] = useState(1000)
  const [from, setFrom] = useState('TWD')
  const [to, setTo] = useState('USD')
  const [rates, setRates] = useState(FALLBACK)
  const [asOf, setAsOf] = useState('示範匯率')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const codes = useMemo(() => Object.keys(rates), [rates])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD')
      if (!res.ok) throw new Error('無法取得匯率')
      const data = (await res.json()) as { date: string; rates: Record<string, number> }
      const next: Record<string, number> = { USD: 1, ...data.rates }
      // keep TWD if API misses it (Frankfurter often has no TWD) — blend fallback
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
    const usd = amount / rates[from]!
    return usd * rates[to]!
  }, [amount, from, to, rates])

  const rateText = useMemo(() => {
    const one = (1 / rates[from]!) * rates[to]!
    return `1 ${from} = ${one.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}`
  }, [from, to, rates])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={() => void load()} disabled={loading}>
          {loading ? '更新中…' : '重新抓匯率'}
        </button>
      }
    >
      <div className="panel stack">
        <p className="muted">
          {asOf}
          {error && ` · ${error}`}
        </p>
        <label className="stack">
          <span className="label">金額</span>
          <input
            className="field"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
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
        <div className="row">
          <button
            className="btn ghost sm"
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
          >
            ⇄ 交換
          </button>
          <span className="muted mono">{rateText}</span>
        </div>
        <div className="metric">
          <div className="muted">換算結果</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
          </div>
        </div>
        <button
          className="btn ghost"
          onClick={() => void copyText(`${amount} ${from} = ${result.toFixed(4)} ${to}`)}
        >
          複製結果
        </button>
      </div>
    </ProjectShell>
  )
}
