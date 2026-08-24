import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText } from '../../lib/utils'

const meta = getProject('cron-generator')!

const FIELD_MAX = 40

const PRESETS = [
  { label: '每分鐘', expr: '* * * * *' },
  { label: '每 5 分鐘', expr: '*/5 * * * *' },
  { label: '每 15 分鐘', expr: '*/15 * * * *' },
  { label: '每小時', expr: '0 * * * *' },
  { label: '每天 0:00', expr: '0 0 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '平日 9:00', expr: '0 9 * * 1-5' },
  { label: '每週一 9:00', expr: '0 9 * * 1' },
  { label: '每月 1 號', expr: '0 0 1 * *' },
  { label: '每季初', expr: '0 0 1 1,4,7,10 *' },
]

const DOW_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MON_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

function matchField(value: string, current: number, min: number, max: number): boolean {
  const v = value.trim()
  if (v === '*' || v === '?') return true
  const step = /^\*\/(\d+)$/.exec(v)
  if (step) {
    const n = Number(step[1])
    return n > 0 && current % n === 0
  }
  if (/^\d+$/.test(v)) return Number(v) === current
  if (/^\d+-\d+$/.test(v)) {
    const [a, b] = v.split('-').map(Number)
    return current >= a! && current <= b!
  }
  if (v.includes(',')) {
    return v.split(',').some((part) => matchField(part.trim(), current, min, max))
  }
  const rangeStep = /^(\d+)-(\d+)\/(\d+)$/.exec(v)
  if (rangeStep) {
    const a = Number(rangeStep[1])
    const b = Number(rangeStep[2])
    const s = Number(rangeStep[3])
    return current >= a && current <= b && (current - a) % s === 0
  }
  return false
}

function matchesCron(d: Date, min: string, hour: string, dom: string, mon: string, dow: string) {
  return (
    matchField(min, d.getMinutes(), 0, 59) &&
    matchField(hour, d.getHours(), 0, 23) &&
    matchField(dom, d.getDate(), 1, 31) &&
    matchField(mon, d.getMonth() + 1, 1, 12) &&
    matchField(dow, d.getDay(), 0, 6)
  )
}

/** Approximate next N fire times by scanning minute-by-minute (local time). */
function nextRuns(min: string, hour: string, dom: string, mon: string, dow: string, n = 5) {
  const out: Date[] = []
  const cursor = new Date()
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  const limit = 366 * 24 * 60
  for (let i = 0; i < limit && out.length < n; i++) {
    if (matchesCron(cursor, min, hour, dom, mon, dow)) out.push(new Date(cursor))
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return out
}

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
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '1-5') {
    return `平日（週一至週五） ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 執行`
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
  const upcoming = useMemo(() => nextRuns(min, hour, dom, mon, dow, 5), [min, hour, dom, mon, dow])

  function applyExpr(e: string) {
    const [a, b, c, d, f] = e.split(/\s+/)
    if (a == null || b == null || c == null || d == null || f == null) return
    setMin(limitText(a, FIELD_MAX))
    setHour(limitText(b, FIELD_MAX))
    setDom(limitText(c, FIELD_MAX))
    setMon(limitText(d, FIELD_MAX))
    setDow(limitText(f, FIELD_MAX))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button key={p.expr + p.label} type="button" className="btn sm ghost" onClick={() => applyExpr(p.expr)}>
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
              <input
                className={`field mono${!isNonEmpty(val) ? ' is-invalid' : ''}`}
                value={val}
                maxLength={FIELD_MAX}
                onChange={(e) => set(limitText(e.target.value, FIELD_MAX))}
              />
              <div className="field-meta">
                <span>{charCount(val)} / {FIELD_MAX}</span>
              </div>
              {!isNonEmpty(val) && <p className="field-error">不可空白</p>}
            </label>
          ))}
        </div>
        <div className="metric stack">
          <div className="muted">Cron 表達式（分 時 日 月 週）</div>
          <div className="row">
            <code className="mono" style={{ fontSize: 22 }}>
              {expr}
            </code>
            <button type="button" className="btn sm accent" onClick={() => void copyText(expr)}>
              複製
            </button>
          </div>
        </div>
        <div className="metric">
          <div className="muted">人類可讀說明（繁中）</div>
          <p style={{ margin: '8px 0 0', fontSize: 16 }}>{human}</p>
          <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => void copyText(human)}>
            複製說明
          </button>
        </div>
        <div className="stack">
          <h3 style={{ margin: 0 }}>接下來約 5 次執行（本機時區近似）</h3>
          <ul className="list">
            {upcoming.map((d, i) => (
              <li key={d.getTime()} className="list-item">
                <span className="tag">#{i + 1}</span>
                <span className="mono" style={{ flex: 1 }}>
                  {d.toLocaleString('zh-TW', { hour12: false })}
                </span>
                <span className="muted">週{DOW_NAMES[d.getDay()]}</span>
              </li>
            ))}
            {!upcoming.length && <p className="muted">無法在一年內找到符合的時間，請檢查表達式。</p>}
          </ul>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          標準 5 欄位 cron。下次時間以分鐘掃描近似，複雜日／週交叉條件在真實 crontab 可能略有差異。
        </p>
      </div>
    </ProjectShell>
  )
}
