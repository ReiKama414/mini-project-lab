import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('crypto-dashboard')!

type Coin = {
  id: string
  symbol: string
  name: string
  price: number
  change: number
}

const CATALOG: { id: string; symbol: string; name: string }[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
]

export default function Page() {
  const [watch, setWatch] = useLocalStorage<string[]>('lab:crypto-dashboard', [
    'bitcoin',
    'ethereum',
    'solana',
  ])
  const [coins, setCoins] = useState<Coin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const ids = CATALOG.map((c) => c.id).join(',')
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      )
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>
      setCoins(
        CATALOG.map((c) => ({
          ...c,
          price: data[c.id]?.usd ?? 0,
          change: Number((data[c.id]?.usd_24h_change ?? 0).toFixed(2)),
        })),
      )
      setAsOf(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60000)
    return () => clearInterval(id)
  }, [load])

  const shown = coins.filter((c) => watch.includes(c.id))

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
        資料來源：CoinGecko 公開 API
        {asOf && ` · 更新於 ${asOf}`}
        {error && ` · ${error}`}
      </p>
      <div className="panel row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {CATALOG.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn sm ${watch.includes(c.id) ? 'accent' : 'ghost'}`}
            onClick={() =>
              setWatch((w) =>
                w.includes(c.id) ? w.filter((x) => x !== c.id) : [...w, c.id],
              )
            }
          >
            {c.symbol}
          </button>
        ))}
      </div>
      <div className="grid-3">
        {shown.map((c) => (
          <div key={c.id} className="panel metric stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {c.symbol} <span className="muted">{c.name}</span>
              </strong>
              <span
                className="tag"
                style={{
                  background: c.change >= 0 ? 'var(--teal-soft)' : 'var(--rose-soft)',
                  color: c.change >= 0 ? '#16665c' : '#9a1f45',
                }}
              >
                {c.change >= 0 ? '+' : ''}
                {c.change}%
              </span>
            </div>
            <div style={{ fontSize: 28 }} className="mono">
              ${c.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </div>
            <div className="progress">
              <span
                style={{
                  width: `${Math.min(100, Math.abs(c.change) * 8 + 20)}%`,
                  background: c.change >= 0 ? 'var(--teal)' : 'var(--rose)',
                }}
              />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>
              24h 漲跌
            </span>
          </div>
        ))}
        {!shown.length && <p className="muted">請選擇要追蹤的幣種</p>}
      </div>
    </ProjectShell>
  )
}
