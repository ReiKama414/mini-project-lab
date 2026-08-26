import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
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

function lastN(n: number) {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(toKey(d))
  }
  return days
}

function last7() {
  return lastN(7)
}

function last30() {
  return lastN(30)
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
  const days30 = useMemo(() => last30(), [])
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

        <div className="row">
          <div className="field-wrap" style={{ flex: 1 }}>
            <input
              className={`field${name.length > 0 && !nameOk ? ' is-invalid' : ''}`}
              style={{ width: '100%' }}
              placeholder="新習慣名稱…"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(limitText(e.target.value, MAX_NAME))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
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
          <AddButton type="button"  onClick={add} disabled={!canAdd}>
            新增</AddButton>
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
            const monthHits = days30.filter((d) => h.checks.includes(d)).length
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
                  <span className="tag">30 日 {monthHits}/30</span>
                  <DeleteButton onClick={() => setHabits(habits.filter((x) => x.id !== h.id))} label="刪除" />
                </div>
                <div className="row" style={{ alignItems: 'center' }}>
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
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
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    近 30 日熱力圖（點擊可打卡／取消）
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(10, 1fr)',
                      gap: 4,
                      maxWidth: 280,
                    }}
                  >
                    {days30.map((d) => {
                      const on = h.checks.includes(d)
                      const isToday = d === today
                      return (
                        <button
                          key={d}
                          type="button"
                          title={`${d}${on ? ' · 已打卡' : ''}`}
                          onClick={() => toggle(h.id, d)}
                          aria-label={`${d}${on ? ' 已打卡' : ' 未打卡'}`}
                          style={{
                            width: '100%',
                            aspectRatio: '1',
                            border: isToday ? '2px solid var(--accent, #f0734a)' : '1px solid var(--line)',
                            borderRadius: 4,
                            padding: 0,
                            cursor: 'pointer',
                            background: on ? 'var(--teal, #2a9d8f)' : 'var(--surface, #fff)',
                            opacity: on ? 1 : 0.55,
                          }}
                        />
                      )
                    })}
                  </div>
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
