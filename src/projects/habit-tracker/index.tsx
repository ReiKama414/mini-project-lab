import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('habit-tracker')!

type Habit = { id: string; name: string; checks: string[]; createdAt: number }

const MAX_ITEMS = 50
const MAX_NAME = 40

function toKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function todayKey() {
  return toKey(new Date())
}

function last7() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(toKey(d))
  }
  return days
}

/** 連續打卡天數：從今天往回算 */
function calcStreak(checks: string[]) {
  const set = new Set(checks)
  let streak = 0
  const d = new Date()
  if (!set.has(toKey(d))) {
    d.setDate(d.getDate() - 1)
  }
  while (set.has(toKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function weekdayLabel(iso: string) {
  const labels = ['日', '一', '二', '三', '四', '五', '六']
  return labels[new Date(iso + 'T12:00:00').getDay()]!
}

export default function Page() {
  const [habits, setHabits] = useLocalStorage<Habit[]>('lab:habit-tracker', [
    { id: '1', name: '運動 30 分', checks: [], createdAt: Date.now() },
    { id: '2', name: '閱讀', checks: [], createdAt: Date.now() },
  ])
  const [name, setName] = useState('')
  const days = useMemo(() => last7(), [])
  const today = todayKey()

  const nameOk = isNonEmpty(name)
  const atLimit = habits.length >= MAX_ITEMS
  const canAdd = nameOk && !atLimit

  function add() {
    if (!canAdd) return
    setHabits([
      ...habits,
      { id: uid('habit'), name: name.trim(), checks: [], createdAt: Date.now() },
    ])
    setName('')
  }

  function toggle(id: string, day: string) {
    setHabits(
      habits.map((h) => {
        if (h.id !== id) return h
        const has = h.checks.includes(day)
        return {
          ...h,
          checks: has ? h.checks.filter((d) => d !== day) : [...h.checks, day],
        }
      }),
    )
  }

  const weekRate = useMemo(() => {
    if (!habits.length) return 0
    const done = habits.reduce(
      (n, h) => n + days.filter((d) => h.checks.includes(d)).length,
      0,
    )
    return Math.round((done / (habits.length * 7)) * 100)
  }, [habits, days])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-3">
          <div className="metric">
            <div className="muted">習慣數</div>
            <div style={{ fontSize: 24 }}>{habits.length}</div>
          </div>
          <div className="metric">
            <div className="muted">本週完成率</div>
            <div style={{ fontSize: 24 }}>{weekRate}%</div>
            <div className="progress" style={{ marginTop: 8 }}>
              <span style={{ width: `${weekRate}%` }} />
            </div>
          </div>
          <div className="metric">
            <div className="muted">今日已打卡</div>
            <div style={{ fontSize: 24 }}>
              {habits.filter((h) => h.checks.includes(today)).length}/{habits.length}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 0 }}>
          <div className="row">
            <input
              className={`field${name.length > 0 && !nameOk ? ' is-invalid' : ''}`}
              style={{ flex: 1 }}
              placeholder="新習慣名稱…"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(limitText(e.target.value, MAX_NAME))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn accent" onClick={add} disabled={!canAdd}>
              新增
            </button>
          </div>
          <div className="field-meta">
            <span className={!nameOk && name.length > 0 ? 'warn' : undefined}>
              {atLimit
                ? `已達上限 ${MAX_ITEMS} 個習慣`
                : !nameOk && name.length > 0
                  ? '請輸入習慣名稱'
                  : '\u00a0'}
            </span>
            <span>
              {charCount(name)} / {MAX_NAME}
            </span>
          </div>
        </div>

        <div className="row muted" style={{ fontSize: 12, paddingLeft: 8 }}>
          <span style={{ width: 120 }}>習慣</span>
          {days.map((d) => (
            <span key={d} style={{ width: 40, textAlign: 'center' }}>
              {weekdayLabel(d)}
            </span>
          ))}
        </div>

        <ul className="list">
          {habits.map((h) => {
            const weekHits = days.filter((d) => h.checks.includes(d)).length
            const streak = calcStreak(h.checks)
            return (
              <li
                key={h.id}
                className="list-item"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
              >
                <div className="row">
                  <strong style={{ flex: 1 }}>{h.name}</strong>
                  <span className="tag">連續 {streak} 天</span>
                  <span className="tag">本週 {weekHits}/7</span>
                  <button
                    className="btn sm ghost"
                    onClick={() => setHabits(habits.filter((x) => x.id !== h.id))}
                  >
                    刪除
                  </button>
                </div>
                <div className="row" style={{ alignItems: 'center' }}>
                  {days.map((d) => (
                    <button
                      key={d}
                      className={`btn sm ${h.checks.includes(d) ? 'teal' : 'ghost'}`}
                      style={{ width: 40, placeContent: 'center' }}
                      onClick={() => toggle(h.id, d)}
                      title={d}
                    >
                      {h.checks.includes(d) ? '✓' : d === today ? '今' : d.slice(8)}
                    </button>
                  ))}
                </div>
                <div className="progress">
                  <span style={{ width: `${(weekHits / 7) * 100}%` }} />
                </div>
              </li>
            )
          })}
          {!habits.length && <p className="muted">新增習慣開始打卡</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
