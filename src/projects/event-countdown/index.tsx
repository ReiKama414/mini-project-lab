import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('event-countdown')!

type ColorTag = 'teal' | 'accent' | 'amber' | 'rose' | 'sky'

type EventItem = {
  id: string
  title: string
  at: string
  color: ColorTag
  archived?: boolean
}

const COLORS: { id: ColorTag; label: string; bg: string }[] = [
  { id: 'teal', label: '青', bg: 'var(--teal-soft)' },
  { id: 'accent', label: '橙', bg: 'var(--accent-soft)' },
  { id: 'amber', label: '黃', bg: 'var(--amber-soft)' },
  { id: 'rose', label: '粉', bg: 'var(--rose-soft)' },
  { id: 'sky', label: '藍', bg: 'var(--sky-soft)' },
]

const MAX_ITEMS = 100
const MAX_TITLE = 80

function isValidDateTime(v: string) {
  if (!v) return false
  const t = new Date(v).getTime()
  return Number.isFinite(t)
}

function diffParts(target: number, now: number) {
  const past = target <= now
  const ms = Math.abs(target - now)
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return { days, hours, mins, secs, past }
}

export default function Page() {
  const [events, setEvents] = useLocalStorage<EventItem[]>('lab:event-countdown', [])
  const [title, setTitle] = useState('')
  const [at, setAt] = useState('')
  const [color, setColor] = useState<ColorTag>('teal')
  const [now, setNow] = useState(Date.now())
  const [showArchive, setShowArchive] = useState(false)
  const [sort, setSort] = useState<'soon' | 'far' | 'name'>('soon')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const titleOk = isNonEmpty(title)
  const atOk = isValidDateTime(at)
  const atLimit = events.length >= MAX_ITEMS
  const canAdd = titleOk && atOk && !atLimit

  const active = useMemo(() => {
    const list = events.filter((e) => !e.archived)
    const withT = list.map((e) => ({ ...e, t: new Date(e.at).getTime() }))
    withT.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title, 'zh-Hant')
      if (sort === 'far') return b.t - a.t
      return a.t - b.t
    })
    return withT
  }, [events, sort])

  const archived = useMemo(
    () =>
      events
        .filter((e) => e.archived)
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [events],
  )

  function add() {
    if (!canAdd) return
    setEvents([{ id: uid('ev'), title: title.trim(), at, color }, ...events])
    setTitle('')
  }

  function autoArchivePast() {
    setEvents(
      events.map((e) =>
        !e.archived && new Date(e.at).getTime() <= now ? { ...e, archived: true } : e,
      ),
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={autoArchivePast}>
          歸檔已過期
        </button>
      }
    >
      <div className="panel stack">
        <div className="grid-2">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="活動名稱"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入活動名稱' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${at && !atOk ? ' is-invalid' : ''}`}
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
            {at && !atOk && <p className="field-error">請選擇有效日期時間</p>}
            {!at && <p className="field-hint">請選擇活動時間</p>}
          </div>
        </div>
        <div className="row">
          <span className="muted">顏色標籤</span>
          {COLORS.map((c) => (
            <button
              key={c.id}
              className={`btn sm ${color === c.id ? 'accent' : 'ghost'}`}
              style={{ background: color === c.id ? undefined : c.bg }}
              onClick={() => setColor(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button className="btn accent" onClick={add} disabled={!canAdd}>
          加入倒數
        </button>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 個活動</p>}
      </div>

      <div className="panel stack">
        <div className="row">
          <span className="muted">排序</span>
          {(
            [
              ['soon', '最近先'],
              ['far', '最遠先'],
              ['name', '名稱'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={`btn sm ${sort === k ? 'accent' : 'ghost'}`} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
          <button
            className={`btn sm ${showArchive ? 'teal' : 'ghost'}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowArchive((v) => !v)}
          >
            封存區 ({archived.length})
          </button>
        </div>

        <ul className="list">
          {active.map((e) => {
            const d = diffParts(e.t, now)
            const colorMeta = COLORS.find((c) => c.id === e.color)
            return (
              <li
                key={e.id}
                className="list-item"
                style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 8,
                  borderLeft: `4px solid ${e.color === 'accent' ? 'var(--accent)' : `var(--${e.color})`}`,
                }}
              >
                <div className="row">
                  <strong>{e.title}</strong>
                  <span className="tag" style={{ background: colorMeta?.bg }}>
                    {colorMeta?.label}
                  </span>
                  <button
                    className="btn sm ghost"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setEvents(events.map((x) => (x.id === e.id ? { ...x, archived: true } : x)))}
                  >
                    歸檔
                  </button>
                  <DeleteButton onClick={() => setEvents(events.filter((x) => x.id !== e.id))} label="刪除" />
                </div>
                <span className="muted">{new Date(e.at).toLocaleString('zh-TW')}</span>
                {d.past ? (
                  <span className="tag" style={{ background: 'var(--rose-soft)', color: '#9a1f45' }}>
                    已過 {d.days}天 {String(d.hours).padStart(2, '0')}:
                    {String(d.mins).padStart(2, '0')}:{String(d.secs).padStart(2, '0')}
                  </span>
                ) : (
                  <div className="metric mono" style={{ fontSize: 22 }}>
                    {d.days}天 {String(d.hours).padStart(2, '0')}:
                    {String(d.mins).padStart(2, '0')}:{String(d.secs).padStart(2, '0')}
                  </div>
                )}
              </li>
            )
          })}
          {!active.length && <p className="muted">新增重要活動開始倒數</p>}
        </ul>

        {showArchive && (
          <div className="stack">
            <strong>封存活動</strong>
            <ul className="list">
              {archived.map((e) => (
                <li key={e.id} className="list-item">
                  <div className="stack" style={{ flex: 1, gap: 2 }}>
                    <strong>{e.title}</strong>
                    <span className="muted">{new Date(e.at).toLocaleString('zh-TW')}</span>
                  </div>
                  <button
                    className="btn sm ghost"
                    onClick={() => setEvents(events.map((x) => (x.id === e.id ? { ...x, archived: false } : x)))}
                  >
                    還原
                  </button>
                  <button className="btn sm ghost" onClick={() => setEvents(events.filter((x) => x.id !== e.id))}>
                    刪
                  </button>
                </li>
              ))}
              {!archived.length && <p className="muted">尚無封存項目</p>}
            </ul>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
