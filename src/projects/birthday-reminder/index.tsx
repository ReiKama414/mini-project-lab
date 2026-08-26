import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('birthday-reminder')!

type Person = {
  id: string
  name: string
  month: number
  day: number
  birthYear?: number
  note?: string
}

const MAX_ITEMS = 200
const MAX_NAME = 60
const CURRENT_YEAR = new Date().getFullYear()

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

function daysInMonth(month: number, year = 2000) {
  return new Date(year, month, 0).getDate()
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function Page() {
  const [people, setPeople] = useLocalStorage<Person[]>('lab:birthday-reminder', [])
  const [name, setName] = useState('')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthYear, setBirthYear] = useState('')
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all')

  const nameOk = isNonEmpty(name)
  const maxDay = daysInMonth(month)
  const dayOk = day >= 1 && day <= maxDay
  const yearParsed = birthYear.trim() ? parseNumber(birthYear) : NaN
  const yearOk =
    !birthYear.trim() ||
    (Number.isFinite(yearParsed) && yearParsed >= 1900 && yearParsed <= CURRENT_YEAR)
  const atLimit = people.length >= MAX_ITEMS
  const canAdd = nameOk && dayOk && yearOk && !atLimit

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
    if (!canAdd) return
    setPeople([
      {
        id: uid('bd'),
        name: name.trim(),
        month,
        day: clamp(day, 1, maxDay),
        birthYear: Number.isFinite(yearParsed) && yearParsed > 1900 ? Math.round(yearParsed) : undefined,
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
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${name.length > 0 && !nameOk ? ' is-invalid' : ''}`}
              placeholder="姓名"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(limitText(e.target.value, MAX_NAME))}
            />
            <div className="field-meta">
              <span className={!nameOk && name.length > 0 ? 'warn' : undefined}>
                {!nameOk && name.length > 0 ? '請輸入姓名' : '\u00a0'}
              </span>
              <span>
                {charCount(name)} / {MAX_NAME}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${birthYear.trim() && !yearOk ? ' is-invalid' : ''}`}
              type="number"
              min={1900}
              max={CURRENT_YEAR}
              placeholder="出生年（選填，算歲數）"
              value={birthYear}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setBirthYear(e.target.value)
                else setBirthYear(String(clamp(Math.round(n), 1900, CURRENT_YEAR)))
              }}
            />
            {birthYear.trim() && !yearOk && (
              <p className="field-error">出生年須為 1900–{CURRENT_YEAR}</p>
            )}
          </div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">月</span>
            <input
              className="field"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => {
                const n = parseNumber(e.target.value) ?? 1
                const m = clamp(Math.round(n), 1, 12)
                setMonth(m)
                setDay((d) => clamp(d, 1, daysInMonth(m)))
              }}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">日</span>
            <input
              className={`field${!dayOk ? ' is-invalid' : ''}`}
              type="number"
              min={1}
              max={maxDay}
              value={day}
              onChange={(e) => {
                const n = parseNumber(e.target.value) ?? 1
                setDay(clamp(Math.round(n), 1, maxDay))
              }}
            />
            {!dayOk && <p className="field-error">此月最多 {maxDay} 日</p>}
          </label>
        </div>
        <AddButton  onClick={add} disabled={!canAdd}>
          新增生日</AddButton>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 人</p>}
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
