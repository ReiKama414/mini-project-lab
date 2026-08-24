import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('cron-generator')!

const PRESETS = [
  { label: '每分鐘', expr: '* * * * *' },
  { label: '每 5 分鐘', expr: '*/5 * * * *' },
  { label: '每小時', expr: '0 * * * *' },
  { label: '每天 0:00', expr: '0 0 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '平日 9:00', expr: '0 9 * * 1-5' },
  { label: '每週一 9:00', expr: '0 9 * * 1' },
  { label: '每月 1 號', expr: '0 0 1 * *' },
]

const DOW_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MON_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

function describeField(label: string, value: string, unit: string, names?: string[]): string {
  const v = value.trim()
  if (v === '*') return `每${unit}`
  if (v === '?') return `${label}不指定`
  const step = /^\*\/(\d+)$/.exec(v)
  if (step) return `每 ${step[1]} ${unit}`
  if (/^\d+$/.test(v)) {
    const n = Number(v)
    if (names && n >= 0 && n < names.length) return `${label}為週${names[n]}`
    if (label === '月' && n >= 1 && n <= 12) return `${label}為 ${MON_NAMES[n - 1]}月`
    return `${label}為 ${v}`
  }
  if (/^\d+-\d+$/.test(v)) return `${label}從 ${v.replace('-', ' 到 ')}`
  if (v.includes(',')) return `${label}為 ${v.split(',').join('、')}`
  return `${label}=${v}`
}

function describeCron(min: string, hour: string, dom: string, mon: string, dow: string) {
  const parts = [
    describeField('分', min, '分鐘'),
    describeField('時', hour, '小時'),
    describeField('日', dom, '日'),
    describeField('月', mon, '月'),
    describeField('週', dow, '週', DOW_NAMES),
  ]
  // friendlier common cases
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '每分鐘執行一次'
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `每 ${min.slice(2)} 分鐘執行一次`
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    return `每天 ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 執行`
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && /^\d$/.test(dow)) {
    return `每週${DOW_NAMES[Number(dow)]} ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 執行`
  }
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '每小時的第 0 分執行'
  return parts.join('；')
}

export default function Page() {
  const [min, setMin] = useLocalStorage('lab:cron-generator:min', '0')
  const [hour, setHour] = useLocalStorage('lab:cron-generator:hour', '9')
  const [dom, setDom] = useLocalStorage('lab:cron-generator:dom', '*')
  const [mon, setMon] = useLocalStorage('lab:cron-generator:mon', '*')
  const [dow, setDow] = useLocalStorage('lab:cron-generator:dow', '*')

  const expr = useMemo(() => `${min} ${hour} ${dom} ${mon} ${dow}`, [min, hour, dom, mon, dow])
  const human = useMemo(() => describeCron(min, hour, dom, mon, dow), [min, hour, dom, mon, dow])

  function applyExpr(e: string) {
    const [a, b, c, d, f] = e.split(/\s+/)
    if (a == null || b == null || c == null || d == null || f == null) return
    setMin(a)
    setHour(b)
    setDom(c)
    setMon(d)
    setDow(f)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button key={p.expr + p.label} className="btn sm ghost" onClick={() => applyExpr(p.expr)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid-3">
          {(
            [
              ['分（0–59）', min, setMin],
              ['時（0–23）', hour, setHour],
              ['日（1–31）', dom, setDom],
              ['月（1–12）', mon, setMon],
              ['週（0–6，0=日）', dow, setDow],
            ] as const
          ).map(([label, val, set]) => (
            <label key={label} className="stack">
              <span className="label">{label}</span>
              <input className="field mono" value={val} onChange={(e) => set(e.target.value)} />
            </label>
          ))}
        </div>
        <div className="metric stack">
          <div className="muted">Cron 表達式（分 時 日 月 週）</div>
          <div className="row">
            <code className="mono" style={{ fontSize: 22 }}>
              {expr}
            </code>
            <button className="btn sm accent" onClick={() => void copyText(expr)}>
              複製
            </button>
          </div>
        </div>
        <div className="metric">
          <div className="muted">人類可讀說明</div>
          <p style={{ margin: '8px 0 0', fontSize: 16 }}>{human}</p>
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => void copyText(human)}>
            複製說明
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          標準 5 欄位 cron。可用 <code>*</code>、<code>*/n</code>、<code>a-b</code>、<code>a,b</code>。實際排程行為依系統（如 crontab / CI）而定。
        </p>
      </div>
    </ProjectShell>
  )
}
