import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { IconPause, IconPlay, IconReset, IconSkip } from '../../components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('pomodoro')!

const WORK_MIN = 1
const WORK_MAX = 60
const SHORT_MIN = 1
const SHORT_MAX = 30
const LONG_MIN = 5
const LONG_MAX = 45
const NOTE_MAX = 40
const HISTORY_CAP = 120

type Mode = 'work' | 'short' | 'long'
type SessionLog = {
  id: string
  mode: Mode
  minutes: number
  at: number
  note?: string
  skipped?: boolean
}

const MODE_META: Record<Mode, { label: string; hint: string }> = {
  work: { label: '專注', hint: '保持專注，一次一事' },
  short: { label: '短休', hint: '起來動一動、喝口水' },
  long: { label: '長休', hint: '好好休息，下輪再衝' },
}

function beep(enabled: boolean) {
  if (!enabled) return
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.value = 0.08
    o.start()
    setTimeout(() => {
      o.stop()
      void ctx.close()
    }, 350)
  } catch {
    /* ignore */
  }
}

function formatClock(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function dayKey(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(key: string) {
  const today = dayKey(Date.now())
  if (key === today) return '今天'
  const yest = dayKey(Date.now() - 86400000)
  if (key === yest) return '昨天'
  return key
}

export default function Page() {
  const [workMin, setWorkMin] = useLocalStorage('lab:pomodoro:work', 25)
  const [shortMin, setShortMin] = useLocalStorage('lab:pomodoro:short', 5)
  const [longMin, setLongMin] = useLocalStorage('lab:pomodoro:long', 15)
  const [autoStart, setAutoStart] = useLocalStorage('lab:pomodoro:auto', true)
  const [soundOn, setSoundOn] = useLocalStorage('lab:pomodoro:sound', true)
  const [cycles, setCycles] = useLocalStorage('lab:pomodoro:cycles', 0)
  const [history, setHistory] = useLocalStorage<SessionLog[]>('lab:pomodoro:history', [])

  const [mode, setMode] = useState<Mode>('work')
  const [seconds, setSeconds] = useState(Math.max(1, workMin) * 60)
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState('')
  const [notif, setNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const modeRef = useRef(mode)
  const cyclesRef = useRef(cycles)
  const autoRef = useRef(autoStart)
  const soundRef = useRef(soundOn)
  const noteRef = useRef(note)
  const minsRef = useRef({ workMin, shortMin, longMin })
  modeRef.current = mode
  cyclesRef.current = cycles
  autoRef.current = autoStart
  soundRef.current = soundOn
  noteRef.current = note
  minsRef.current = { workMin, shortMin, longMin }

  function durationOf(m: Mode) {
    const { workMin: w, shortMin: s, longMin: l } = minsRef.current
    if (m === 'work') return clamp(Math.max(1, w), WORK_MIN, WORK_MAX) * 60
    if (m === 'short') return clamp(Math.max(1, s), SHORT_MIN, SHORT_MAX) * 60
    return clamp(Math.max(1, l), LONG_MIN, LONG_MAX) * 60
  }

  function logSession(cur: Mode, skipped: boolean) {
    const minutes = Math.round(durationOf(cur) / 60)
    const entry: SessionLog = {
      id: uid('pomo'),
      mode: cur,
      minutes,
      at: Date.now(),
      skipped: skipped || undefined,
      note: cur === 'work' && noteRef.current.trim() ? limitText(noteRef.current.trim(), NOTE_MAX) : undefined,
    }
    setHistory((xs) => [entry, ...xs].slice(0, HISTORY_CAP))
    if (cur === 'work' && !skipped) setNote('')
  }

  function advanceFrom(cur: Mode, skipped = false) {
    logSession(cur, skipped)

    let next: Mode = 'work'
    let nextCycles = cyclesRef.current
    if (cur === 'work') {
      if (!skipped) {
        nextCycles += 1
        setCycles(nextCycles)
      }
      next = !skipped && nextCycles % 4 === 0 ? 'long' : 'short'
      // skipped work → short break still, but don't inflate cycle toward long
      if (skipped) next = 'short'
    } else {
      next = 'work'
    }

    setMode(next)
    if (!autoRef.current) setRunning(false)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(cur === 'work' ? '專注結束，休息一下' : '休息結束，繼續專注')
    }
    return durationOf(next)
  }

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s > 1) return s - 1
        beep(soundRef.current)
        return advanceFrom(modeRef.current, false)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, setCycles, setHistory])

  useEffect(() => {
    const label = MODE_META[mode].label
    const clock = formatClock(seconds)
    document.title = running ? `${clock} · ${label}｜Pomodoro` : meta.title
    return () => {
      document.title = meta.title
    }
  }, [running, seconds, mode])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.key === 'r' || e.key === 'R') {
        setRunning(false)
        setSeconds(durationOf(modeRef.current))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const stats = useMemo(() => {
    const today = dayKey(Date.now())
    const weekAgo = Date.now() - 7 * 86400000
    let todayFocus = 0
    let todayTomatoes = 0
    let weekFocus = 0
    let weekTomatoes = 0
    for (const h of history) {
      if (h.mode !== 'work' || h.skipped) continue
      if (h.at >= weekAgo) {
        weekFocus += h.minutes
        weekTomatoes += 1
      }
      if (dayKey(h.at) === today) {
        todayFocus += h.minutes
        todayTomatoes += 1
      }
    }
    return { todayFocus, todayTomatoes, weekFocus, weekTomatoes }
  }, [history])

  const grouped = useMemo(() => {
    const map = new Map<string, SessionLog[]>()
    for (const h of history) {
      const k = dayKey(h.at)
      const arr = map.get(k)
      if (arr) arr.push(h)
      else map.set(k, [h])
    }
    return [...map.entries()].slice(0, 5)
  }, [history])

  const total = durationOf(mode)
  const remain = clamp(seconds, 0, total)
  const pct = total > 0 ? ((total - remain) / total) * 100 : 0
  const ringR = 54
  const ringC = 2 * Math.PI * ringR
  const ringOffset = ringC * (1 - pct / 100)
  const inCycle = cycles % 4
  const cycleDots = [0, 1, 2, 3] as const

  function switchMode(next: Mode) {
    setMode(next)
    setSeconds(durationOf(next))
    setRunning(false)
  }

  function skip() {
    beep(soundRef.current)
    setSeconds(advanceFrom(mode, true))
  }

  async function enableNotif() {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotif(p)
  }

  return (
    <ProjectShell meta={meta}>
      <div className={`pomo ${mode}`}>
        <div className="pomo-stage panel">
          <div className="pomo-modes" role="tablist" aria-label="階段">
            {(
              [
                ['work', '專注'],
                ['short', '短休'],
                ['long', '長休'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mode === k}
                className={`pomo-mode${mode === k ? ' is-active' : ''}`}
                onClick={() => switchMode(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pomo-ring-wrap">
            <svg className="pomo-ring" viewBox="0 0 120 120" aria-hidden>
              <circle className="pomo-ring-track" cx="60" cy="60" r={ringR} />
              <circle
                className="pomo-ring-value"
                cx="60"
                cy="60"
                r={ringR}
                strokeDasharray={ringC}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="pomo-clock">
              <div className="pomo-time mono" aria-live="polite">
                {formatClock(remain)}
              </div>
              <div className="pomo-phase">{MODE_META[mode].label}</div>
            </div>
          </div>

          <p className="pomo-hint muted">{MODE_META[mode].hint}</p>

          {mode === 'work' && (
            <div className="pomo-note-wrap">
              <input
                className="field pomo-note"
                placeholder="這輪在做什麼？（選填）"
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(limitText(e.target.value, NOTE_MAX))}
                aria-label="專注備註"
              />
            </div>
          )}

          <div className="pomo-dots" aria-label={`本輪進度 ${inCycle}/4`}>
            {cycleDots.map((i) => (
              <span
                key={i}
                className={`pomo-dot${i < inCycle ? ' is-done' : ''}${running && mode === 'work' && i === inCycle ? ' is-now' : ''}`}
                title={i < inCycle ? '已完成' : i === inCycle ? '進行中' : '尚未開始'}
              />
            ))}
          </div>
          <p className="muted pomo-cycles">
            連續進度 {inCycle}/4 · 累計有效番茄 {cycles}
          </p>

          <div className="pomo-actions">
            <button
              type="button"
              className="btn ghost pomo-icon-btn"
              onClick={() => {
                setRunning(false)
                setSeconds(durationOf(mode))
              }}
              aria-label="重置"
              title="重置（R）"
            >
              <IconReset size={18} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="btn accent pomo-main"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? <IconPause size={20} strokeWidth={2.4} /> : <IconPlay size={20} strokeWidth={2.4} />}
              {running ? '暫停' : '開始'}
            </button>
            <button
              type="button"
              className="btn ghost pomo-icon-btn"
              onClick={skip}
              aria-label="跳過此階段"
              title="跳過（不計入有效番茄）"
            >
              <IconSkip size={18} strokeWidth={2.25} />
            </button>
          </div>
          <p className="muted pomo-keys">空白鍵開始／暫停 · R 重置 · 跳過不計入今日番茄</p>
        </div>

        <div className="pomo-side">
          <div className="pomo-stats panel">
            <div className="pomo-stat">
              <span className="pomo-stat-val mono">{stats.todayTomatoes}</span>
              <span className="pomo-stat-label">今日番茄</span>
            </div>
            <div className="pomo-stat">
              <span className="pomo-stat-val mono">{stats.todayFocus}</span>
              <span className="pomo-stat-label">今日專注分</span>
            </div>
            <div className="pomo-stat">
              <span className="pomo-stat-val mono">{stats.weekTomatoes}</span>
              <span className="pomo-stat-label">近 7 日番茄</span>
            </div>
            <div className="pomo-stat">
              <span className="pomo-stat-val mono">{stats.weekFocus}</span>
              <span className="pomo-stat-label">近 7 日專注分</span>
            </div>
          </div>

          <div className="pomo-settings panel stack">
            <h3>設定</h3>
            <div className="pomo-setting">
              <div className="pomo-setting-head">
                <span className="label" style={{ margin: 0 }}>
                  專注
                </span>
                <span className="pomo-setting-val mono">{workMin} 分</span>
              </div>
              <input
                className="field"
                type="range"
                min={WORK_MIN}
                max={WORK_MAX}
                value={clamp(workMin, WORK_MIN, WORK_MAX)}
                onChange={(e) => {
                  const v = clamp(parseNumber(e.target.value, WORK_MIN), WORK_MIN, WORK_MAX)
                  setWorkMin(v)
                  if (mode === 'work' && !running) setSeconds(v * 60)
                }}
                aria-label="專注分鐘"
              />
            </div>
            <div className="pomo-setting">
              <div className="pomo-setting-head">
                <span className="label" style={{ margin: 0 }}>
                  短休
                </span>
                <span className="pomo-setting-val mono">{shortMin} 分</span>
              </div>
              <input
                className="field"
                type="range"
                min={SHORT_MIN}
                max={SHORT_MAX}
                value={clamp(shortMin, SHORT_MIN, SHORT_MAX)}
                onChange={(e) => {
                  const v = clamp(parseNumber(e.target.value, SHORT_MIN), SHORT_MIN, SHORT_MAX)
                  setShortMin(v)
                  if (mode === 'short' && !running) setSeconds(v * 60)
                }}
                aria-label="短休分鐘"
              />
            </div>
            <div className="pomo-setting">
              <div className="pomo-setting-head">
                <span className="label" style={{ margin: 0 }}>
                  長休
                </span>
                <span className="pomo-setting-val mono">{longMin} 分</span>
              </div>
              <input
                className="field"
                type="range"
                min={LONG_MIN}
                max={LONG_MAX}
                value={clamp(longMin, LONG_MIN, LONG_MAX)}
                onChange={(e) => {
                  const v = clamp(parseNumber(e.target.value, LONG_MIN), LONG_MIN, LONG_MAX)
                  setLongMin(v)
                  if (mode === 'long' && !running) setSeconds(v * 60)
                }}
                aria-label="長休分鐘"
              />
            </div>

            <label className="pomo-check">
              <input type="checkbox" checked={autoStart} onChange={() => setAutoStart(!autoStart)} />
              <span>階段結束後自動開始下一輪</span>
            </label>
            <label className="pomo-check">
              <input type="checkbox" checked={soundOn} onChange={() => setSoundOn(!soundOn)} />
              <span>階段結束播放提示音</span>
            </label>

            <div className="pomo-setting-actions">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void enableNotif()}
                disabled={notif === 'granted'}
              >
                {notif === 'granted' ? '通知已開啟' : '開啟桌面通知'}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setCycles(0)}>
                重置連續計數
              </button>
            </div>
          </div>

          <div className="pomo-history panel stack">
            <div className="pomo-history-head">
              <h3>紀錄</h3>
              <button
                type="button"
                className="btn ghost sm"
                disabled={!history.length}
                onClick={() => {
                  if (confirm('確定清除全部番茄紀錄？')) setHistory([])
                }}
              >
                清除
              </button>
            </div>
            {!history.length && <p className="muted">完成一輪後會出現在這裡（本機儲存）</p>}
            {grouped.map(([day, items]) => (
              <div key={day} className="pomo-history-day">
                <div className="pomo-history-day-label">{formatDayLabel(day)}</div>
                <ul className="pomo-history-list">
                  {items.slice(0, 12).map((h) => (
                    <li key={h.id} className={`pomo-history-item${h.skipped ? ' is-skipped' : ''}`}>
                      <span className="pomo-history-time mono">{formatTime(h.at)}</span>
                      <span className="pomo-history-mode">{MODE_META[h.mode].label}</span>
                      <span className="pomo-history-mins mono">{h.minutes} 分</span>
                      {h.skipped && <span className="pomo-history-tag">跳過</span>}
                      {h.note && <span className="pomo-history-note">{h.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
