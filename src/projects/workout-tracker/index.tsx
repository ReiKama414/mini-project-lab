import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { AddButton } from '../../components/AddButton'
import {
  FtMetric,
  FtMetricGrid,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

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

const MAX_ITEMS = 500
const MAX_EXERCISE = 40
const MAX_SETS = 100
const MAX_REPS = 500
const MAX_WEIGHT = 1000

const WORKOUT_SAMPLES = ['深蹲', '臥推', '跑步']

function isValidDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

function volume(w: Workout) {
  return w.sets * w.reps * w.weight
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Workout[]>('lab:workout-tracker', [])
  const [exercise, setExercise] = useState(PRESETS[0]!)
  const [customEx, setCustomEx] = useState('')
  const [setsStr, setSetsStr] = useState('3')
  const [repsStr, setRepsStr] = useState('10')
  const [weightStr, setWeightStr] = useState('40')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterEx, setFilterEx] = useState('all')

  const sets = parseNumber(setsStr)
  const reps = parseNumber(repsStr)
  const weight = parseNumber(weightStr)
  const name = (customEx.trim() || exercise).trim()
  const nameOk = isNonEmpty(name)
  const setsOk = Number.isFinite(sets) && sets >= 1
  const repsOk = Number.isFinite(reps) && reps >= 1
  const weightOk = Number.isFinite(weight) && weight >= 0
  const dateOk = isValidDate(date)
  const atLimit = items.length >= MAX_ITEMS
  const canAdd = nameOk && setsOk && repsOk && weightOk && dateOk && !atLimit

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

  const totalVolume = useMemo(() => items.reduce((s, w) => s + volume(w), 0), [items])
  const prCount = useMemo(() => Object.keys(prMap).filter((k) => prMap[k]! > 0).length, [prMap])
  const todayKey = new Date().toISOString().slice(0, 10)
  const todaySessions = useMemo(() => items.filter((w) => w.date === todayKey).length, [items, todayKey])

  function add() {
    if (!canAdd || !Number.isFinite(sets) || !Number.isFinite(reps) || !Number.isFinite(weight)) return
    setItems([
      {
        id: uid('wo'),
        exercise: name,
        sets: clamp(Math.round(sets), 1, MAX_SETS),
        reps: clamp(Math.round(reps), 1, MAX_REPS),
        weight: clamp(weight, 0, MAX_WEIGHT),
        date,
      },
      ...items,
    ])
    setCustomEx('')
  }

  function exportJson() {
    downloadText(
      'workouts.json',
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), workouts: items }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  function exportCsv() {
    const header = '日期,動作,組數,次數,重量kg,容量,備註'
    const rows = items.map((w) =>
      [w.date, w.exercise, w.sets, w.reps, w.weight, volume(w), w.note ?? '']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    )
    downloadText('workouts.csv', `\uFEFF${[header, ...rows].join('\n')}`, 'text/csv;charset=utf-8')
  }

  return (
    <FeatureLayout
      variant="unified"
      meta={meta}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" disabled={!items.length} onClick={exportCsv} icon="download">
            匯出 CSV
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!items.length} onClick={exportJson} icon="download">
            匯出 JSON
          </ActionButton>
        </div>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h2 className="pw-panel-title">動作範例</h2>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {WORKOUT_SAMPLES.map((p) => (
              <button
                key={p}
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setExercise(p)
                  setCustomEx('')
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="ft-stats-row">
            <span className="tag">顯示 {filtered.length} 筆</span>
            <span className="tag">共 {items.length} / {MAX_ITEMS}</span>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '筆數上限', value: `${MAX_ITEMS} 筆` },
        { label: '容量', value: '組數 × 次數 × 重量（kg）' },
      ]}
      faq={[
        ftPrivacyLocal,
        { title: 'PR 標記', body: '同一動作在目前紀錄中的最高重量會標示 PR；刪除紀錄可能改變 PR。' },
      ]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🏋️"
          title={<span className="mono">{totalVolume.toLocaleString()}</span>}
          subtitle="累計訓練容量（kg·次）"
          meta={
            <>
              今日 {todaySessions} 組紀錄 · PR 動作 {prCount} 種
              <br />
              篩選：{filterEx === 'all' ? '全部動作' : filterEx}
            </>
          }
        />
        <FtMetricGrid>
          <FtMetric label="紀錄筆數" value={items.length} />
          <FtMetric label="動作種類" value={exerciseNames.length} />
          <FtMetric label="今日組數" value={todaySessions} />
          <FtMetric label="PR 動作" value={prCount} />
        </FtMetricGrid>

        <FtSection title="記錄訓練" hint="點選下方動作庫或自訂名稱">
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
          <div className="stack" style={{ gap: 0 }}>
            <input
              className="field"
              placeholder="或輸入自訂動作…"
              value={customEx}
              maxLength={MAX_EXERCISE}
              onChange={(e) => setCustomEx(limitText(e.target.value, MAX_EXERCISE))}
            />
            <div className="field-meta">
              <span className="field-hint">{nameOk ? `將記錄：${name}` : '請選擇或輸入動作'}</span>
              <span>
                {charCount(customEx)} / {MAX_EXERCISE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${!dateOk ? ' is-invalid' : ''}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {!dateOk && <p className="field-error">請選擇有效日期</p>}
          </div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">組數</span>
            <input
              className={`field${!setsOk ? ' is-invalid' : ''}`}
              type="number"
              min={1}
              max={MAX_SETS}
              value={setsStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setSetsStr(e.target.value)
                else setSetsStr(String(clamp(Math.round(n), 1, MAX_SETS)))
              }}
            />
            {!setsOk && <p className="field-error">組數須為 1–{MAX_SETS}</p>}
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">次數</span>
            <input
              className={`field${!repsOk ? ' is-invalid' : ''}`}
              type="number"
              min={1}
              max={MAX_REPS}
              value={repsStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setRepsStr(e.target.value)
                else setRepsStr(String(clamp(Math.round(n), 1, MAX_REPS)))
              }}
            />
            {!repsOk && <p className="field-error">次數須為 1–{MAX_REPS}</p>}
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">重量 (kg)</span>
            <input
              className={`field${!weightOk ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={MAX_WEIGHT}
              step="0.5"
              value={weightStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setWeightStr(e.target.value)
                else setWeightStr(String(clamp(n, 0, MAX_WEIGHT)))
              }}
            />
            {!weightOk && <p className="field-error">重量須 ≥ 0</p>}
          </label>
          <AddButton onClick={add} style={{ alignSelf: 'end' }} disabled={!canAdd}>
            記錄訓練
          </AddButton>
        </div>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 筆，請先刪除再新增</p>}
        </FtSection>

        <FtSection title="訓練紀錄">
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
                    <DeleteButton onClick={() => setItems(items.filter((x) => x.id !== w.id))} label="刪除" />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!byDate.length && <p className="muted">尚無訓練紀錄，從動作庫開始吧</p>}
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
