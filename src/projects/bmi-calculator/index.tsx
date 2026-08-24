import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, parseNumber, uid } from '../../lib/utils'

const meta = getProject('bmi-calculator')!

const CM_MIN = 50
const CM_MAX = 250
const KG_MIN = 20
const KG_MAX = 300
const FT_MIN = 3
const FT_MAX = 8
const IN_MIN = 0
const IN_MAX = 11
const LB_MIN = 40
const LB_MAX = 660

function category(bmi: number, asia: boolean) {
  if (asia) {
    if (bmi < 18.5) return { label: '過輕', color: '#3b82f6' }
    if (bmi < 24) return { label: '正常', color: '#2a9d8f' }
    if (bmi < 27) return { label: '過重', color: '#e9a319' }
    if (bmi < 30) return { label: '輕度肥胖', color: '#f0734a' }
    return { label: '肥胖', color: '#d6406a' }
  }
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' }
  if (bmi < 25) return { label: 'Normal', color: '#2a9d8f' }
  if (bmi < 30) return { label: 'Overweight', color: '#e9a319' }
  return { label: 'Obese', color: '#d6406a' }
}

type Hist = { id: string; cm: number; kg: number; bmi: number; at: number }

function setClamped(
  raw: string,
  min: number,
  max: number,
  set: (n: number) => void,
  setErr: (msg: string) => void,
) {
  const n = parseNumber(raw)
  if (!Number.isFinite(n)) {
    setErr('請輸入有效數字')
    return
  }
  setErr('')
  set(clamp(n, min, max))
}

export default function Page() {
  const [unit, setUnit] = useLocalStorage<'metric' | 'imperial'>('lab:bmi:unit', 'metric')
  const [asia, setAsia] = useLocalStorage('lab:bmi:asia', true)
  const [cm, setCm] = useState(170)
  const [kg, setKg] = useState(65)
  const [ft, setFt] = useState(5)
  const [inch, setInch] = useState(7)
  const [lb, setLb] = useState(143)
  const [history, setHistory] = useLocalStorage<Hist[]>('lab:bmi:history', [])
  const [error, setError] = useState('')

  const metric = useMemo(() => {
    if (unit === 'metric') return { cm, kg }
    const totalInch = ft * 12 + inch
    return { cm: totalInch * 2.54, kg: lb * 0.453592 }
  }, [unit, cm, kg, ft, inch, lb])

  const bmi = useMemo(() => {
    const m = metric.cm / 100
    if (!m || !metric.kg) return 0
    return metric.kg / (m * m)
  }, [metric])

  const ideal = useMemo(() => {
    const m = metric.cm / 100
    if (!m) return null
    const lo = asia ? 18.5 : 18.5
    const hi = asia ? 23.9 : 24.9
    return { lo: lo * m * m, hi: hi * m * m }
  }, [metric.cm, asia])

  const cat = category(bmi, asia)
  const canSave = Number.isFinite(bmi) && bmi > 0 && !error

  function save() {
    if (!canSave) return
    setHistory(
      [{ id: uid('b'), cm: metric.cm, kg: metric.kg, bmi, at: Date.now() }, ...history].slice(0, 20),
    )
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <button
              className={`btn sm ${unit === 'metric' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('metric')}
            >
              公制
            </button>
            <button
              className={`btn sm ${unit === 'imperial' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('imperial')}
            >
              英制
            </button>
            <label className="row" style={{ marginLeft: 'auto' }}>
              <input type="checkbox" checked={asia} onChange={() => setAsia(!asia)} />
              亞洲標準
            </label>
          </div>

          {unit === 'metric' ? (
            <div className="grid-2">
              <label className="stack">
                <span className="label">身高 (cm)</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={CM_MIN}
                  max={CM_MAX}
                  value={cm}
                  onChange={(e) => setClamped(e.target.value, CM_MIN, CM_MAX, setCm, setError)}
                />
                <p className="field-hint">{CM_MIN}–{CM_MAX} cm</p>
              </label>
              <label className="stack">
                <span className="label">體重 (kg)</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={KG_MIN}
                  max={KG_MAX}
                  value={kg}
                  onChange={(e) => setClamped(e.target.value, KG_MIN, KG_MAX, setKg, setError)}
                />
                <p className="field-hint">{KG_MIN}–{KG_MAX} kg</p>
              </label>
            </div>
          ) : (
            <div className="grid-3">
              <label className="stack">
                <span className="label">呎</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={FT_MIN}
                  max={FT_MAX}
                  value={ft}
                  onChange={(e) => setClamped(e.target.value, FT_MIN, FT_MAX, setFt, setError)}
                />
                <p className="field-hint">{FT_MIN}–{FT_MAX}</p>
              </label>
              <label className="stack">
                <span className="label">吋</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={IN_MIN}
                  max={IN_MAX}
                  value={inch}
                  onChange={(e) => setClamped(e.target.value, IN_MIN, IN_MAX, setInch, setError)}
                />
                <p className="field-hint">{IN_MIN}–{IN_MAX}</p>
              </label>
              <label className="stack">
                <span className="label">磅</span>
                <input
                  className={`field${error ? ' is-invalid' : ''}`}
                  type="number"
                  min={LB_MIN}
                  max={LB_MAX}
                  value={lb}
                  onChange={(e) => setClamped(e.target.value, LB_MIN, LB_MAX, setLb, setError)}
                />
                <p className="field-hint">{LB_MIN}–{LB_MAX}</p>
              </label>
            </div>
          )}

          {error && <p className="field-error">{error}</p>}

          <div style={{ textAlign: 'center' }}>
            <div className="metric" style={{ fontSize: 48 }}>
              {bmi ? bmi.toFixed(1) : '—'}
            </div>
            <span className="tag" style={{ background: cat.color, color: '#fff' }}>
              {bmi ? cat.label : '請輸入數值'}
            </span>
          </div>

          {ideal && (
            <p className="muted" style={{ textAlign: 'center' }}>
              理想體重約 {ideal.lo.toFixed(1)} – {ideal.hi.toFixed(1)} kg
              {unit === 'imperial' &&
                `（${(ideal.lo / 0.453592).toFixed(0)} – ${(ideal.hi / 0.453592).toFixed(0)} lb）`}
            </p>
          )}

          <div className="progress">
            <span style={{ width: `${Math.min(100, (bmi / 40) * 100)}%`, background: cat.color }} />
          </div>
          <button className="btn accent" onClick={save} disabled={!canSave}>
            儲存本次紀錄
          </button>
        </div>

        <div className="panel stack">
          <h3>歷史紀錄</h3>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{h.bmi.toFixed(1)}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {h.cm.toFixed(0)} cm · {h.kg.toFixed(1)} kg ·{' '}
                    {new Date(h.at).toLocaleString()}
                  </div>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => setHistory(history.filter((x) => x.id !== h.id))}
                >
                  刪
                </button>
              </li>
            ))}
            {!history.length && <p className="muted">尚無紀錄</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
