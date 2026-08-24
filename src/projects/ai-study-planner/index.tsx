import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('ai-study-planner')!

type Subject = { id: string; name: string; hoursPerWeek: number }
type Milestone = { id: string; title: string; week: number; done: boolean }
type Step = 'subjects' | 'milestones' | 'calendar'

const DAYS = ['一', '二', '三', '四', '五', '六', '日']

const PRESETS: { label: string; subjects: Omit<Subject, 'id'>[] }[] = [
  {
    label: '轉職前端',
    subjects: [
      { name: 'JavaScript', hoursPerWeek: 8 },
      { name: 'React', hoursPerWeek: 6 },
      { name: 'CSS／設計', hoursPerWeek: 4 },
    ],
  },
  {
    label: '研究所備考',
    subjects: [
      { name: '線性代數', hoursPerWeek: 6 },
      { name: '演算法', hoursPerWeek: 6 },
      { name: '離散數學', hoursPerWeek: 4 },
    ],
  },
  {
    label: '語言學習',
    subjects: [
      { name: '單字', hoursPerWeek: 4 },
      { name: '聽力', hoursPerWeek: 3 },
      { name: '口說', hoursPerWeek: 3 },
    ],
  },
]

function distribute(subjects: Subject[]) {
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

const DEFAULT_SUBJECTS: Subject[] = [
  { id: '1', name: '線性代數', hoursPerWeek: 6 },
  { id: '2', name: '演算法', hoursPerWeek: 4 },
]

export default function Page() {
  const [subjects, setSubjects] = useLocalStorage<Subject[]>('lab:ai-study-planner:subjects', DEFAULT_SUBJECTS)
  const [milestones, setMilestones] = useLocalStorage<Milestone[]>(
    'lab:ai-study-planner:ms',
    defaultMilestones(DEFAULT_SUBJECTS),
  )
  const [step, setStep] = useLocalStorage<Step>('lab:ai-study-planner:step', 'subjects')
  const [name, setName] = useState('')
  const [hours, setHours] = useState(4)
  const [goal, setGoal] = useLocalStorage('lab:ai-study-planner:goal', '8 週內完成核心科目一輪複習')

  const grid = useMemo(() => distribute(subjects), [subjects])
  const weekTotal = useMemo(() => subjects.reduce((s, x) => s + x.hoursPerWeek, 0), [subjects])
  const msDone = milestones.filter((m) => m.done).length
  const dayTotals = useMemo(() => {
    const totals = Array(7).fill(0) as number[]
    subjects.forEach((s) => {
      ;(grid[s.id] || []).forEach((h, i) => {
        totals[i]! += h
      })
    })
    return totals
  }, [subjects, grid])

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

  function applyPreset(p: (typeof PRESETS)[number]) {
    const next = p.subjects.map((s) => ({ ...s, id: uid('s') }))
    setSubjects(next)
    setMilestones(defaultMilestones(next))
    setStep('subjects')
  }

  function regenerateMilestones() {
    setMilestones(defaultMilestones(subjects))
  }

  function clearStats() {
    setMilestones((ms) => ms.map((m) => ({ ...m, done: false })))
  }

  function resetAll() {
    setSubjects(DEFAULT_SUBJECTS)
    setMilestones(defaultMilestones(DEFAULT_SUBJECTS))
    setGoal('8 週內完成核心科目一輪複習')
    setStep('subjects')
  }

  function exportPlan() {
    const rows = [
      `# 學習計畫`,
      `目標：${goal}`,
      `每週總時數：${weekTotal}h`,
      `里程碑進度：${msDone}/${milestones.length}`,
      '',
      '## 日曆',
      ['科目', ...DAYS.map((d) => `週${d}`), '合計'].join('\t'),
      ...subjects.map((s) => [s.name, ...(grid[s.id] || []).map((h) => `${h}h`), `${s.hoursPerWeek}h`].join('\t')),
      ['日合計', ...dayTotals.map((h) => `${h}h`), `${weekTotal}h`].join('\t'),
      '',
      '## 里程碑',
      ...milestones.map((m) => `- [${m.done ? 'x' : ' '}] W${m.week} ${m.title}`),
    ].join('\n')
    downloadText('study-plan.md', rows, 'text/markdown;charset=utf-8')
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'subjects', label: '1. 科目' },
    { id: 'milestones', label: '2. 里程碑' },
    { id: 'calendar', label: '3. 日曆' },
  ]

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn accent sm" onClick={exportPlan}>
            下載計畫
          </button>
          <button type="button" className="btn ghost sm" onClick={resetAll}>
            重置
          </button>
        </div>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {steps.map((s) => (
            <button key={s.id} type="button" className={`btn sm ${step === s.id ? 'accent' : 'ghost'}`} onClick={() => setStep(s.id)}>
              {s.label}
            </button>
          ))}
          <span className="metric">每週 {weekTotal}h</span>
          <span className="muted">
            里程碑 {msDone}/{milestones.length}
          </span>
        </div>
        <label className="label">學習目標</label>
        <input className="field" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">預設方案</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {step === 'subjects' && (
        <div className="panel stack">
          <div className="label">科目與每週時數</div>
          <div className="row">
            <input className="field" style={{ flex: 1 }} placeholder="科目名稱" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className="field"
              style={{ width: 90 }}
              type="number"
              min={1}
              max={40}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 1)}
            />
            <button type="button" className="btn accent" onClick={addSubject}>
              新增
            </button>
          </div>
          {subjects.length === 0 ? (
            <div className="list-item stack">
              <strong>還沒有科目</strong>
              <p className="muted" style={{ margin: 0 }}>
                選上方預設方案，或自己新增科目與每週時數。
              </p>
            </div>
          ) : (
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
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => {
                      setSubjects((xs) => xs.filter((x) => x.id !== s.id))
                      setMilestones((ms) => ms.filter((m) => !m.title.startsWith(`${s.name}：`)))
                    }}
                  >
                    刪
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <button type="button" className="btn accent" disabled={!subjects.length} onClick={() => setStep('milestones')}>
              下一步：里程碑 →
            </button>
          </div>
        </div>
      )}

      {step === 'milestones' && (
        <div className="panel stack">
          <div className="row">
            <div className="label">里程碑</div>
            <span className="muted">
              {msDone}/{milestones.length}
            </span>
            <button type="button" className="btn sm ghost" onClick={regenerateMilestones} disabled={!subjects.length}>
              依科目重產
            </button>
            <button type="button" className="btn sm ghost" onClick={clearStats} disabled={!msDone}>
              清除完成狀態
            </button>
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
          {milestones.length === 0 ? (
            <div className="list-item">
              <p className="muted" style={{ margin: 0 }}>
                尚無里程碑。請先在「科目」步驟加入科目，再按「依科目重產」。
              </p>
            </div>
          ) : (
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
                  <button type="button" className="btn sm danger" onClick={() => setMilestones((xs) => xs.filter((x) => x.id !== m.id))}>
                    刪
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setStep('subjects')}>
              ← 科目
            </button>
            <button type="button" className="btn accent" onClick={() => setStep('calendar')}>
              下一步：日曆 →
            </button>
          </div>
        </div>
      )}

      {step === 'calendar' && (
        <div className="panel stack" style={{ overflowX: 'auto' }}>
          <div className="row">
            <div className="label">每週日曆（時數）</div>
            <button type="button" className="btn ghost sm" onClick={() => setStep('milestones')}>
              ← 里程碑
            </button>
          </div>
          {subjects.length === 0 ? (
            <div className="list-item">
              <p className="muted" style={{ margin: 0 }}>
                沒有科目可排程。回到第一步新增科目。
              </p>
            </div>
          ) : (
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
                <tr>
                  <td style={{ padding: 6 }}>
                    <strong>日合計</strong>
                  </td>
                  {dayTotals.map((h, i) => (
                    <td key={i} className="mono" style={{ textAlign: 'center', padding: 6 }}>
                      {h ? `${h}h` : '—'}
                    </td>
                  ))}
                  <td className="mono" style={{ textAlign: 'center', padding: 6 }}>
                    {weekTotal}h
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="muted">啟發式排程：每科以最多 2h 切片輪流填入一週七天。</p>
        </div>
      )}
    </ProjectShell>
  )
}
