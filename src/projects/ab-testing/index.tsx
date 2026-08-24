import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('ab-testing')!

type Variant = 'A' | 'B'

function zApprox(p1: number, n1: number, p2: number, n2: number) {
  if (n1 < 5 || n2 < 5) return null
  const p = (p1 * n1 + p2 * n2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  if (se === 0) return 0
  return Math.abs(p1 - p2) / se
}

export default function Page() {
  const [content, setContent] = useLocalStorage('lab:ab-testing:content', {
    A: { title: '立即開始', body: '經典 CTA 文案，強調行動。' },
    B: { title: '免費試用 14 天', body: '強調零風險試用的變體。' },
  })
  const [split, setSplit] = useLocalStorage('lab:ab-testing:split', 50)
  const [impressions, setImpressions] = useLocalStorage<Record<Variant, number>>('lab:ab-testing:imp', { A: 120, B: 118 })
  const [conversions, setConversions] = useLocalStorage<Record<Variant, number>>('lab:ab-testing:conv', { A: 18, B: 27 })
  const [assigned, setAssigned] = useLocalStorage<Variant | null>('lab:ab-testing:you', null)

  const rates = useMemo(
    () => ({
      A: impressions.A ? conversions.A / impressions.A : 0,
      B: impressions.B ? conversions.B / impressions.B : 0,
    }),
    [impressions, conversions],
  )

  const z = useMemo(() => zApprox(rates.A, impressions.A, rates.B, impressions.B), [rates, impressions])
  const hint =
    z === null
      ? '樣本不足，尚無法判斷顯著性'
      : z >= 1.96
        ? `近似 z=${z.toFixed(2)} ≥ 1.96 → 可能有顯著差異（簡化提示）`
        : `近似 z=${z.toFixed(2)} < 1.96 → 差異可能尚不顯著`

  function enterRandom() {
    const v: Variant = Math.random() * 100 < split ? 'A' : 'B'
    setAssigned(v)
    setImpressions((x) => ({ ...x, [v]: x[v] + 1 }))
  }

  function enter(v: Variant) {
    setAssigned(v)
    setImpressions((x) => ({ ...x, [v]: x[v] + 1 }))
  }

  function convert() {
    if (!assigned) return
    setConversions((x) => ({ ...x, [assigned]: x[assigned] + 1 }))
  }

  function reset() {
    setImpressions({ A: 0, B: 0 })
    setConversions({ A: 0, B: 0 })
    setAssigned(null)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm danger" onClick={reset}>
          重置數據
        </button>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <label className="label">流量分配 · A {split}% / B {100 - split}%</label>
        <input type="range" min={10} max={90} value={split} onChange={(e) => setSplit(Number(e.target.value))} />
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        {(['A', 'B'] as Variant[]).map((v) => (
          <div key={v} className="panel stack">
            <strong>Variant {v}</strong>
            <input
              className="field"
              value={content[v].title}
              onChange={(e) => setContent((c) => ({ ...c, [v]: { ...c[v], title: e.target.value } }))}
            />
            <textarea
              className="field"
              rows={2}
              value={content[v].body}
              onChange={(e) => setContent((c) => ({ ...c, [v]: { ...c[v], body: e.target.value } }))}
            />
            <div className="metric">
              曝光 {impressions[v]} · 轉換 {conversions[v]} · {(rates[v] * 100).toFixed(1)}%
            </div>
            <div className="progress">
              <div
                style={{
                  width: `${Math.min(100, rates[v] * 100)}%`,
                  height: 8,
                  borderRadius: 4,
                  background: v === 'A' ? 'var(--sky)' : 'var(--teal)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="panel stack">
        <p className="muted">{hint}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={enterRandom}>
            依流量分配進入
          </button>
          <button type="button" className="btn ghost" onClick={() => enter('A')}>
            強制 A
          </button>
          <button type="button" className="btn ghost" onClick={() => enter('B')}>
            強制 B
          </button>
          <button type="button" className="btn teal" disabled={!assigned} onClick={convert}>
            模擬轉換
          </button>
        </div>
        {assigned && (
          <div className="list-item" style={{ background: assigned === 'A' ? 'var(--sky-soft)' : 'var(--teal-soft)' }}>
            <h3 style={{ margin: 0 }}>{content[assigned].title}</h3>
            <p className="muted">{content[assigned].body}</p>
            <span className="tag">目前變體 {assigned}</span>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
