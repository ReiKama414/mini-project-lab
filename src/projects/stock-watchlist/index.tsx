import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, limitText } from '../../lib/utils'

const meta = getProject('stock-watchlist')!

const NOTE_MAX = 120
const CACHE_KEY = 'lab:stock-watchlist:lastQuotes'

type Quote = {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  stale?: boolean
  asOf?: string
}

type CachedQuotes = { at: string; quotes: Quote[] }

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

function readCache(): CachedQuotes | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedQuotes
    if (!parsed?.quotes?.length) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(quotes: Quote[]) {
  const live = quotes.filter((q) => q.price > 0 && !q.stale)
  if (!live.length) return
  const payload: CachedQuotes = {
    at: new Date().toLocaleString('zh-TW'),
    quotes: live.map(({ symbol, name, price, change, changePct }) => ({ symbol, name, price, change, changePct })),
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

function parseStooqCsv(text: string): { price: number; open: number } | null {
  const line = text.trim().split('\n')[1]
  if (!line || line.includes('N/D')) return null
  const parts = line.split(',')
  const open = Number(parts[3])
  const close = Number(parts[6])
  if (!Number.isFinite(close)) return null
  return { price: close, open: Number.isFinite(open) ? open : close }
}

async function fetchStooqText(stooq: string): Promise<string | null> {
  const target = `https://stooq.com/q/l/?s=${encodeURIComponent(stooq)}&f=sd2t2ohlcv&h&e=csv`
  const attempts = [
    target,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?${encodeURIComponent(target)}`,
  ]
  for (const href of attempts) {
    try {
      const res = await fetch(href)
      if (!res.ok) continue
      const text = await res.text()
      if (text.trim() && parseStooqCsv(text)) return text
    } catch {
      /* try next */
    }
  }
  return null
}

async function fetchStooq(stooq: string): Promise<{ price: number; open: number } | null> {
  const text = await fetchStooqText(stooq)
  return text ? parseStooqCsv(text) : null
}

export default function Page() {
  const [watch, setWatch] = useLocalStorage<string[]>('lab:stock-watchlist', ['AAPL', 'MSFT', '2330.TW'])
  const [sortDesc, setSortDesc] = useLocalStorage('lab:stock-watchlist:sortDesc', true)
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('lab:stock-watchlist:notes', {})
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const cached = readCache()
    if (!cached) return []
    return cached.quotes
      .filter((q) => watch.includes(q.symbol))
      .map((q) => ({ ...q, stale: true, asOf: cached.at }))
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [asOf, setAsOf] = useState(() => readCache()?.at || '')
  const [failed, setFailed] = useState<string[]>([])
  const [usingCache, setUsingCache] = useState(() => Boolean(readCache()?.quotes.length))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const selected = PRESETS.filter((p) => watch.includes(p.symbol))
    const cached = readCache()
    const cacheMap = new Map((cached?.quotes || []).map((q) => [q.symbol, q]))
    const miss: string[] = []
    let anyLive = false

    const results = await Promise.all(
      selected.map(async (p) => {
        const q = await fetchStooq(p.stooq)
        if (q) {
          anyLive = true
          const change = q.price - q.open
          const changePct = q.open ? (change / q.open) * 100 : 0
          return {
            symbol: p.symbol,
            name: p.name,
            price: q.price,
            change,
            changePct,
            stale: false,
          } satisfies Quote
        }
        const prev = cacheMap.get(p.symbol)
        if (prev && prev.price > 0) {
          miss.push(p.symbol)
          return {
            ...prev,
            name: p.name,
            stale: true,
            asOf: cached?.at,
          } satisfies Quote
        }
        miss.push(p.symbol)
        return {
          symbol: p.symbol,
          name: p.name,
          price: 0,
          change: 0,
          changePct: 0,
          stale: true,
        } satisfies Quote
      }),
    )

    setQuotes(results)
    setFailed(miss)
    const now = new Date().toLocaleString('zh-TW')
    if (anyLive) {
      writeCache(results)
      setAsOf(now)
      setUsingCache(false)
      if (miss.length) {
        setError(`部分代號無法即時取得（已顯示上次已知）：${miss.join(', ')}`)
      }
    } else {
      setUsingCache(true)
      if (results.some((r) => r.price > 0)) {
        setAsOf(cached?.at || '—')
        setError('無法連線 Stooq（CORS／網路）。已改顯示本機上次已知報價。')
      } else {
        setError('無法取得報價，且沒有本機快取。請檢查網路後再試，或稍後重新整理。')
      }
    }
    setLoading(false)
  }, [watch])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    return [...quotes].sort((a, b) => (sortDesc ? b.changePct - a.changePct : a.changePct - b.changePct))
  }, [quotes, sortDesc])

  const winners = sorted.filter((q) => q.price > 0 && q.changePct > 0).length
  const losers = sorted.filter((q) => q.price > 0 && q.changePct < 0).length

  function exportCsv() {
    const rows = [
      'symbol,name,price,change,changePct,note,stale',
      ...sorted.map((q) =>
        [
          q.symbol,
          q.name,
          q.price,
          q.change.toFixed(4),
          q.changePct.toFixed(4),
          JSON.stringify(notes[q.symbol] || ''),
          q.stale ? '1' : '0',
        ].join(','),
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
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        Stooq 延遲日線；若直連失敗會改走 CORS 代理，仍失敗則顯示本機上次已知報價（不會空白 silently）。
        {asOf && ` · ${usingCache ? '快取' : '更新'}於 ${asOf}`}
      </p>
      {error && (
        <p className="panel" style={{ marginBottom: 12, fontSize: 13, background: 'var(--amber-soft)', color: '#8a5b00' }}>
          {error}
        </p>
      )}

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">觀察 {watch.length}</div>
        <div className="metric panel">
          上漲 {winners} · 下跌 {losers}
        </div>
        <div className="metric panel">
          {usingCache ? '離線／上次已知' : failed.length ? `部分失敗 ${failed.join(', ')}` : '報價正常'}
        </div>
      </div>

      <div className="panel row" style={{ flexWrap: 'wrap', marginBottom: 12, gap: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            className={`btn sm ${watch.includes(p.symbol) ? 'accent' : 'ghost'}`}
            onClick={() => setWatch((w) => (w.includes(p.symbol) ? w.filter((x) => x !== p.symbol) : [...w, p.symbol]))}
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
              <div className="row">
                {q.stale && q.price > 0 && (
                  <span className="tag" style={{ background: 'var(--amber-soft)', color: '#8a5b00' }}>
                    上次已知
                  </span>
                )}
                <span
                  className="tag"
                  style={{
                    background: q.price <= 0 ? 'var(--bg-muted)' : q.changePct >= 0 ? 'var(--teal-soft)' : 'var(--rose-soft)',
                  }}
                >
                  {q.price <= 0 ? '無資料' : `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%`}
                </span>
              </div>
            </div>
            <div className="metric mono" style={{ fontSize: 28 }}>
              {q.price ? q.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {q.price
                ? `漲跌 ${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}${q.stale && q.asOf ? ` · 快取 ${q.asOf}` : ''}`
                : '無法取得此代號報價'}
            </p>
            {q.price > 0 && (
              <div className="progress">
                <span
                  style={{
                    width: `${Math.min(100, Math.abs(q.changePct) * 10 + 8)}%`,
                    background: q.changePct >= 0 ? 'var(--teal)' : 'var(--rose)',
                  }}
                />
              </div>
            )}
            <input
              className="field"
              placeholder="備註（本機）"
              value={notes[q.symbol] || ''}
              maxLength={NOTE_MAX}
              onChange={(e) => setNotes((n) => ({ ...n, [q.symbol]: limitText(e.target.value, NOTE_MAX) }))}
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
              disabled={!q.price}
              onClick={() => copyText(`${q.symbol} ${q.price} (${q.changePct.toFixed(2)}%)`)}
            >
              複製報價
            </button>
          </div>
        ))}
        {!sorted.length && !loading && <p className="muted">請選擇觀察清單</p>}
        {loading && !sorted.length && <p className="muted">載入報價中…</p>}
      </div>
    </ProjectShell>
  )
}
