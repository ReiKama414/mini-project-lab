import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { AddButton } from '../../components/AddButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

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

const BIRTHDAY_SAMPLES = [
  { label: '範例甲', name: '王小明', month: 3, day: 15, birthYear: 1995 },
  { label: '範例乙', name: '陳小華', month: 12, day: 25 },
]

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

function parsePerson(row: unknown): Person | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const name = typeof r.name === 'string' ? limitText(r.name.trim(), MAX_NAME) : ''
  const month = typeof r.month === 'number' ? Math.round(r.month) : parseNumber(String(r.month ?? ''))
  const day = typeof r.day === 'number' ? Math.round(r.day) : parseNumber(String(r.day ?? ''))
  if (!name || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const m = clamp(month, 1, 12)
  const d = clamp(day, 1, daysInMonth(m))
  const by =
    typeof r.birthYear === 'number' && Number.isFinite(r.birthYear)
      ? Math.round(r.birthYear)
      : undefined
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid('bd'),
    name,
    month: m,
    day: d,
    birthYear: by && by >= 1900 && by <= CURRENT_YEAR ? by : undefined,
    note: typeof r.note === 'string' ? limitText(r.note, 200) : undefined,
  }
}

function parsePeopleJson(raw: unknown): Person[] | null {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { people?: unknown }).people)
      ? (raw as { people: unknown[] }).people
      : null
  if (!list) return null
  const out: Person[] = []
  for (const row of list) {
    const p = parsePerson(row)
    if (p) out.push(p)
  }
  return out.slice(0, MAX_ITEMS)
}

function mergePeople(existing: Person[], incoming: Person[]): Person[] {
  const byId = new Map(existing.map((p) => [p.id, p]))
  for (const p of incoming) {
    if (byId.has(p.id)) byId.set(p.id, { ...byId.get(p.id)!, ...p })
    else byId.set(p.id, p)
  }
  return [...byId.values()].slice(0, MAX_ITEMS)
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function Page() {
  const [people, setPeople] = useLocalStorage<Person[]>('lab:birthday-reminder', [])
  const [name, setName] = useState('')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthYear, setBirthYear] = useState('')
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all')
  const [remindMsg, setRemindMsg] = useState('')
  const [scheduled, setScheduled] = useState<Record<string, boolean>>({})
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t)
      timersRef.current.clear()
    }
  }, [])

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

  function exportJson() {
    downloadText(
      'birthday-reminder.json',
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), people }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  async function importJson(file: File | null) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const list = parsePeopleJson(parsed)
      if (!list?.length) {
        setImportMsg('JSON 無效或無有效聯絡人，資料未變更')
        return
      }
      setPeople(mergePeople(people, list))
      setImportMsg(`已合併還原 ${list.length} 筆`)
    } catch {
      setImportMsg('讀取或解析失敗，資料未變更')
    }
  }

  async function scheduleReminder(p: Person & { next: Date; days: number }) {
    const delay = p.next.getTime() - Date.now()
    const within24h = p.days <= 1 && delay <= 24 * 60 * 60 * 1000
    if (p.days > 1 || (!within24h && delay > 0)) {
      setRemindMsg('僅支援 24 小時內的生日提醒')
      return
    }
    if (typeof Notification === 'undefined') {
      setRemindMsg('此瀏覽器不支援通知')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      perm = await Notification.requestPermission()
    }
    if (perm !== 'granted') {
      setRemindMsg('未取得通知權限')
      return
    }
    const body = `${p.month}/${p.day} · 生日快樂！`
    const fire = () => {
      new Notification(`${p.name} 的生日`, { body })
      timersRef.current.delete(p.id)
      setScheduled((s) => {
        const next = { ...s }
        delete next[p.id]
        return next
      })
    }
    const prev = timersRef.current.get(p.id)
    if (prev != null) window.clearTimeout(prev)
    if (delay <= 0 || p.days === 0) {
      fire()
      setRemindMsg(`已發送「${p.name}」生日通知`)
      return
    }
    const tid = window.setTimeout(fire, delay)
    timersRef.current.set(p.id, tid)
    setScheduled((s) => ({ ...s, [p.id]: true }))
    const mins = Math.max(1, Math.round(delay / 60000))
    setRemindMsg(`已排程「${p.name}」提醒（約 ${mins} 分鐘後）`)
  }

  function applyBirthdaySample(s: (typeof BIRTHDAY_SAMPLES)[0]) {
    setName(s.name)
    setMonth(s.month)
    setDay(s.day)
    setBirthYear(s.birthYear != null ? String(s.birthYear) : '')
  }

  const nextPerson = upcoming[0]
  const within7 = people.map(withAge).filter((p) => p.days <= 7).length

  return (
    <FeatureLayout
      variant="unified"
      meta={meta}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" disabled={!people.length} onClick={exportJson} icon="download">
            備份 JSON
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => importRef.current?.click()}>
            還原 JSON
          </ActionButton>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importJson(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </div>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h2 className="pw-panel-title">填寫範例</h2>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {BIRTHDAY_SAMPLES.map((s) => (
              <button key={s.label} type="button" className="btn sm ghost" onClick={() => applyBirthdaySample(s)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ft-stats-row">
            <span className="tag">聯絡人 {people.length} / {MAX_ITEMS}</span>
            <span className="tag">本月 {thisMonth.length} 位</span>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '人數上限', value: `${MAX_ITEMS} 人` },
        { label: '提醒', value: '24 小時內可排程本機通知' },
      ]}
      faq={[ftPrivacyLocal, { title: '排序', body: '預設依「距離下次生日」由近到遠；可篩選月份。' }]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🎂"
          title={nextPerson ? (nextPerson.days === 0 ? '今天！' : `${nextPerson.days} 天`) : '—'}
          subtitle={nextPerson ? `最近：${nextPerson.name}` : '尚無生日提醒'}
          meta={
            nextPerson ? (
              <>
                {nextPerson.month}/{nextPerson.day} · 下次 {nextPerson.next.toLocaleDateString('zh-TW')}
                {nextPerson.turningAge != null ? ` · 滿 ${nextPerson.turningAge} 歲` : ''}
                <br />
                月份篩選：{monthFilter === 'all' ? '全部' : `${monthFilter} 月`}
              </>
            ) : (
              '新增聯絡人開始追蹤'
            )
          }
          badge={nextPerson?.days === 0 ? <span className="tag">壽星</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="聯絡人" value={`${people.length} / ${MAX_ITEMS}`} />
          <FtMetric label="本月壽星" value={thisMonth.length} />
          <FtMetric label="7 天內" value={within7} />
          <FtMetric label="已排程提醒" value={Object.keys(scheduled).length} />
        </FtMetricGrid>

        <FtSection title="新增生日">
        {(importMsg || remindMsg) && (
          <p className="muted" style={{ fontSize: 13 }}>
            {importMsg || remindMsg}
          </p>
        )}
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
        <AddButton onClick={add} disabled={!canAdd}>
          新增生日
        </AddButton>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 人</p>}
        </FtSection>

        <FtSection title="即將到來">
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
          {upcoming.map((p) => {
            const within24h = p.days <= 1
            return (
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
                {within24h && (
                  <ActionButton
                    className={`btn sm ${scheduled[p.id] ? 'teal' : 'ghost'}`}
                    onClick={() => void scheduleReminder(p)}
                    icon="bell">
                    {scheduled[p.id] ? '已排程提醒' : '通知提醒'}
                  </ActionButton>
                )}
                <button className="btn sm ghost" onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                  刪
                </button>
              </li>
            )
          })}
          {!upcoming.length && <p className="muted">尚無生日提醒</p>}
        </ul>
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
