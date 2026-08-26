import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, limitText, parseNumber, randomInt } from '../../lib/utils'

const meta = getProject('server-monitor')!

const HOST_MAX = 80
const TH_MIN = 50
const TH_MAX = 98

type Metrics = { cpu: number; mem: number; disk: number; netIn: number; netOut: number; load: number }
type Histories = { cpu: number[]; mem: number[]; disk: number[]; load: number[] }
type Alert = { id: string; at: number; metric: string; value: number; threshold: number }

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data)
  const pts = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 100
      const y = 100 - (v / max) * 100
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 48 }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function seedHist(n: number, min: number, max: number, float = false) {
  return Array.from({ length: n }, () => (float ? Number((Math.random() * (max - min) + min).toFixed(2)) : randomInt(min, max)))
}

export default function Page() {
  const [host, setHost] = useLocalStorage('lab:server-monitor:host', 'prod-web-01')
  const [cpuThreshold, setCpuThreshold] = useLocalStorage('lab:server-monitor:cpu-th', 80)
  const [memThreshold, setMemThreshold] = useLocalStorage('lab:server-monitor:mem-th', 85)
  const [diskThreshold, setDiskThreshold] = useLocalStorage('lab:server-monitor:disk-th', 90)
  const [m, setM] = useState<Metrics>({ cpu: 32, mem: 58, disk: 71, netIn: 12, netOut: 8, load: 1.2 })
  const [hist, setHist] = useState<Histories>(() => ({
    cpu: seedHist(40, 10, 70),
    mem: seedHist(40, 40, 75),
    disk: seedHist(40, 55, 80),
    load: seedHist(40, 0.2, 2.5, true),
  }))
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setM((prev) => {
        const next: Metrics = {
          cpu: Math.min(100, Math.max(5, prev.cpu + randomInt(-10, 12))),
          mem: Math.min(100, Math.max(20, prev.mem + randomInt(-4, 4))),
          disk: Math.min(100, Math.max(40, prev.disk + randomInt(-1, 1))),
          netIn: randomInt(5, 40),
          netOut: randomInt(3, 30),
          load: Number((Math.random() * 3.5).toFixed(2)),
        }
        setHist((h) => ({
          cpu: [...h.cpu.slice(1), next.cpu],
          mem: [...h.mem.slice(1), next.mem],
          disk: [...h.disk.slice(1), next.disk],
          load: [...h.load.slice(1), next.load],
        }))
        const now = Date.now()
        if (next.cpu >= cpuThreshold) {
          setAlerts((a) => [{ id: `a_${now}_cpu`, at: now, metric: 'CPU', value: next.cpu, threshold: cpuThreshold }, ...a].slice(0, 40))
        }
        if (next.mem >= memThreshold) {
          setAlerts((a) => [{ id: `a_${now}_mem`, at: now, metric: 'Memory', value: next.mem, threshold: memThreshold }, ...a].slice(0, 40))
        }
        if (next.disk >= diskThreshold) {
          setAlerts((a) => [{ id: `a_${now}_disk`, at: now, metric: 'Disk', value: next.disk, threshold: diskThreshold }, ...a].slice(0, 40))
        }
        return next
      })
    }, 1200)
    return () => clearInterval(id)
  }, [cpuThreshold, memThreshold, diskThreshold, paused])

  const cards = useMemo(
    () => [
      { label: 'CPU', value: `${m.cpu}%`, pct: m.cpu, warn: m.cpu >= cpuThreshold },
      { label: 'Memory', value: `${m.mem}%`, pct: m.mem, warn: m.mem >= memThreshold },
      { label: 'Disk', value: `${m.disk}%`, pct: m.disk, warn: m.disk >= diskThreshold },
      { label: 'Load', value: String(m.load), warn: m.load >= 2.5 },
      { label: 'Net In', value: `${m.netIn} MB/s` },
      { label: 'Net Out', value: `${m.netOut} MB/s` },
    ],
    [m, cpuThreshold, memThreshold, diskThreshold],
  )

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className={`btn sm ${paused ? 'accent' : 'ghost'}`} onClick={() => setPaused((p) => !p)}>
          {paused ? '繼續' : '暫停'}
        </button>
      }
    >
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機模擬資料，非真實 Docker／主機監控
      </p>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="label" style={{ margin: 0 }}>
            Hostname
          </label>
          <input
            className={`field${!host.trim() ? ' is-invalid' : ''}`}
            value={host}
            maxLength={HOST_MAX}
            onChange={(e) => setHost(limitText(e.target.value, HOST_MAX))}
            style={{ maxWidth: 220 }}
          />
          <span className="tag">{paused ? 'paused' : 'live mock'}</span>
        </div>
        <div className="field-meta">
          <span className={!host.trim() ? 'warn' : undefined}>{!host.trim() ? '請輸入 hostname' : ' '}</span>
          <span>
            {charCount(host)} / {HOST_MAX}
          </span>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
          <label className="label" style={{ margin: 0 }}>
            CPU ≥ {cpuThreshold}%
          </label>
          <input
            type="range"
            min={TH_MIN}
            max={95}
            value={clamp(cpuThreshold, TH_MIN, 95)}
            onChange={(e) => setCpuThreshold(clamp(parseNumber(e.target.value, 80), TH_MIN, 95))}
          />
          <label className="label" style={{ margin: 0 }}>
            MEM ≥ {memThreshold}%
          </label>
          <input
            type="range"
            min={TH_MIN}
            max={95}
            value={clamp(memThreshold, TH_MIN, 95)}
            onChange={(e) => setMemThreshold(clamp(parseNumber(e.target.value, 85), TH_MIN, 95))}
          />
          <label className="label" style={{ margin: 0 }}>
            Disk ≥ {diskThreshold}%
          </label>
          <input
            type="range"
            min={TH_MIN}
            max={TH_MAX}
            value={clamp(diskThreshold, TH_MIN, TH_MAX)}
            onChange={(e) => setDiskThreshold(clamp(parseNumber(e.target.value, 90), TH_MIN, TH_MAX))}
          />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="panel metric stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{c.label}</span>
              {c.warn && (
                <span className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
                  ALERT
                </span>
              )}
            </div>
            <div style={{ fontSize: 24 }}>{c.value}</div>
            {c.pct !== undefined && (
              <div className="progress">
                <div
                  style={{
                    width: `${c.pct}%`,
                    height: 6,
                    borderRadius: 4,
                    background: c.warn ? 'var(--rose)' : 'var(--teal)',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div className="panel stack">
          <div className="label">CPU</div>
          <Sparkline data={hist.cpu} color="var(--sky)" />
        </div>
        <div className="panel stack">
          <div className="label">Memory</div>
          <Sparkline data={hist.mem} color="var(--amber)" />
        </div>
        <div className="panel stack">
          <div className="label">Disk</div>
          <Sparkline data={hist.disk} color="var(--rose)" />
        </div>
        <div className="panel stack">
          <div className="label">Load</div>
          <Sparkline data={hist.load} color="var(--teal)" />
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label" style={{ margin: 0 }}>
            告警紀錄 · {host}
          </div>
          <button type="button" className="btn sm ghost" onClick={() => setAlerts([])}>
            清空
          </button>
        </div>
        <ul className="list">
          {alerts.slice(0, 12).map((a) => (
            <li key={a.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{a.metric}</strong> {a.value} ≥ {a.threshold}
              </span>
              <span className="muted mono">{new Date(a.at).toLocaleTimeString('zh-TW')}</span>
            </li>
          ))}
          {!alerts.length && <li className="list-item muted">尚無告警</li>}
        </ul>
      </div>
    </ProjectShell>
  )
}
