import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('workout-tracker')!

type Workout = {
  id: string
  exercise: string
  sets: number
  reps: number
  weight: number
  date: string
  note?: string
}

const PRESETS = [
  '深蹲',
  '硬舉',
  '臥推',
  '肩推',
  '引體向上',
  '划船',
  '腿推',
  '二頭彎舉',
  '三頭下壓',
  '平板撐體',
  '跑步',
  '開合跳',
]

function volume(w: Workout) {
  return w.sets * w.reps * w.weight
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Workout[]>('lab:workout-tracker', [])
  const [exercise, setExercise] = useState(PRESETS[0]!)
  const [customEx, setCustomEx] = useState('')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(40)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterEx, setFilterEx] = useState('all')

  const prMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of items) {
      const prev = map[w.exercise] ?? 0
      if (w.weight > prev) map[w.exercise] = w.weight
    }
    return map
  }, [items])

  const filtered = useMemo(
    () => (filterEx === 'all' ? items : items.filter((w) => w.exercise === filterEx)),
    [items, filterEx],
  )

  const byDate = useMemo(() => {
    const groups: Record<string, Workout[]> = {}
    for (const w of filtered) {
      ;(groups[w.date] ??= []).push(w)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const exerciseNames = useMemo(() => {
    const set = new Set([...PRESETS, ...items.map((i) => i.exercise)])
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  }, [items])

  function add() {
    const name = (customEx.trim() || exercise).trim()
    if (!name || sets <= 0 || reps <= 0) return
    setItems([
      { id: uid('wo'), exercise: name, sets, reps, weight: Math.max(0, weight), date },
      ...items,
    ])
    setCustomEx('')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="label">動作庫（點選預設）</div>
        <div className="row">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`btn sm ${exercise === p && !customEx ? 'teal' : 'ghost'}`}
              onClick={() => {
                setExercise(p)
                setCustomEx('')
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="grid-2">
          <input
            className="field"
            placeholder="或輸入自訂動作…"
            value={customEx}
            onChange={(e) => setCustomEx(e.target.value)}
          />
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">組數</span>
            <input className="field" type="number" min={1} value={sets} onChange={(e) => setSets(Number(e.target.value))} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">次數</span>
            <input className="field" type="number" min={1} value={reps} onChange={(e) => setReps(Number(e.target.value))} />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">重量 (kg)</span>
            <input className="field" type="number" min={0} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </label>
          <button className="btn accent" onClick={add} style={{ alignSelf: 'end' }}>
            記錄訓練
          </button>
        </div>
      </div>

      <div className="panel stack">
        <div className="row">
          <span className="muted">篩選動作</span>
          <select className="field" style={{ maxWidth: 200 }} value={filterEx} onChange={(e) => setFilterEx(e.target.value)}>
            <option value="all">全部</option>
            {exerciseNames.map((n) => (
              <option key={n} value={n}>
                {n}
                {prMap[n] != null ? `（PR ${prMap[n]}kg）` : ''}
              </option>
            ))}
          </select>
          <span className="tag">{filtered.length} 筆紀錄</span>
        </div>

        {byDate.map(([d, list]) => (
          <div key={d} className="stack" style={{ gap: 6 }}>
            <strong>
              {d}
              <span className="muted" style={{ fontWeight: 500, marginLeft: 8 }}>
                {list.length} 項 · 總容量 {list.reduce((s, w) => s + volume(w), 0).toLocaleString()}
              </span>
            </strong>
            <ul className="list">
              {list.map((w) => {
                const isPr = prMap[w.exercise] === w.weight && w.weight > 0
                return (
                  <li key={w.id} className="list-item">
                    <div className="stack" style={{ flex: 1, gap: 2 }}>
                      <div className="row">
                        <strong>{w.exercise}</strong>
                        {isPr && (
                          <span className="tag" style={{ background: 'var(--amber-soft)', color: '#8a5b00' }}>
                            PR
                          </span>
                        )}
                      </div>
                      <span className="muted">容量 {volume(w).toLocaleString()}</span>
                    </div>
                    <span className="mono">
                      {w.sets}×{w.reps} @ {w.weight}kg
                    </span>
                    <button className="btn sm ghost" onClick={() => setItems(items.filter((x) => x.id !== w.id))}>
                      刪除
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!byDate.length && <p className="muted">尚無訓練紀錄，從動作庫開始吧</p>}
      </div>
    </ProjectShell>
  )
}
