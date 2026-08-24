import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('stock-watchlist')!

type Quote = {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
}

const PRESETS: { symbol: string; name: string; stooq: string }[] = [
  { symbol: 'AAPL', name: 'Apple', stooq: 'aapl.us' },
  { symbol: 'MSFT', name: 'Microsoft', stooq: 'msft.us' },
  { symbol: 'GOOGL', name: 'Alphabet', stooq: 'googl.us' },
  { symbol: 'AMZN', name: 'Amazon', stooq: 'amzn.us' },
  { symbol: 'TSLA', name: 'Tesla', stooq: 'tsla.us' },
  { symbol: 'NVDA', name: 'NVIDIA', stooq: 'nvda.us' },
  { symbol: '2330.TW', name: '台積電', stooq: '2330.tw' },
  { symbol: '2317.TW', name: '鴻海', stooq: '2317.tw' },
]

async function fetchStooq(stooq: string): Promise<{ price: number; open: number } | null> {
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${encodeURIComponent(stooq)}&f=sd2t2ohlcv&h&e=csv`,
    )
    const text = await res.text()
    const line = text.trim().split('\n')[1]
    if (!line || line.includes('N/D')) return null
    const parts = line.split(',')
    const open = Number(parts[3])
    const close = Number(parts[6])
    if (!Number.isFinite(close)) return null
    return { price: close, open: Number.isFinite(open) ? open : close }
  } catch {
    return null
  }
}

export default function Page() {
  const [watch, setWatch] = useLocalStorage<string[]>('lab:stock-watchlist', [
    'AAPL',
    'MSFT',
    '2330.TW',
  ])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const selected = PRESETS.filter((p) => watch.includes(p.symbol))
    const results = await Promise.all(
      selected.map(async (p) => {
        const q = await fetchStooq(p.stooq)
        if (!q) {
          return {
            symbol: p.symbol,
            name: p.name,
            price: 0,
            change: 0,
            changePct: 0,
          } satisfies Quote
        }
        const change = q.price - q.open
        const changePct = q.open ? (change / q.open) * 100 : 0
        return {
          symbol: p.symbol,
          name: p.name,
          price: q.price,
          change,
          changePct,
        }
      }),
    )
    setQuotes(results)
    setAsOf(new Date().toLocaleString())
    if (results.every((r) => r.price === 0)) setError('無法取得報價（網路或 CORS），請稍後再試')
    setLoading(false)
  }, [watch])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={() => void load()} disabled={loading}>
          {loading ? '更新中…' : '重新整理'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        資料來源：Stooq 日線收盤／開盤（延遲報價）
        {asOf && ` · ${asOf}`}
        {error && ` · ${error}`}
      </p>
      <div className="panel row" style={{ flexWrap: 'wrap', marginBottom: 12, gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            className={`btn sm ${watch.includes(p.symbol) ? 'accent' : 'ghost'}`}
            onClick={() =>
              setWatch((w) =>
                w.includes(p.symbol) ? w.filter((x) => x !== p.symbol) : [...w, p.symbol],
              )
            }
          >
            {p.symbol}
          </button>
        ))}
      </div>
      <div className="grid-2">
        {quotes.map((q) => (
          <div key={q.symbol} className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong className="mono">{q.symbol}</strong>
                <div className="muted">{q.name}</div>
              </div>
              <span
                className="tag"
                style={{
                  background: q.changePct >= 0 ? 'var(--teal-soft)' : 'var(--rose-soft)',
                }}
              >
                {q.changePct >= 0 ? '+' : ''}
                {q.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="metric mono" style={{ fontSize: 28 }}>
              {q.price ? q.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </div>
            <p className="muted">
              漲跌 {q.change >= 0 ? '+' : ''}
              {q.change.toFixed(2)}
            </p>
          </div>
        ))}
        {!quotes.length && <p className="muted">請選擇觀察清單</p>}
      </div>
    </ProjectShell>
  )
}
