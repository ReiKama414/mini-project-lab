import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText } from '../../lib/utils'

const meta = getProject('heatmap-analytics')!

type Point = { x: number; y: number; device: Device; at: number }
type Device = 'desktop' | 'tablet' | 'mobile'

export default function Page() {
  const [clicks, setClicks] = useLocalStorage<Point[]>('lab:heatmap-analytics', [])
  const [mode, setMode] = useState<'collect' | 'heat'>('collect')
  const [device, setDevice] = useLocalStorage<Device>('lab:heatmap-analytics:device', 'desktop')
  const [intensity, setIntensity] = useLocalStorage('lab:heatmap-analytics:intensity', 70)

  const filtered = useMemo(() => clicks.filter((c) => c.device === device), [clicks, device])

  const cells = useMemo(() => {
    const cols = 16
    const rows = 12
    const grid: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
    filtered.forEach((c) => {
      const gx = Math.min(cols - 1, Math.floor(c.x * cols))
      const gy = Math.min(rows - 1, Math.floor(c.y * rows))
      grid[gy]![gx]!++
    })
    const max = Math.max(1, ...grid.flat())
    return { grid, max, cols, rows }
  }, [filtered])

  const frameW = device === 'desktop' ? '100%' : device === 'tablet' ? 520 : 340

  function exportPoints() {
    downloadText(
      `heatmap-${device}.json`,
      JSON.stringify(filtered, null, 2),
      'application/json;charset=utf-8',
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={exportPoints}>
            匯出點位
          </button>
          <button type="button" className="btn sm danger" onClick={() => setClicks([])}>
            清空全部
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <button type="button" className={`btn sm ${mode === 'collect' ? 'accent' : 'ghost'}`} onClick={() => setMode('collect')}>
          收集點擊
        </button>
        <button type="button" className={`btn sm ${mode === 'heat' ? 'accent' : 'ghost'}`} onClick={() => setMode('heat')}>
          熱力圖
        </button>
        {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
          <button key={d} type="button" className={`btn sm ${device === d ? 'teal' : 'ghost'}`} onClick={() => setDevice(d)}>
            {d}
          </button>
        ))}
        <span className="muted">點擊 {filtered.length}</span>
        <label className="label" style={{ margin: 0 }}>
          強度 {intensity}%
        </label>
        <input type="range" min={20} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
      </div>

      <div style={{ width: frameW, maxWidth: '100%', margin: '0 auto' }}>
        <div className="panel row" style={{ padding: '6px 12px', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <span className="tag">● ● ●</span>
          <span className="mono muted" style={{ flex: 1, textAlign: 'center' }}>
            {device} preview
          </span>
        </div>
        <div
          className="panel"
          style={{
            position: 'relative',
            height: device === 'mobile' ? 480 : 360,
            cursor: mode === 'collect' ? 'crosshair' : 'default',
            overflow: 'hidden',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginTop: 0,
          }}
          onClick={(e) => {
            if (mode !== 'collect') return
            const rect = e.currentTarget.getBoundingClientRect()
            setClicks((xs) => [
              ...xs,
              {
                x: (e.clientX - rect.left) / rect.width,
                y: (e.clientY - rect.top) / rect.height,
                device,
                at: Date.now(),
              },
            ])
          }}
        >
          <div style={{ padding: 24 }}>
            <h3 style={{ marginTop: 0 }}>示範頁面</h3>
            <p className="muted">在收集模式下點擊；切換裝置會分開累積熱區。</p>
            <div className="row">
              <button type="button" className="btn accent">
                主要 CTA
              </button>
              <button type="button" className="btn ghost">
                次要
              </button>
            </div>
          </div>
          {mode === 'heat' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${cells.cols}, 1fr)`,
                gridTemplateRows: `repeat(${cells.rows}, 1fr)`,
                pointerEvents: 'none',
              }}
            >
              {cells.grid.flatMap((row, yi) =>
                row.map((v, xi) => {
                  const alpha = v ? (0.12 + (v / cells.max) * 0.7) * (intensity / 100) : 0
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
            filtered.slice(-50).map((c, i) => (
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
    </ProjectShell>
  )
}
