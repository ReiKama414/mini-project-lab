import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, parseNumber } from '../../lib/utils'

const meta = getProject('pomodoro')!

const WORK_MIN = 1
const WORK_MAX = 60
const SHORT_MIN = 1
const SHORT_MAX = 30
const LONG_MIN = 5
const LONG_MAX = 45

type Mode = 'work' | 'short' | 'long'

function beep() {
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

export default function Page() {
  const [workMin, setWorkMin] = useLocalStorage('lab:pomodoro:work', 25)
  const [shortMin, setShortMin] = useLocalStorage('lab:pomodoro:short', 5)
  const [longMin, setLongMin] = useLocalStorage('lab:pomodoro:long', 15)
  const [autoStart, setAutoStart] = useLocalStorage('lab:pomodoro:auto', true)
  const [cycles, setCycles] = useLocalStorage('lab:pomodoro:cycles', 0)

  const [mode, setMode] = useState<Mode>('work')
  const [seconds, setSeconds] = useState(Math.max(1, workMin) * 60)
  const [running, setRunning] = useState(false)

  const modeRef = useRef(mode)
  const cyclesRef = useRef(cycles)
  const autoRef = useRef(autoStart)
  const minsRef = useRef({ workMin, shortMin, longMin })
  modeRef.current = mode
  cyclesRef.current = cycles
  autoRef.current = autoStart
  minsRef.current = { workMin, shortMin, longMin }

  function durationOf(m: Mode) {
    const { workMin: w, shortMin: s, longMin: l } = minsRef.current
    if (m === 'work') return clamp(Math.max(1, w), WORK_MIN, WORK_MAX) * 60
    if (m === 'short') return clamp(Math.max(1, s), SHORT_MIN, SHORT_MAX) * 60
    return clamp(Math.max(1, l), LONG_MIN, LONG_MAX) * 60
  }

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s > 1) return s - 1

        beep()
        const cur = modeRef.current
        let next: Mode = 'work'
        let nextCycles = cyclesRef.current

        if (cur === 'work') {
          nextCycles += 1
          setCycles(nextCycles)
          next = nextCycles % 4 === 0 ? 'long' : 'short'
        } else {
          next = 'work'
        }

        setMode(next)
        if (!autoRef.current) setRunning(false)

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(cur === 'work' ? '專注結束，休息一下' : '休息結束，繼續專注')
        }

        return durationOf(next)
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, setCycles])

  const total = durationOf(mode)
  const pct = ((total - seconds) / total) * 100
  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  function switchMode(next: Mode) {
    setMode(next)
    setSeconds(durationOf(next))
    setRunning(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="row">
            {(
              [
                ['work', '專注'],
                ['short', '短休'],
                ['long', '長休'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className={`btn sm ${mode === k ? (k === 'work' ? 'accent' : 'teal') : 'ghost'}`}
                onClick={() => switchMode(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="metric mono" style={{ fontSize: 56 }}>
            {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </div>
          <div className="progress" style={{ width: '100%' }}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">已完成 {cycles} 個番茄 · 每 4 個進入長休</p>
          <div className="row">
            <button className="btn accent" onClick={() => setRunning((r) => !r)}>
              {running ? '暫停' : '開始'}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setRunning(false)
                setSeconds(durationOf(mode))
              }}
            >
              重置
            </button>
            <button
              className="btn ghost sm"
              onClick={() => void Notification?.requestPermission?.()}
            >
              開啟通知
            </button>
          </div>
        </div>

        <div className="panel stack">
          <h3>設定</h3>
          <label className="label">專注（分）{workMin}（{WORK_MIN}–{WORK_MAX}）</label>
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
          />
          <label className="label">短休（分）{shortMin}（{SHORT_MIN}–{SHORT_MAX}）</label>
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
          />
          <label className="label">長休（分）{longMin}（{LONG_MIN}–{LONG_MAX}）</label>
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
          />
          <label className="row">
            <input type="checkbox" checked={autoStart} onChange={() => setAutoStart(!autoStart)} />
            階段結束後自動開始下一輪
          </label>
          <button className="btn ghost sm" onClick={() => setCycles(0)}>
            重置番茄計數
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
