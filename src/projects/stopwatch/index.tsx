import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'

const meta = getProject('stopwatch')!

function fmt(ms: number) {
  const total = Math.floor(ms / 10)
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export default function Page() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [laps, setLaps] = useState<number[]>([])

  useEffect(() => {
    if (!running) return
    const start = performance.now() - elapsed
    const id = setInterval(() => setElapsed(performance.now() - start), 16)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

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

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="metric mono" style={{ fontSize: 52, textAlign: 'center' }}>
          {fmt(elapsed)}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn accent" onClick={() => setRunning((r) => !r)}>
            {running ? '暫停' : '開始'}
          </button>
          <button
            className="btn teal"
            disabled={elapsed === 0}
            onClick={() => setLaps([elapsed, ...laps])}
          >
            單圈
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setRunning(false)
              setElapsed(0)
              setLaps([])
            }}
          >
            重置
          </button>
          <button
            className="btn ghost sm"
            disabled={!laps.length}
            onClick={() =>
              void copyText(
                laps
                  .map((lap, i) => `#${laps.length - i}  ${fmt(lap)}  (+${fmt(deltas[i]!)})`)
                  .join('\n'),
              )
            }
          >
            複製單圈
          </button>
        </div>
        {laps.length > 0 && (
          <ul className="list">
            {laps.map((lap, i) => (
              <li key={i} className="list-item">
                <span>圈 {laps.length - i}</span>
                <span className="mono" style={{ flex: 1, textAlign: 'right' }}>
                  {fmt(lap)}
                </span>
                <span
                  className="tag"
                  style={{
                    background:
                      i === bestIdx
                        ? 'var(--teal-soft)'
                        : i === worstIdx
                          ? 'var(--rose-soft)'
                          : 'var(--bg-muted)',
                  }}
                >
                  +{fmt(deltas[i]!)}
                  {i === bestIdx ? ' 最快' : i === worstIdx ? ' 最慢' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProjectShell>
  )
}
