import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText } from '../../lib/utils'

const meta = getProject('ai-study-planner')!

type Day = { day: string; focus: string; hours: number; tasks: string[] }

function buildPlan(subject: string, hoursPerDay: number, days: number): Day[] {
  const foci = ['觀念建立', '例題練習', '錯題複習', '模擬測驗', '薄弱補強', '整合回顧']
  const names = ['一', '二', '三', '四', '五', '六', '日']
  return Array.from({ length: days }, (_, i) => {
    const focus = foci[i % foci.length]!
    return {
      day: `第 ${i + 1} 天（週${names[i % 7]}）`,
      focus,
      hours: hoursPerDay,
      tasks: [
        `${subject}：${focus} ${Math.max(1, hoursPerDay - 1)}h`,
        `整理筆記 20 分`,
        i % 3 === 2 ? '小測驗自評' : '休息／伸展 10 分',
      ],
    }
  })
}

export default function Page() {
  const [subject, setSubject] = useLocalStorage('lab:ai-study-planner:subject', '線性代數')
  const [hours, setHours] = useLocalStorage('lab:ai-study-planner:hours', 2)
  const [days, setDays] = useLocalStorage('lab:ai-study-planner:days', 7)
  const [plan, setPlan] = useState<Day[] | null>(null)

  const total = useMemo(() => (plan ? plan.reduce((s, d) => s + d.hours, 0) : 0), [plan])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-3">
          <div>
            <label className="label">科目</label>
            <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">每日時數</label>
            <input className="field" type="number" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} />
          </div>
          <div>
            <label className="label">天數</label>
            <input className="field" type="number" min={3} max={30} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} />
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={() => setPlan(buildPlan(subject, hours, days))}>
            產生計畫
          </button>
          {plan && (
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                downloadText(
                  'study-plan.txt',
                  plan.map((d) => `${d.day}｜${d.focus}｜${d.hours}h\n${d.tasks.map((t) => `  - ${t}`).join('\n')}`).join('\n\n'),
                )
              }
            >
              下載
            </button>
          )}
          {plan && <span className="metric">總計 {total} 小時</span>}
        </div>
        {plan && (
          <div className="grid-2">
            {plan.map((d) => (
              <div key={d.day} className="list-item stack">
                <strong>
                  {d.day} · {d.focus}
                </strong>
                <span className="tag">{d.hours}h</span>
                <ul>
                  {d.tasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
