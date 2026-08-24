import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('crypto-dashboard')!

type Coin = {
  id: string
  symbol: string
  name: string
  price: number
  change: number
}

type SortKey = 'watch' | 'change' | 'price' | 'name'

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
  const [sort, setSort] = useLocalStorage<SortKey>('lab:crypto-dashboard:sort', 'change')
  const [coins, setCoins] = useState<Coin[]>([])
  const [prevPrices, setPrevPrices] = useLocalStorage<Record<string, number>>('lab:crypto-dashboard:prev', {})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState('')
  const [auto, setAuto] = useLocalStorage('lab:crypto-dashboard:auto', true)

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
      const next = CATALOG.map((c) => ({
        ...c,
        price: data[c.id]?.usd ?? 0,
        change: Number((data[c.id]?.usd_24h_change ?? 0).toFixed(2)),
      }))
      setCoins(next)
      setPrevPrices((p) => {
        const o = { ...p }
        for (const c of next) if (c.price) o[c.id] = c.price
        return o
      })
      setAsOf(new Date().toLocaleTimeString('zh-TW'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗（可能被限流）')
    } finally {
      setLoading(false)
    }
  }, [setPrevPrices])

  useEffect(() => {
    void load()
    if (!auto) return
    const id = setInterval(() => void load(), 60000)
    return () => clearInterval(id)
  }, [load, auto])

  const shown = useMemo(() => {
    const list = coins.filter((c) => watch.includes(c.id))
    return [...list].sort((a, b) => {
      if (sort === 'change') return b.change - a.change
      if (sort === 'price') return b.price - a.price
      if (sort === 'name') return a.symbol.localeCompare(b.symbol)
      return watch.indexOf(a.id) - watch.indexOf(b.id)
    })
  }, [coins, watch, sort])

  const avgChange = useMemo(() => {
    if (!shown.length) return 0
    return shown.reduce((s, c) => s + c.change, 0) / shown.length
  }, [shown])

  function toggle(id: string) {
    setWatch((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className={`btn sm ${auto ? 'teal' : 'ghost'}`} onClick={() => setAuto((v) => !v)}>
            {auto ? '自動更新 ON' : '自動更新 OFF'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        資料來源：CoinGecko 公開 API
        {asOf && ` · 更新於 ${asOf}`}
        {error && ` · ${error}`}
      </p>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">追蹤 {watch.length} 幣</div>
        <div className="metric panel">平均 24h {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%</div>
        <div className="metric panel">{loading ? '載入中…' : coins.length ? '報價就緒' : '尚無資料'}</div>
      </div>

      <div className="panel row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {CATALOG.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn sm ${watch.includes(c.id) ? 'accent' : 'ghost'}`}
            onClick={() => toggle(c.id)}
          >
            {c.symbol}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="muted">排序</span>
        {(
          [
            ['watch', '清單順序'],
            ['change', '漲跌'],
            ['price', '價格'],
            ['name', '代號'],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" className={`btn sm ${sort === k ? 'accent' : 'ghost'}`} onClick={() => setSort(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid-3">
        {shown.map((c) => {
          const prev = prevPrices[c.id]
          const tick = prev && c.price ? ((c.price - prev) / prev) * 100 : 0
          return (
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
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  相對上次記憶價 {tick ? `${tick >= 0 ? '+' : ''}${tick.toFixed(3)}%` : '—'}
                </span>
                <button type="button" className="btn sm ghost" onClick={() => copyText(`${c.symbol} $${c.price}`)}>
                  複製
                </button>
              </div>
            </div>
          )
        })}
        {!shown.length && <p className="muted">請選擇要追蹤的幣種</p>}
      </div>
    </ProjectShell>
  )
}
