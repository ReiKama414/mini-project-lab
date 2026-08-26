import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('ab-testing')!

const TITLE_MAX = 80
const BODY_MAX = 400
const COUNT_MAX = 1_000_000

type Variant = 'A' | 'B'
type Snapshot = {
  id: string
  at: number
  impressions: Record<Variant, number>
  conversions: Record<Variant, number>
  rates: Record<Variant, number>
  lift: number | null
  z: number | null
  winner: Variant | '平手' | null
}

/** 每組建議最小曝光（經驗值，約可支撐粗略比較） */
const MIN_SAMPLE = 100

function zApprox(p1: number, n1: number, p2: number, n2: number) {
  if (n1 < 5 || n2 < 5) return null
  const p = (p1 * n1 + p2 * n2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  if (se === 0) return 0
  return Math.abs(p1 - p2) / se
}

function pickWinner(rates: Record<Variant, number>, z: number | null): Variant | '平手' | null {
  if (z === null) return null
  if (Math.abs(rates.A - rates.B) < 1e-9) return '平手'
  if (z < 1.96) return null
  return rates.B > rates.A ? 'B' : 'A'
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
  const [history, setHistory] = useLocalStorage<Snapshot[]>('lab:ab-testing:history', [])
  const [showHistory, setShowHistory] = useLocalStorage('lab:ab-testing:showHistory', true)
  const [editMode, setEditMode] = useState(false)
  const [numError, setNumError] = useState('')

  const rates = useMemo(
    () => ({
      A: impressions.A ? conversions.A / impressions.A : 0,
      B: impressions.B ? conversions.B / impressions.B : 0,
    }),
    [impressions, conversions],
  )

  const z = useMemo(() => zApprox(rates.A, impressions.A, rates.B, impressions.B), [rates, impressions])
  const lift = useMemo(() => {
    if (!rates.A) return rates.B ? 100 : null
    return ((rates.B - rates.A) / rates.A) * 100
  }, [rates])
  const winner = useMemo(() => pickWinner(rates, z), [rates, z])

  const sampleHint = useMemo(() => {
    const needA = Math.max(0, MIN_SAMPLE - impressions.A)
    const needB = Math.max(0, MIN_SAMPLE - impressions.B)
    if (needA === 0 && needB === 0) {
      return `兩邊皆達建議樣本（≥ ${MIN_SAMPLE}）。可依 z-score 評估是否停止實驗。`
    }
    const parts: string[] = []
    if (needA) parts.push(`A 還差約 ${needA} 次曝光`)
    if (needB) parts.push(`B 還差約 ${needB} 次曝光`)
    return `建議每組至少 ${MIN_SAMPLE} 次曝光以降低偶然波動。${parts.join('；')}。`
  }, [impressions])

  const hint =
    z === null
      ? '樣本不足，尚無法判斷顯著性'
      : z >= 1.96
        ? `近似 z=${z.toFixed(2)} ≥ 1.96 → 可能有顯著差異`
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

  function snapshot() {
    setHistory((h) =>
      [
        {
          id: uid('ab'),
          at: Date.now(),
          impressions: { ...impressions },
          conversions: { ...conversions },
          rates: { ...rates },
          lift,
          z,
          winner,
        },
        ...h,
      ].slice(0, 20),
    )
  }

  function reset() {
    snapshot()
    setImpressions({ A: 0, B: 0 })
    setConversions({ A: 0, B: 0 })
    setAssigned(null)
  }

  function setImp(v: Variant, raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setNumError('請輸入有效數字')
      return
    }
    setNumError('')
    const clamped = clamp(Math.floor(n), 0, COUNT_MAX)
    setImpressions((x) => ({ ...x, [v]: clamped }))
    setConversions((c) => ({ ...c, [v]: Math.min(c[v], clamped) }))
  }

  function setConv(v: Variant, raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setNumError('請輸入有效數字')
      return
    }
    setNumError('')
    const clamped = clamp(Math.floor(n), 0, impressions[v])
    setConversions((x) => ({ ...x, [v]: clamped }))
  }

  const contentOk = (['A', 'B'] as Variant[]).every(
    (v) => isNonEmpty(content[v].title) && isNonEmpty(content[v].body),
  )

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? '隱藏歷史' : '顯示歷史'}
          </button>
          <button type="button" className="btn sm ghost" onClick={snapshot}>
            存快照
          </button>
          <button type="button" className="btn sm danger" onClick={reset}>
            重置數據
          </button>
        </div>
      }
    >
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機模擬／示範：曝光與轉換為本機計數，z-score 僅供粗略示意，非正式實驗平台。
      </p>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <label className="label">流量分配 · A {split}% / B {100 - split}%</label>
        <input
          type="range"
          min={10}
          max={90}
          value={clamp(split, 10, 90)}
          onChange={(e) => setSplit(clamp(parseNumber(e.target.value, 50), 10, 90))}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        {(['A', 'B'] as Variant[]).map((v) => (
          <div key={v} className="panel stack" style={{ position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>Variant {v}</strong>
              {winner === v && <span className="tag" style={{ background: 'var(--teal-soft)' }}>勝出</span>}
              {winner === '平手' && <span className="tag">平手</span>}
            </div>
            <input
              className={`field${!isNonEmpty(content[v].title) ? ' is-invalid' : ''}`}
              value={content[v].title}
              maxLength={TITLE_MAX}
              onChange={(e) =>
                setContent((c) => ({ ...c, [v]: { ...c[v], title: limitText(e.target.value, TITLE_MAX) } }))
              }
            />
            <div className="field-meta">
              <span className={!isNonEmpty(content[v].title) ? 'warn' : undefined}>
                {!isNonEmpty(content[v].title) ? '標題不可空白' : ' '}
              </span>
              <span>
                {charCount(content[v].title)} / {TITLE_MAX}
              </span>
            </div>
            <textarea
              className={`field${!isNonEmpty(content[v].body) ? ' is-invalid' : ''}`}
              rows={2}
              value={content[v].body}
              maxLength={BODY_MAX}
              onChange={(e) =>
                setContent((c) => ({ ...c, [v]: { ...c[v], body: limitText(e.target.value, BODY_MAX) } }))
              }
            />
            <div className="field-meta">
              <span className={!isNonEmpty(content[v].body) ? 'warn' : undefined}>
                {!isNonEmpty(content[v].body) ? '內文不可空白' : ' '}
              </span>
              <span>
                {charCount(content[v].body)} / {BODY_MAX}
              </span>
            </div>
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
            <div className="muted" style={{ fontSize: 12 }}>
              樣本進度 {Math.min(100, Math.round((impressions[v] / MIN_SAMPLE) * 100))}%（目標 {MIN_SAMPLE}）
            </div>
            <div className="progress">
              <span style={{ width: `${Math.min(100, (impressions[v] / MIN_SAMPLE) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="grid-3">
          <div className="metric">
            <div className="muted">Lift（B vs A）</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {lift === null ? '—' : `${lift >= 0 ? '+' : ''}${lift.toFixed(1)}%`}
            </div>
          </div>
          <div className="metric">
            <div className="muted">z-score</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{z === null ? '—' : z.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="muted">目前領先</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {winner === null ? '尚無定論' : winner === '平手' ? '平手' : `變體 ${winner}`}
            </div>
          </div>
        </div>
        <p className="muted">{hint}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          {sampleHint}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={enterRandom} disabled={!contentOk}>
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
          <button type="button" className={`btn sm ${editMode ? 'accent' : 'ghost'}`} onClick={() => setEditMode((v) => !v)}>
            {editMode ? '完成手動編輯' : '手動編輯數據'}
          </button>
        </div>

        {editMode && (
          <div className="grid-2">
            {(['A', 'B'] as Variant[]).map((v) => (
              <div key={v} className="panel stack">
                <div className="label">手動調整 · {v}</div>
                <label className="stack">
                  <span className="muted">曝光數</span>
                  <input
                    className={`field${numError ? ' is-invalid' : ''}`}
                    type="number"
                    min={0}
                    max={COUNT_MAX}
                    value={impressions[v]}
                    onChange={(e) => setImp(v, e.target.value)}
                  />
                  <p className="field-hint">0–{COUNT_MAX.toLocaleString()}</p>
                </label>
                <label className="stack">
                  <span className="muted">轉換數（不可超過曝光）</span>
                  <input
                    className={`field${numError ? ' is-invalid' : ''}`}
                    type="number"
                    min={0}
                    max={impressions[v]}
                    value={conversions[v]}
                    onChange={(e) => setConv(v, e.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
        {numError && <p className="field-error">{numError}</p>}

        {assigned && (
          <div className="list-item" style={{ background: assigned === 'A' ? 'var(--sky-soft)' : 'var(--teal-soft)' }}>
            <h3 style={{ margin: 0 }}>{content[assigned].title}</h3>
            <p className="muted">{content[assigned].body}</p>
            <span className="tag">目前變體 {assigned}</span>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label" style={{ margin: 0 }}>
              實驗歷史（可選）
            </div>
            <button type="button" className="btn sm ghost" onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="list-item stack" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span>
                    A {(h.rates.A * 100).toFixed(1)}%（{h.conversions.A}/{h.impressions.A}）· B{' '}
                    {(h.rates.B * 100).toFixed(1)}%（{h.conversions.B}/{h.impressions.B}）
                  </span>
                  {h.winner && h.winner !== '平手' && (
                    <span className="tag" style={{ background: 'var(--teal-soft)' }}>
                      勝出 {h.winner}
                    </span>
                  )}
                  {h.winner === '平手' && <span className="tag">平手</span>}
                </div>
                <span className="muted mono">
                  lift {h.lift === null ? '—' : `${h.lift >= 0 ? '+' : ''}${h.lift.toFixed(1)}%`} · z{' '}
                  {h.z === null ? '—' : h.z.toFixed(2)} · {new Date(h.at).toLocaleString('zh-TW')}
                </span>
              </li>
            ))}
            {!history.length && <li className="list-item muted">尚無快照（重置或按「存快照」）</li>}
          </ul>
        </div>
      )}
    </ProjectShell>
  )
}
