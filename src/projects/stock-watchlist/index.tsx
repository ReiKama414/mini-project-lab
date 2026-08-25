import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, limitText } from '../../lib/utils'

const meta = getProject('stock-watchlist')!

const NOTE_MAX = 120

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
  const [sortDesc, setSortDesc] = useLocalStorage('lab:stock-watchlist:sortDesc', true)
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('lab:stock-watchlist:notes', {})
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState('')
  const [failed, setFailed] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const selected = PRESETS.filter((p) => watch.includes(p.symbol))
    const miss: string[] = []
    const results = await Promise.all(
      selected.map(async (p) => {
        const q = await fetchStooq(p.stooq)
        if (!q) {
          miss.push(p.symbol)
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
    setFailed(miss)
    setAsOf(new Date().toLocaleString('zh-TW'))
    if (results.length && results.every((r) => r.price === 0)) {
      setError('無法取得報價（網路或 CORS），請稍後再試')
    }
    setLoading(false)
  }, [watch])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    return [...quotes].sort((a, b) => (sortDesc ? b.changePct - a.changePct : a.changePct - b.changePct))
  }, [quotes, sortDesc])

  const winners = sorted.filter((q) => q.changePct > 0).length
  const losers = sorted.filter((q) => q.changePct < 0).length

  function exportCsv() {
    const rows = [
      'symbol,name,price,change,changePct,note',
      ...sorted.map((q) =>
        [q.symbol, q.name, q.price, q.change.toFixed(4), q.changePct.toFixed(4), JSON.stringify(notes[q.symbol] || '')].join(','),
      ),
    ]
    downloadText(`watchlist-${Date.now()}.csv`, rows.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={exportCsv} disabled={!sorted.length}>
            匯出 CSV
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void load()} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        資料來源：Stooq 日線收盤／開盤（延遲報價）
        {asOf && ` · ${asOf}`}
        {error && ` · ${error}`}
      </p>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">觀察 {watch.length}</div>
        <div className="metric panel">上漲 {winners} · 下跌 {losers}</div>
        <div className="metric panel">{failed.length ? `失敗 ${failed.join(', ')}` : '報價正常'}</div>
      </div>

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
        <button type="button" className="btn sm ghost" onClick={() => setSortDesc((v) => !v)}>
          漲跌排序 {sortDesc ? '↓' : '↑'}
        </button>
      </div>

      <div className="grid-2">
        {sorted.map((q) => (
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
            <p className="muted" style={{ margin: 0 }}>
              漲跌 {q.change >= 0 ? '+' : ''}
              {q.change.toFixed(2)}
            </p>
            <div className="progress">
              <span
                style={{
                  width: `${Math.min(100, Math.abs(q.changePct) * 10 + 8)}%`,
                  background: q.changePct >= 0 ? 'var(--teal)' : 'var(--rose)',
                }}
              />
            </div>
            <input
              className="field"
              placeholder="備註（本機）"
              value={notes[q.symbol] || ''}
              maxLength={NOTE_MAX}
              onChange={(e) =>
                setNotes((n) => ({ ...n, [q.symbol]: limitText(e.target.value, NOTE_MAX) }))
              }
            />
            <div className="field-meta">
              <span className="field-hint">備註</span>
              <span>
                {charCount(notes[q.symbol] || '')} / {NOTE_MAX}
              </span>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => copyText(`${q.symbol} ${q.price} (${q.changePct.toFixed(2)}%)`)}
            >
              複製報價
            </button>
          </div>
        ))}
        {!sorted.length && <p className="muted">請選擇觀察清單</p>}
      </div>
    </ProjectShell>
  )
}
