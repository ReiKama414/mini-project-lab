import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { IconCrown, IconFlag, IconPause, IconPlay, IconReset, IconTurtle } from '../../components/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('stopwatch')!

function fmt(ms: number) {
  const safe = Math.max(0, ms)
  const total = Math.floor(safe / 10)
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000) % 60
  const h = Math.floor(total / 360000)
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export default function Page() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])
  const [copied, setCopied] = useState(false)

  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed

  useEffect(() => {
    if (!running) return
    const start = performance.now() - elapsed
    const id = window.setInterval(() => setElapsed(performance.now() - start), 16)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => {
    document.title = running ? `${fmt(elapsed)}｜秒錶` : meta.title
    return () => {
      document.title = meta.title
    }
  }, [running, elapsed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.code === 'Space') {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        const cur = elapsedRef.current
        if (cur > 0) setLaps((xs) => [cur, ...xs])
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setRunning(false)
        setElapsed(0)
        setLaps([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const deltas = useMemo(() => {
    return laps.map((lap, i) => {
      const prev = i === laps.length - 1 ? 0 : laps[i + 1]!
      return lap - prev
    })
  }, [laps])

  const bestIdx = useMemo(() => {
    if (deltas.length < 2) return -1
    let bi = 0
    for (let i = 1; i < deltas.length; i++) if (deltas[i]! < deltas[bi]!) bi = i
    return bi
  }, [deltas])

  const worstIdx = useMemo(() => {
    if (deltas.length < 2) return -1
    let wi = 0
    for (let i = 1; i < deltas.length; i++) if (deltas[i]! > deltas[wi]!) wi = i
    return wi
  }, [deltas])

  const avgLap = useMemo(() => {
    if (!deltas.length) return 0
    return deltas.reduce((a, b) => a + b, 0) / deltas.length
  }, [deltas])

  const exportText = useMemo(() => {
    const lines = [
      `總時間 ${fmt(elapsed)}`,
      `單圈數 ${laps.length}`,
      deltas.length ? `平均單圈 ${fmt(avgLap)}` : '',
      '',
      ...laps.map((lap, i) => {
        const n = laps.length - i
        const tag = i === bestIdx ? ' 最快' : i === worstIdx ? ' 最慢' : ''
        return `#${n}\t${fmt(lap)}\t+${fmt(deltas[i]!)}${tag}`
      }),
    ].filter(Boolean)
    return lines.join('\n')
  }, [elapsed, laps, deltas, bestIdx, worstIdx, avgLap])

  function reset() {
    setRunning(false)
    setElapsed(0)
    setLaps([])
    setCopied(false)
  }

  function addLap() {
    if (elapsed <= 0) return
    setLaps((xs) => [elapsed, ...xs])
  }

  async function copyLaps() {
    await copyText(exportText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <ProjectShell meta={meta}>
      <div className={`sw${running ? ' is-running' : ''}${!running && elapsed > 0 ? ' is-paused' : ''}`}>
        <div className="sw-stage panel">
          <div className="sw-phase">
            {running ? '計時中' : elapsed > 0 ? '已暫停' : '就緒'}
          </div>
          <div className="sw-time mono" aria-live="polite">
            {fmt(elapsed)}
          </div>

          <div className="sw-actions">
            <button type="button" className="btn ghost pomo-icon-btn" onClick={reset} aria-label="重置" title="重置（R）">
              <IconReset size={18} strokeWidth={2.25} />
            </button>
            <button type="button" className="btn accent pomo-main" onClick={() => setRunning((r) => !r)}>
              {running ? <IconPause size={20} strokeWidth={2.4} /> : <IconPlay size={20} strokeWidth={2.4} />}
              {running ? '暫停' : elapsed > 0 ? '繼續' : '開始'}
            </button>
            <button
              type="button"
              className="btn ghost pomo-icon-btn"
              disabled={elapsed === 0}
              onClick={addLap}
              aria-label="記錄單圈"
              title="單圈（L）"
            >
              <IconFlag size={18} strokeWidth={2.25} />
            </button>
          </div>
          <p className="muted sw-keys">
            空白鍵開始／暫停 · L 單圈 · R 重置
          </p>
        </div>

        <div className="sw-side">
          <div className="sw-stats panel">
            <div className="sw-stat">
              <span className="sw-stat-val mono">{laps.length}</span>
              <span className="sw-stat-label">單圈數</span>
            </div>
            <div className="sw-stat">
              <span className="sw-stat-val mono">{deltas.length ? fmt(avgLap) : '—'}</span>
              <span className="sw-stat-label">平均單圈</span>
            </div>
            <div className="sw-stat">
              <span className="sw-stat-val mono">{bestIdx >= 0 ? fmt(deltas[bestIdx]!) : '—'}</span>
              <span className="sw-stat-label">最快</span>
            </div>
            <div className="sw-stat">
              <span className="sw-stat-val mono">{worstIdx >= 0 ? fmt(deltas[worstIdx]!) : '—'}</span>
              <span className="sw-stat-label">最慢</span>
            </div>
          </div>

          <div className="panel stack sw-laps-panel">
            <div className="pomo-history-head">
              <h3>單圈紀錄</h3>
              <div className="sw-lap-tools">
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={!laps.length}
                  onClick={() => void copyLaps()}
                >
                  {copied ? '已複製' : '複製'}
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={!laps.length}
                  onClick={() => downloadText(`laps-${Date.now()}.txt`, exportText)}
                >
                  匯出
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={!laps.length}
                  onClick={() => setLaps([])}
                >
                  清除單圈
                </button>
              </div>
            </div>

            {!laps.length && <p className="muted">按旗標或 L 記錄單圈</p>}

            {laps.length > 0 && (
              <ul className="sw-lap-list">
                {laps.map((lap, i) => {
                  const n = laps.length - i
                  const isBest = i === bestIdx
                  const isWorst = i === worstIdx
                  return (
                    <li
                      key={`${lap}-${i}`}
                      className={`sw-lap-item${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
                    >
                      <span className="sw-lap-n">#{n}</span>
                      <span className="sw-lap-total">
                        <span className="mono">{fmt(lap)}</span>
                        {isBest && (
                          <span className="sw-lap-mark is-best" title="最快單圈" aria-label="最快單圈">
                            <IconCrown size={14} strokeWidth={2.25} />
                          </span>
                        )}
                        {isWorst && (
                          <span className="sw-lap-mark is-worst" title="最慢單圈" aria-label="最慢單圈">
                            <IconTurtle size={14} strokeWidth={2.25} />
                          </span>
                        )}
                      </span>
                      <span className="sw-lap-split mono">+{fmt(deltas[i]!)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
