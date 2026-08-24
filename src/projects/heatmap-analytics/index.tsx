import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('heatmap-analytics')!

export default function Page() {
  const [clicks, setClicks] = useLocalStorage<{ x: number; y: number }[]>('lab:heatmap-analytics', [])
  const [mode, setMode] = useState<'collect' | 'heat'>('collect')

  const cells = useMemo(() => {
    const grid: number[][] = Array.from({ length: 12 }, () => Array.from({ length: 16 }, () => 0))
    clicks.forEach((c) => {
      const gx = Math.min(15, Math.floor(c.x * 16))
      const gy = Math.min(11, Math.floor(c.y * 12))
      grid[gy]![gx]!++
    })
    const max = Math.max(1, ...grid.flat())
    return { grid, max }
  }, [clicks])

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 8 }}>
        <button type="button" className={`btn sm ${mode === 'collect' ? 'accent' : 'ghost'}`} onClick={() => setMode('collect')}>
          收集點擊
        </button>
        <button type="button" className={`btn sm ${mode === 'heat' ? 'accent' : 'ghost'}`} onClick={() => setMode('heat')}>
          熱力圖
        </button>
        <span className="muted">點擊數 {clicks.length}</span>
        <button type="button" className="btn sm danger" onClick={() => setClicks([])}>
          重置
        </button>
      </div>
      <div
        className="panel"
        style={{ position: 'relative', height: 360, cursor: mode === 'collect' ? 'crosshair' : 'default', overflow: 'hidden' }}
        onClick={(e) => {
          if (mode !== 'collect') return
          const rect = e.currentTarget.getBoundingClientRect()
          setClicks((xs) => [...xs, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }])
        }}
      >
        <div style={{ padding: 24 }}>
          <h3>示範頁面</h3>
          <p className="muted">在收集模式下點擊各處，切換熱力圖查看密度。</p>
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
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gridTemplateRows: 'repeat(12, 1fr)', pointerEvents: 'none' }}>
            {cells.grid.flatMap((row, yi) =>
              row.map((v, xi) => (
                <div key={`${yi}-${xi}`} style={{ background: v ? `rgba(239,68,68,${0.15 + (v / cells.max) * 0.75})` : 'transparent' }} />
              )),
            )}
          </div>
        )}
        {mode === 'collect' &&
          clicks.slice(-40).map((c, i) => (
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
                background: '#f97316',
                opacity: 0.7,
                pointerEvents: 'none',
              }}
            />
          ))}
      </div>
    </ProjectShell>
  )
}
