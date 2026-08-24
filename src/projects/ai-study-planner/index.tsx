import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('ai-study-planner')!

type Subject = { id: string; name: string; hoursPerWeek: number }
type Milestone = { id: string; title: string; week: number; done: boolean }

const DAYS = ['一', '二', '三', '四', '五', '六', '日']

function distribute(subjects: Subject[]) {
  // hours per weekday for each subject (simple round-robin fill)
  const grid: Record<string, number[]> = {}
  subjects.forEach((s) => {
    const arr = Array(7).fill(0) as number[]
    let left = Math.max(0, s.hoursPerWeek)
    let i = 0
    while (left > 0) {
      const chunk = Math.min(2, left)
      arr[i % 7]! += chunk
      left -= chunk
      i++
      if (i > 100) break
    }
    grid[s.id] = arr
  })
  return grid
}

function defaultMilestones(subjects: Subject[]): Milestone[] {
  return subjects.flatMap((s, i) => [
    { id: uid('ms'), title: `${s.name}：觀念建立完成`, week: 1 + i, done: false },
    { id: uid('ms'), title: `${s.name}：完成一輪練習題`, week: 2 + i, done: false },
    { id: uid('ms'), title: `${s.name}：模擬測驗 ≥ 目標分`, week: 3 + i, done: false },
  ])
}

export default function Page() {
  const [subjects, setSubjects] = useLocalStorage<Subject[]>('lab:ai-study-planner:subjects', [
    { id: '1', name: '線性代數', hoursPerWeek: 6 },
    { id: '2', name: '演算法', hoursPerWeek: 4 },
  ])
  const [milestones, setMilestones] = useLocalStorage<Milestone[]>('lab:ai-study-planner:ms', defaultMilestones([
    { id: '1', name: '線性代數', hoursPerWeek: 6 },
    { id: '2', name: '演算法', hoursPerWeek: 4 },
  ]))
  const [name, setName] = useState('')
  const [hours, setHours] = useState(4)

  const grid = useMemo(() => distribute(subjects), [subjects])
  const weekTotal = useMemo(() => subjects.reduce((s, x) => s + x.hoursPerWeek, 0), [subjects])
  const msDone = milestones.filter((m) => m.done).length

  function addSubject() {
    if (!name.trim()) return
    const s = { id: uid('s'), name: name.trim(), hoursPerWeek: hours }
    setSubjects((xs) => [...xs, s])
    setMilestones((ms) => [
      ...ms,
      { id: uid('ms'), title: `${s.name}：觀念建立完成`, week: 1, done: false },
      { id: uid('ms'), title: `${s.name}：模擬測驗`, week: 3, done: false },
    ])
    setName('')
  }

  function exportPlan() {
    const rows = [
      `每週總時數：${weekTotal}h`,
      '',
      '日曆：',
      ['科目', ...DAYS].join('\t'),
      ...subjects.map((s) => [s.name, ...(grid[s.id] || []).map((h) => `${h}h`)].join('\t')),
      '',
      '里程碑：',
      ...milestones.map((m) => `- [${m.done ? 'x' : ' '}] W${m.week} ${m.title}`),
    ].join('\n')
    downloadText('study-plan.txt', rows)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn accent sm" onClick={exportPlan}>下載計畫</button>}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">科目與每週時數</div>
          <div className="row">
            <input className="field" style={{ flex: 1 }} placeholder="科目" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="field" style={{ width: 90 }} type="number" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} />
            <button type="button" className="btn accent" onClick={addSubject}>
              新增
            </button>
          </div>
          <ul className="list">
            {subjects.map((s) => (
              <li key={s.id} className="list-item row">
                <strong style={{ flex: 1 }}>{s.name}</strong>
                <input
                  className="field"
                  style={{ width: 80 }}
                  type="number"
                  min={1}
                  value={s.hoursPerWeek}
                  onChange={(e) =>
                    setSubjects((xs) =>
                      xs.map((x) => (x.id === s.id ? { ...x, hoursPerWeek: Number(e.target.value) || 1 } : x)),
                    )
                  }
                />
                <span className="muted">h/週</span>
                <button type="button" className="btn sm danger" onClick={() => setSubjects((xs) => xs.filter((x) => x.id !== s.id))}>
                  刪
                </button>
              </li>
            ))}
          </ul>
          <div className="metric">每週合計 {weekTotal} 小時</div>
        </div>
        <div className="panel stack">
          <div className="row">
            <div className="label">里程碑</div>
            <span className="muted">
              {msDone}/{milestones.length}
            </span>
          </div>
          <div className="progress">
            <div
              style={{
                width: `${milestones.length ? (msDone / milestones.length) * 100 : 0}%`,
                height: 8,
                borderRadius: 4,
                background: '#22c55e',
              }}
            />
          </div>
          <ul className="list">
            {milestones.map((m) => (
              <li key={m.id} className="list-item row">
                <label className="row" style={{ flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={() => setMilestones((xs) => xs.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))}
                  />
                  <span style={{ textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</span>
                </label>
                <span className="tag">W{m.week}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="panel stack" style={{ marginTop: 12, overflowX: 'auto' }}>
        <div className="label">每週日曆（時數）</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 6 }}>科目</th>
              {DAYS.map((d) => (
                <th key={d} style={{ padding: 6 }}>
                  週{d}
                </th>
              ))}
              <th style={{ padding: 6 }}>合計</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const row = grid[s.id] || Array(7).fill(0)
              return (
                <tr key={s.id}>
                  <td style={{ padding: 6 }}>{s.name}</td>
                  {row.map((h, i) => (
                    <td key={i} className="mono" style={{ textAlign: 'center', padding: 6 }}>
                      {h ? `${h}h` : '—'}
                    </td>
                  ))}
                  <td className="mono" style={{ textAlign: 'center', padding: 6 }}>
                    {s.hoursPerWeek}h
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ProjectShell>
  )
}
