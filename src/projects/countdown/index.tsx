import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { IconPause, IconPlay, IconReset } from '../../components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadJSON, useLocalStorage } from '../../lib/storage'
import { charCount, clamp, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('countdown')!

const LABEL_MAX = 80
const MINS_MIN = 0
const MINS_MAX = 999
const SECS_MIN = 0
const SECS_MAX = 59
const HISTORY_CAP = 24
const DONE_CAP = 40
const TIMER_CAP = 8

const PRESETS = [
  { m: 1, s: 0 },
  { m: 3, s: 0 },
  { m: 5, s: 0 },
  { m: 10, s: 0 },
  { m: 15, s: 0 },
  { m: 25, s: 0 },
  { m: 30, s: 0 },
  { m: 45, s: 0 },
  { m: 60, s: 0 },
] as const

type Timer = {
  id: string
  label: string
  total: number
  left: number
  running: boolean
  done: boolean
  endsAt?: number
}

type RecentItem = { id: string; label: string; seconds: number; at: number }
type DoneItem = { id: string; label: string; seconds: number; at: number }

function beep(enabled: boolean) {
  if (!enabled) return
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 660
    g.gain.value = 0.07
    o.start()
    setTimeout(() => {
      o.stop()
      void ctx.close()
    }, 500)
  } catch {
    /* ignore */
  }
}

