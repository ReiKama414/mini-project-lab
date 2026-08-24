import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('ab-testing')!

type Variant = 'A' | 'B'

export default function Page() {
  const [impressions, setImpressions] = useLocalStorage<Record<Variant, number>>('lab:ab-testing:imp', { A: 120, B: 118 })
  const [conversions, setConversions] = useLocalStorage<Record<Variant, number>>('lab:ab-testing:conv', { A: 18, B: 27 })
  const [assigned, setAssigned] = useLocalStorage<Variant | null>('lab:ab-testing:you', null)

  const rates = useMemo(
    () => ({
      A: impressions.A ? ((conversions.A / impressions.A) * 100).toFixed(1) : '0',
      B: impressions.B ? ((conversions.B / impressions.B) * 100).toFixed(1) : '0',
    }),
    [impressions, conversions],
  )

  function enter(v: Variant) {
    setAssigned(v)
    setImpressions((x) => ({ ...x, [v]: x[v] + 1 }))
  }

  function convert() {
    if (!assigned) return
    setConversions((x) => ({ ...x, [assigned]: x[assigned] + 1 }))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2" style={{ marginBottom: 12 }}>
        {(['A', 'B'] as Variant[]).map((v) => (
          <div key={v} className="panel metric stack">
            <strong>Variant {v}</strong>
            <div>曝光 {impressions[v]}</div>
            <div>轉換 {conversions[v]}</div>
            <div style={{ fontSize: 28 }}>{rates[v]}%</div>
            <div className="progress">
              <div style={{ width: `${rates[v]}%`, height: 8, borderRadius: 4, background: v === 'A' ? '#60a5fa' : '#34d399' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="panel stack">
        <div className="label">體驗測試</div>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => enter('A')}>
            進入 A
          </button>
          <button type="button" className="btn ghost" onClick={() => enter('B')}>
            進入 B
          </button>
          <button type="button" className="btn accent" disabled={!assigned} onClick={convert}>
            模擬轉換
          </button>
        </div>
        {assigned && (
          <div className="list-item" style={{ background: assigned === 'A' ? '#1e3a5f' : '#14532d' }}>
            <h3 style={{ margin: 0 }}>{assigned === 'A' ? '立即開始' : '免費試用 14 天'}</h3>
            <p className="muted">{assigned === 'A' ? '經典 CTA 文案' : '強調零風險試用的變體'}</p>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
