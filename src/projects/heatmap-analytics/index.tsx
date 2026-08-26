import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, downloadText } from '../../lib/utils'

const meta = getProject('heatmap-analytics')!

type Point = { x: number; y: number; device: Device; page: PageId; at: number; label?: string }
type Device = 'desktop' | 'tablet' | 'mobile'
type PageId = 'home' | 'pricing' | 'docs'

const PAGES: { id: PageId; title: string; blurb: string }[] = [
  { id: 'home', title: '首頁', blurb: '品牌與主要 CTA。' },
  { id: 'pricing', title: '方案', blurb: '價格與升級按鈕。' },
  { id: 'docs', title: '文件', blurb: '導覽與搜尋欄。' },
]

const COLS = 24
const ROWS = 18

export default function Page() {
  const [clicks, setClicks] = useLocalStorage<Point[]>('lab:heatmap-analytics:v2', [])
  const [mode, setMode] = useState<'collect' | 'heat'>('collect')
  const [device, setDevice] = useLocalStorage<Device>('lab:heatmap-analytics:device', 'desktop')
  const [page, setPage] = useLocalStorage<PageId>('lab:heatmap-analytics:page', 'home')
  const [intensity, setIntensity] = useLocalStorage('lab:heatmap-analytics:intensity', 70)

  const filtered = useMemo(
    () => clicks.filter((c) => c.device === device && c.page === page),
    [clicks, device, page],
  )

  const cells = useMemo(() => {
    const grid: number[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0))
    filtered.forEach((c) => {
      const gx = Math.min(COLS - 1, Math.floor(c.x * COLS))
      const gy = Math.min(ROWS - 1, Math.floor(c.y * ROWS))
      grid[gy]![gx]!++
    })
    const max = Math.max(1, ...grid.flat())
    return { grid, max }
  }, [filtered])

  const hotspots = useMemo(() => {
    const buckets = new Map<string, number>()
    filtered.forEach((c) => {
      const key = `${Math.floor(c.x * 12)},${Math.floor(c.y * 9)}`
      buckets.set(key, (buckets.get(key) || 0) + 1)
    })
    return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [filtered])

  const pageMeta = PAGES.find((p) => p.id === page)!
  const frameW = device === 'desktop' ? '100%' : device === 'tablet' ? 520 : 340

  function addPoint(x: number, y: number, label?: string) {
    setClicks((xs) => [...xs, { x, y, device, page, at: Date.now(), label }])
  }

  function exportPoints() {
    downloadText(
      `heatmap-${page}-${device}.json`,
      JSON.stringify(
        {
          page,
          device,
          intensity,
          grid: `${COLS}x${ROWS}`,
          count: filtered.length,
          exportedAt: new Date().toISOString(),
          points: filtered,
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    )
  }

  function clearPageDevice() {
    setClicks((xs) => xs.filter((c) => !(c.device === device && c.page === page)))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={exportPoints}>
            匯出 JSON
          </button>
          <button type="button" className="btn sm ghost" onClick={clearPageDevice}>
            清空此頁/裝置
          </button>
          <button type="button" className="btn sm danger" onClick={() => setClicks([])}>
            清空全部
          </button>
        </div>
      }
    >
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機模擬／示範：點擊熱點僅在此瀏覽器累積，非正式產品熱力分析。
      </p>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" className={`btn sm ${mode === 'collect' ? 'accent' : 'ghost'}`} onClick={() => setMode('collect')}>
          收集點擊
        </button>
        <button type="button" className={`btn sm ${mode === 'heat' ? 'accent' : 'ghost'}`} onClick={() => setMode('heat')}>
          熱力圖
        </button>
        {PAGES.map((p) => (
          <button key={p.id} type="button" className={`btn sm ${page === p.id ? 'teal' : 'ghost'}`} onClick={() => setPage(p.id)}>
            {p.title}
          </button>
        ))}
        {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
          <button key={d} type="button" className={`btn sm ${device === d ? 'accent' : 'ghost'}`} onClick={() => setDevice(d)}>
            {d}
          </button>
        ))}
        <span className="muted">點擊 {filtered.length}</span>
        <label className="label" style={{ margin: 0 }}>
          強度 {intensity}%
        </label>
        <input
          type="range"
          min={20}
          max={100}
          value={clamp(intensity, 20, 100)}
          onChange={(e) => setIntensity(clamp(Number(e.target.value) || 70, 20, 100))}
        />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div style={{ width: frameW, maxWidth: '100%', margin: '0 auto' }}>
          <div className="panel row" style={{ padding: '6px 12px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            <span className="tag">● ● ●</span>
            <span className="mono muted" style={{ flex: 1, textAlign: 'center' }}>
              {pageMeta.title} · {device} · {COLS}×{ROWS}
            </span>
          </div>
          <div
            className="panel"
            style={{
              position: 'relative',
              height: device === 'mobile' ? 480 : 360,
              cursor: 'crosshair',
              overflow: 'hidden',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              marginTop: 0,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            onMouseDown={(e) => {
              // 避免連點／拖曳時選取到示範文案
              e.preventDefault()
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const target = (e.target as HTMLElement).closest('[data-hot]') as HTMLElement | null
              addPoint((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, target?.dataset.hot)
            }}
          >
            <div style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>{pageMeta.title}</h3>
              <p className="muted">{pageMeta.blurb} 點擊可新增熱點（收集與熱力模式皆可）。</p>
              {page === 'home' && (
                <div className="row">
                  <span className="btn accent" data-hot="cta-primary">
                    開始使用
                  </span>
                  <span className="btn ghost" data-hot="cta-secondary">
                    瞭解更多
                  </span>
                </div>
              )}
              {page === 'pricing' && (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {['Free', 'Pro', 'Business'].map((plan) => (
                    <div key={plan} className="list-item" data-hot={`plan-${plan}`} style={{ minWidth: 100 }}>
                      {plan}
                    </div>
                  ))}
                </div>
              )}
              {page === 'docs' && (
                <>
                  <div className="field" data-hot="search" style={{ color: 'var(--ink-muted)' }}>
                    搜尋文件…
                  </div>
                  <div className="list-item" style={{ marginTop: 12 }} data-hot="nav-quickstart">
                    快速入門
                  </div>
                </>
              )}
            </div>
            {mode === 'heat' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                  pointerEvents: 'none',
                }}
              >
                {cells.grid.flatMap((row, yi) =>
                  row.map((v, xi) => {
                    const alpha = v ? (0.1 + (v / cells.max) * 0.75) * (intensity / 100) : 0
                    return (
                      <div
                        key={`${yi}-${xi}`}
                        style={{ background: v ? `rgba(214, 64, 106, ${alpha})` : 'transparent' }}
                      />
                    )
                  }),
                )}
              </div>
            )}
            {mode === 'collect' &&
              filtered.slice(-80).map((c, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    width: 8,
                    height: 8,
                    margin: -4,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    opacity: 0.75,
                    pointerEvents: 'none',
                  }}
                />
              ))}
          </div>
        </div>

        <div className="panel stack">
          <div className="label">熱點摘要 · {pageMeta.title}</div>
          <div className="metric">最大格密度 {cells.max}</div>
          <ul className="list">
            {hotspots.map(([key, n]) => (
              <li key={key} className="list-item row" style={{ justifyContent: 'space-between' }}>
                <span className="mono muted">cell {key}</span>
                <strong>{n}</strong>
              </li>
            ))}
            {!hotspots.length && <li className="list-item muted">尚無點擊 — 點畫面新增熱點</li>}
          </ul>
          <p className="muted" style={{ fontSize: 12 }}>
            網格 {COLS}×{ROWS}；依頁面與裝置分開累積。
          </p>
        </div>
      </div>
    </ProjectShell>
  )
}
