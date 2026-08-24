import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('birthday-reminder')!

type Person = {
  id: string
  name: string
  month: number
  day: number
  birthYear?: number
  note?: string
}

function nextBirthday(month: number, day: number, from = new Date()) {
  const y = from.getFullYear()
  let next = new Date(y, month - 1, day)
  const today = new Date(y, from.getMonth(), from.getDate())
  if (next < today) next = new Date(y + 1, month - 1, day)
  const days = Math.round((next.getTime() - today.getTime()) / 86400000)
  return { next, days, turningAge: null as number | null }
}

function withAge(p: Person) {
  const base = nextBirthday(p.month, p.day)
  let turningAge: number | null = null
  if (p.birthYear && p.birthYear > 1900) {
    turningAge = base.next.getFullYear() - p.birthYear
  }
  return { ...p, ...base, turningAge }
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function Page() {
  const [people, setPeople] = useLocalStorage<Person[]>('lab:birthday-reminder', [])
  const [name, setName] = useState('')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthYear, setBirthYear] = useState('')
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all')

  const upcoming = useMemo(() => {
    let list = people.map(withAge).sort((a, b) => a.days - b.days)
    if (monthFilter !== 'all') list = list.filter((p) => p.month === monthFilter)
    return list
  }, [people, monthFilter])

  const thisMonth = useMemo(() => {
    const m = new Date().getMonth() + 1
    return people.map(withAge).filter((p) => p.month === m).sort((a, b) => a.day - b.day)
  }, [people])

  function add() {
    if (!name.trim()) return
    const y = birthYear.trim() ? Number(birthYear) : undefined
    setPeople([
      {
        id: uid('bd'),
        name: name.trim(),
        month,
        day,
        birthYear: y && y > 1900 ? y : undefined,
      },
      ...people,
    ])
    setName('')
    setBirthYear('')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-3">
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              聯絡人
            </div>
            <div style={{ fontSize: 24 }}>{people.length}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              本月壽星
            </div>
            <div style={{ fontSize: 24 }}>{thisMonth.length}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              7 天內
            </div>
            <div style={{ fontSize: 24 }}>{people.map(withAge).filter((p) => p.days <= 7).length}</div>
          </div>
        </div>
        <div className="grid-2">
          <input className="field" placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="field"
            type="number"
            placeholder="出生年（選填，算歲數）"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">月</span>
            <input
              className="field"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value))))}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">日</span>
            <input
              className="field"
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(Math.min(31, Math.max(1, Number(e.target.value))))}
            />
          </label>
        </div>
        <button className="btn accent" onClick={add}>
          新增生日
        </button>
      </div>

      <div className="panel stack">
        <div className="row">
          <span className="muted">月份篩選</span>
          <button
            className={`btn sm ${monthFilter === 'all' ? 'accent' : 'ghost'}`}
            onClick={() => setMonthFilter('all')}
          >
            全部（依下次生日）
          </button>
          {MONTHS.map((m) => (
            <button
              key={m}
              className={`btn sm ${monthFilter === m ? 'accent' : 'ghost'}`}
              onClick={() => setMonthFilter(m)}
            >
              {m}月
            </button>
          ))}
        </div>
        <ul className="list">
          {upcoming.map((p) => (
            <li key={p.id} className="list-item">
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {p.month}/{p.day}
                  {p.birthYear ? ` · ${p.birthYear} 年生` : ''} · 下次 {p.next.toLocaleDateString('zh-TW')}
                  {p.turningAge != null ? ` · 滿 ${p.turningAge} 歲` : ''}
                </span>
              </div>
              <span
                className="tag"
                style={
                  p.days === 0
                    ? { background: 'var(--accent-soft)', color: '#a33c1a' }
                    : p.days <= 7
                      ? { background: 'var(--amber-soft)', color: '#8a5b00' }
                      : undefined
                }
              >
                {p.days === 0 ? '今天！' : `${p.days} 天後`}
              </span>
              <button className="btn sm ghost" onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                刪
              </button>
            </li>
          ))}
          {!upcoming.length && <p className="muted">尚無生日提醒</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