function formatClock(totalSec: number) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h} 時 ${m} 分 ${s} 秒`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function createTimer(partial?: Partial<Pick<Timer, 'label' | 'total'>>): Timer {
  const total = partial?.total && partial.total > 0 ? partial.total : 5 * 60
  return {
    id: uid('cd'),
    label: limitText(partial?.label?.trim() || '倒數計時', LABEL_MAX),
    total,
    left: 0,
    running: false,
    done: false,
  }
}

function syncRunningLeft(t: Timer, now = Date.now()): Timer {
  if (!t.running || t.endsAt == null) return t
  const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000))
  if (left <= 0) return { ...t, left: 0, running: false, done: true, endsAt: undefined }
  return { ...t, left }
}

function loadTimers(): Timer[] {
  const raw = loadJSON<Timer[]>('lab:countdown:timers', [])
  if (!Array.isArray(raw) || raw.length === 0) return [createTimer()]
  const now = Date.now()
  return raw.map((t) => syncRunningLeft(t, now))
}

export default function Page() {
  const [timers, setTimers] = useState<Timer[]>(() => loadTimers())
  const [activeId, setActiveId] = useLocalStorage('lab:countdown:active', '')
  const [draftLabel, setDraftLabel] = useState('倒數計時')
  const [mins, setMins] = useState(5)
  const [secs, setSecs] = useState(0)
  const [soundOn, setSoundOn] = useLocalStorage('lab:countdown:sound', true)
  const [recent, setRecent] = useLocalStorage<RecentItem[]>('lab:countdown:history', [])
  const [completed, setCompleted] = useLocalStorage<DoneItem[]>('lab:countdown:done', [])
  const [notif, setNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const timersRef = useRef(timers)
  timersRef.current = timers

  useEffect(() => {
    localStorage.setItem('lab:countdown:timers', JSON.stringify(timers))
  }, [timers])

  const list = timers
  const active = list.find((t) => t.id === activeId) ?? list[0]!
  const activeSafeId = active.id

  useEffect(() => {
    if (!list.some((t) => t.id === activeId)) setActiveId(activeSafeId)
  }, [list, activeId, activeSafeId, setActiveId])

  const prevActive = useRef('')
  useEffect(() => {
    if (prevActive.current === activeSafeId) return
    prevActive.current = activeSafeId
    setDraftLabel(active.label)
    if (!active.running && active.left === 0 && !active.done) {
      setMins(Math.floor(active.total / 60))
      setSecs(active.total % 60)
    } else {
      const base = active.left > 0 ? active.left : active.total
      setMins(Math.floor(base / 60))
      setSecs(base % 60)
    }
  }, [activeSafeId, active.label, active.running, active.left, active.done, active.total])

  const anyRunning = timers.some((t) => t.running)

  useEffect(() => {
    if (!anyRunning) return

    const id = window.setInterval(() => {
      const now = Date.now()
      const xs = timersRef.current
      const finished: DoneItem[] = []
      let changed = false
      const next = xs.map((t) => {
        if (!t.running || t.endsAt == null) return t
        const left = Math.max(0, Math.ceil((t.endsAt - now) / 1000))
        if (left === t.left && left > 0) return t
        changed = true
        if (left <= 0) {
          const lb = limitText(t.label.trim() || '倒數計時', LABEL_MAX)
          finished.push({ id: uid('cd'), label: lb, seconds: t.total, at: now })
          return { ...t, left: 0, running: false, done: true, endsAt: undefined }
        }
        return { ...t, left }
      })
      if (!changed) return
      timersRef.current = next
      setTimers(next)
      if (finished.length) {
        for (const f of finished) {
          beep(soundRef.current)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(`${f.label} — 時間到！`)
          }
        }
        setCompleted((cs) => [...finished, ...cs].slice(0, DONE_CAP))
      }
    }, 250)

    return () => clearInterval(id)
  }, [anyRunning, setCompleted])

  useEffect(() => {
    const runningOnes = timers.filter((t) => t.running)
    if (!runningOnes.length) {
      document.title = meta.title
      return
    }
    const focus =
      runningOnes.find((t) => t.id === activeSafeId) ??
      [...runningOnes].sort((a, b) => a.left - b.left)[0]!
    document.title = `${formatClock(focus.left)} · ${focus.label}｜倒數`
    return () => {
      document.title = meta.title
    }
  }, [timers, activeSafeId])

  const toggleRef = useRef(() => {})
  const resetRef = useRef(() => {})

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        toggleRef.current()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const recentSafe = useMemo(
    () =>
      (recent ?? []).map((h) => ({
        id: String(h.id),
        label: h.label,
        seconds: h.seconds,
        at: h.at,
      })),
    [recent],
  )

  const previewTotal = clamp(mins, MINS_MIN, MINS_MAX) * 60 + clamp(secs, SECS_MIN, SECS_MAX)
  const canStartFresh = previewTotal > 0 && isNonEmpty(draftLabel)
  const displayLeft =
    active.running || active.left > 0 || active.done ? active.left : previewTotal
  const pct = active.total > 0 ? ((active.total - active.left) / active.total) * 100 : 0
  const ringR = 54
  const ringC = 2 * Math.PI * ringR
  const showProgress = active.running || active.left > 0 || active.done
  const ringOffset = ringC * (1 - (showProgress ? pct : 0) / 100)
  const stageMode = active.done ? 'is-done' : active.running ? 'is-running' : ''

  function patchActive(updater: (t: Timer) => Timer) {
    setTimers((xs) => xs.map((t) => (t.id === activeIdRef.current ? updater(t) : t)))
  }

  function rememberRecent(seconds: number, title: string) {
    const item: RecentItem = {
      id: uid('cd'),
      label: limitText(title.trim(), LABEL_MAX),
      seconds,
      at: Date.now(),
    }
    setRecent((xs) => {
      const filtered = xs.filter((h) => !(h.label === item.label && h.seconds === item.seconds))
      return [item, ...filtered].slice(0, HISTORY_CAP)
    })
  }

  function startActive() {
    const m = clamp(Number.isFinite(mins) ? mins : 0, MINS_MIN, MINS_MAX)
    const s = clamp(Number.isFinite(secs) ? secs : 0, SECS_MIN, SECS_MAX)
    const total = m * 60 + s
    if (!total || !isNonEmpty(draftLabel)) return
    const label = limitText(draftLabel.trim(), LABEL_MAX)
    rememberRecent(total, label)
    patchActive((t) => ({
      ...t,
      label,
      total,
      left: total,
      running: true,
      done: false,
      endsAt: Date.now() + total * 1000,
    }))
  }

  function resumeActive() {
    patchActive((t) => {
      if (t.left <= 0 || t.done) return t
      return { ...t, running: true, done: false, endsAt: Date.now() + t.left * 1000 }
    })
  }

  function pauseActive() {
    patchActive((t) => {
      const synced = syncRunningLeft(t)
      return { ...synced, running: false, endsAt: undefined }
    })
  }

  function toggleActive() {
    const t = timersRef.current.find((x) => x.id === activeIdRef.current) ?? timersRef.current[0]
    if (!t) return
    if (t.running) pauseActive()
    else if (t.left > 0 && !t.done) resumeActive()
    else startActive()
  }

  function resetActive() {
    patchActive((t) => ({
      ...t,
      left: 0,
      running: false,
      done: false,
      endsAt: undefined,
    }))
  }

  toggleRef.current = toggleActive
  resetRef.current = resetActive

  function applyDuration(m: number, s: number, title?: string) {
    if (active.running) return
    const mm = clamp(m, MINS_MIN, MINS_MAX)
    const ss = clamp(s, SECS_MIN, SECS_MAX)
    const total = mm * 60 + ss
    setMins(mm)
    setSecs(ss)
    if (title) setDraftLabel(limitText(title, LABEL_MAX))
    patchActive((t) => ({
      ...t,
      label: title ? limitText(title, LABEL_MAX) : t.label,
      total,
      left: 0,
      running: false,
      done: false,
      endsAt: undefined,
    }))
  }

  function nudge(deltaSec: number) {
    if (active.running) return
    if (active.left > 0 && !active.done) {
      const next = clamp(active.left + deltaSec, 1, 999 * 60 + 59)
      setMins(Math.floor(next / 60))
      setSecs(next % 60)
      patchActive((t) => ({ ...t, left: next, total: next, done: false, endsAt: undefined }))
      return
    }
    const next = clamp(previewTotal + deltaSec, 0, MINS_MAX * 60 + SECS_MAX)
    setMins(Math.floor(next / 60))
    setSecs(next % 60)
    patchActive((t) => ({ ...t, total: next || t.total, left: 0, done: false, endsAt: undefined }))
  }

  function addTimer() {
    if (list.length >= TIMER_CAP) return
    const t = createTimer({
      label: draftLabel.trim() || `倒數 ${list.length + 1}`,
      total: previewTotal || 5 * 60,
    })
    setTimers((xs) => [...xs, t])
    setActiveId(t.id)
    setDraftLabel(t.label)
    setMins(Math.floor(t.total / 60))
    setSecs(t.total % 60)
  }

  function removeTimer(id: string) {
    setTimers((xs) => {
      if (xs.length <= 1) return xs
      const next = xs.filter((t) => t.id !== id)
      if (id === activeIdRef.current) setActiveId(next[0]!.id)
      return next
    })
  }

  async function enableNotif() {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotif(p)
  }

  return (
    <ProjectShell meta={meta}>
      <div className={`cd ${stageMode}`.trim()}>
        <div className="cd-stage panel">
          <div className="cd-title">{isNonEmpty(active.label) ? active.label : '倒數計時'}</div>
          <div className="cd-ring-wrap">
            <svg className="cd-ring" viewBox="0 0 120 120" aria-hidden>
              <circle className="cd-ring-track" cx="60" cy="60" r={ringR} />
              <circle
                className="cd-ring-value"
                cx="60"
                cy="60"
                r={ringR}
                strokeDasharray={ringC}
                strokeDashoffset={showProgress ? ringOffset : ringC}
              />
            </svg>
            <div className="cd-clock">
              <div className="cd-time mono" aria-live="polite">
                {formatClock(Math.max(0, displayLeft))}
              </div>
              <div className="cd-phase">
                {active.done ? '時間到' : active.running ? '倒數中' : active.left > 0 ? '已暫停' : '就緒'}
              </div>
            </div>
          </div>
          {list.length > 1 && (
            <p className="muted cd-multi-hint">
              {list.filter((t) => t.running).length} 組進行中 · 共 {list.length} 組
            </p>
          )}

          <div className="cd-actions">
            <button type="button" className="btn ghost pomo-icon-btn" onClick={resetActive} aria-label="重置" title="重置（R）">
              <IconReset size={18} strokeWidth={2.25} />
            </button>
            {!active.running ? (
              <button
                type="button"
                className="btn accent pomo-main"
                onClick={() => {
                  if (active.left > 0 && !active.done) resumeActive()
                  else startActive()
                }}
                disabled={active.left > 0 && !active.done ? false : !canStartFresh}
              >
                <IconPlay size={20} strokeWidth={2.4} />
                {active.left > 0 && !active.done ? '繼續' : '開始'}
              </button>
            ) : (
              <button type="button" className="btn accent pomo-main" onClick={pauseActive}>
                <IconPause size={20} strokeWidth={2.4} />
                暫停
              </button>
            )}
          </div>
          <p className="muted cd-keys">空白鍵開始／暫停 · R 重置</p>
        </div>

        <div className="cd-side">
          <div className="panel stack cd-panel">
            <div className="pomo-history-head">
              <h3>計時器</h3>
              <AddButton className="sm" onClick={addTimer} disabled={list.length >= TIMER_CAP}>
                新增
              </AddButton>
            </div>
            {list.length >= TIMER_CAP && <p className="muted">最多 {TIMER_CAP} 組同時存在</p>}
            <ul className="cd-timer-list">
              {list.map((t) => (
                <li key={t.id} className="cd-timer-row">
                  <button
                    type="button"
                    className={`cd-timer-card${t.id === activeSafeId ? ' is-active' : ''}${t.running ? ' is-running' : ''}${t.done ? ' is-done' : ''}`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <span className="cd-timer-card-label">{t.label}</span>
                    <span className="cd-timer-card-time mono">
                      {formatClock(t.running || t.left > 0 || t.done ? t.left : t.total)}
                    </span>
                    <span className="cd-timer-card-state">
                      {t.done ? '完成' : t.running ? '進行中' : t.left > 0 ? '暫停' : '就緒'}
                    </span>
                  </button>
                  <DeleteButton disabled={list.length <= 1} onClick={() => removeTimer(t.id)} aria-label={`刪除 ${t.label}`} />
                </li>
              ))}
            </ul>
          </div>

          <div className="panel stack cd-panel cd-controls">
            <h3>設定目前計時器</h3>
            <div className="cd-label-row">
              <input
                className={`field cd-label${!isNonEmpty(draftLabel) ? ' is-invalid' : ''}`}
                value={draftLabel}
                maxLength={LABEL_MAX}
                disabled={active.running}
                onChange={(e) => {
                  const v = limitText(e.target.value, LABEL_MAX)
                  setDraftLabel(v)
                  if (!active.running) patchActive((t) => ({ ...t, label: v.trim() ? v : t.label }))
                }}
                placeholder="倒數標題…"
                aria-label="倒數標題"
              />
              <span className="char-inline">
                {charCount(draftLabel)} / {LABEL_MAX}
              </span>
            </div>
            {!isNonEmpty(draftLabel) && <p className="field-error">請輸入標題</p>}

            <div className="cd-duration" role="group" aria-label="快速時長">
              <div className="cd-duration-head">
                <span className="cd-duration-title">時長</span>
                <div className="cd-nudge">
                  <button type="button" className="cd-nudge-btn" onClick={() => nudge(-60)} disabled={active.running || (previewTotal < 60 && active.left === 0)} aria-label="減少 1 分">
                    −1m
                  </button>
                  <button type="button" className="cd-nudge-btn" onClick={() => nudge(-10)} disabled={active.running || (previewTotal < 10 && active.left === 0)} aria-label="減少 10 秒">
                    −10s
                  </button>
                  <button type="button" className="cd-nudge-btn" onClick={() => nudge(10)} disabled={active.running} aria-label="增加 10 秒">
                    +10s
                  </button>
                  <button type="button" className="cd-nudge-btn" onClick={() => nudge(60)} disabled={active.running} aria-label="增加 1 分">
                    +1m
                  </button>
                </div>
              </div>
              <div className="cd-duration-grid">
                {PRESETS.map((p) => {
                  const selected =
                    !active.running && active.left === 0 && !active.done && mins === p.m && secs === p.s
                  return (
                    <button
                      key={`${p.m}:${p.s}`}
                      type="button"
                      className={`cd-duration-tile${selected ? ' is-active' : ''}`}
                      aria-pressed={selected}
                      disabled={active.running}
                      onClick={() => applyDuration(p.m, p.s)}
                    >
                      <span className="cd-duration-num mono">{p.m}</span>
                      <span className="cd-duration-unit">分</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {active.left === 0 && !active.done && (
              <div className="cd-inputs">
                <label className="cd-input">
                  <span className="label">分鐘</span>
                  <input
                    className="field"
                    type="number"
                    min={MINS_MIN}
                    max={MINS_MAX}
                    value={mins}
                    disabled={active.running}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      const mm = clamp(n, MINS_MIN, MINS_MAX)
                      setMins(mm)
                      patchActive((t) => ({ ...t, total: mm * 60 + secs, left: 0, done: false }))
                    }}
                  />
                </label>
                <label className="cd-input">
                  <span className="label">秒</span>
                  <input
                    className="field"
                    type="number"
                    min={SECS_MIN}
                    max={SECS_MAX}
                    value={secs}
                    disabled={active.running}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      const ss = clamp(n, SECS_MIN, SECS_MAX)
                      setSecs(ss)
                      patchActive((t) => ({ ...t, total: mins * 60 + ss, left: 0, done: false }))
                    }}
                  />
                </label>
              </div>
            )}

            <div className="cd-options">
              <label className="pomo-check">
                <input type="checkbox" checked={soundOn} onChange={() => setSoundOn(!soundOn)} />
                <span>結束時播放提示音</span>
              </label>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void enableNotif()}
                disabled={notif === 'granted'}
              >
                {notif === 'granted' ? '通知已開啟' : '開啟桌面通知'}
              </button>
            </div>
          </div>

          <div className="panel stack cd-panel">
            <div className="pomo-history-head">
              <h3>最近設定</h3>
              <button type="button" className="btn ghost sm" disabled={!recentSafe.length} onClick={() => setRecent([])}>
                清除
              </button>
            </div>
            {!recentSafe.length && <p className="muted">開始倒數後會記住設定</p>}
            <ul className="cd-list">
              {recentSafe.map((h) => (
                <li key={h.id} className="cd-list-item">
                  <div className="cd-list-body">
                    <strong>{h.label}</strong>
                    <span className="muted">{formatDuration(h.seconds)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={active.running}
                    onClick={() => applyDuration(Math.floor(h.seconds / 60), h.seconds % 60, h.label)}
                  >
                    套用
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel stack cd-panel">
            <div className="pomo-history-head">
              <h3>完成紀錄</h3>
              <button
                type="button"
                className="btn ghost sm"
                disabled={!completed.length}
                onClick={() => {
                  if (confirm('確定清除完成紀錄？')) setCompleted([])
                }}
              >
                清除
              </button>
            </div>
            {!completed.length && <p className="muted">倒數結束後會出現在這裡</p>}
            <ul className="cd-list">
              {completed.map((h) => (
                <li key={h.id} className="cd-list-item">
                  <div className="cd-list-body">
                    <strong>{h.label}</strong>
                    <span className="muted">
                      {formatDuration(h.seconds)} · {formatWhen(h.at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={active.running}
                    onClick={() => applyDuration(Math.floor(h.seconds / 60), h.seconds % 60, h.label)}
                  >
                    再來一次
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
