import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('countdown')!

const PRESETS = [
  { label: '1 分', m: 1, s: 0 },
  { label: '3 分', m: 3, s: 0 },
  { label: '5 分', m: 5, s: 0 },
  { label: '10 分', m: 10, s: 0 },
  { label: '15 分', m: 15, s: 0 },
  { label: '30 分', m: 30, s: 0 },
]

function beep() {
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

export default function Page() {
  const [mins, setMins] = useState(5)
  const [secs, setSecs] = useState(0)
  const [left, setLeft] = useState(0)
  const [total, setTotal] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [label, setLabel] = useLocalStorage('lab:countdown:label', '倒數計時')
  const [history, setHistory] = useLocalStorage<{ id: number; label: string; seconds: number; at: number }[]>(
    'lab:countdown:history',
    [],
  )

  useEffect(() => {
    if (!running || left <= 0) return
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          setRunning(false)
          setDone(true)
          beep()
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(`${label} — 時間到！`)
          }
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, left, label])

  const pct = useMemo(() => (total ? ((total - left) / total) * 100 : 0), [left, total])
  const mm = Math.floor(left / 60)
  const ss = left % 60

  function start() {
    const t = Math.max(0, mins) * 60 + Math.max(0, Math.min(59, secs))
    if (!t) return
    setTotal(t)
    setLeft(t)
    setDone(false)
    setRunning(true)
    setHistory([{ id: Date.now(), label, seconds: t, at: Date.now() }, ...history].slice(0, 12))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">標題</label>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="btn ghost sm"
                disabled={running}
                onClick={() => {
                  setMins(p.m)
                  setSecs(p.s)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid-2">
            <label className="stack">
              <span className="label">分鐘</span>
              <input
                className="field"
                type="number"
                min={0}
                max={999}
                value={mins}
                disabled={running}
                onChange={(e) => setMins(Number(e.target.value))}
              />
            </label>
            <label className="stack">
              <span className="label">秒</span>
              <input
                className="field"
                type="number"
                min={0}
                max={59}
                value={secs}
                disabled={running}
                onChange={(e) => setSecs(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="metric mono" style={{ fontSize: 48, textAlign: 'center' }}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </div>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          {done && (
            <p className="tag" style={{ textAlign: 'center', background: 'var(--accent)', color: '#fff' }}>
              時間到！
            </p>
          )}
          <div className="row">
            {!running ? (
              <button className="btn accent" onClick={start}>
                開始倒數
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setRunning(false)}>
                暫停
              </button>
            )}
            {left > 0 && !running && !done && (
              <button className="btn teal" onClick={() => setRunning(true)}>
                繼續
              </button>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                setRunning(false)
                setLeft(0)
                setTotal(0)
                setDone(false)
              }}
            >
              重置
            </button>
            <button
              className="btn ghost sm"
              onClick={() => void Notification?.requestPermission?.()}
            >
              通知權限
            </button>
          </div>
        </div>
        <div className="panel stack">
          <h3>最近使用</h3>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{h.label}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {Math.floor(h.seconds / 60)}分 {h.seconds % 60}秒 ·{' '}
                    {new Date(h.at).toLocaleString()}
                  </div>
                </div>
                <button
                  className="btn ghost sm"
                  disabled={running}
                  onClick={() => {
                    setMins(Math.floor(h.seconds / 60))
                    setSecs(h.seconds % 60)
                    setLabel(h.label)
                  }}
                >
                  套用
                </button>
              </li>
            ))}
            {!history.length && <p className="muted">尚無紀錄</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
