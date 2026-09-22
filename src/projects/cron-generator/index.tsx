import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText, copyText, isNonEmpty } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const meta = getProject('cron-generator')!

const FIELD_MAX = 40
const EXPR_MAX = 120
const NEXT_COUNT = 8

type FieldKey = 'min' | 'hour' | 'dom' | 'mon' | 'dow'

const PRESETS = [
  { label: '每分鐘', expr: '* * * * *' },
  { label: '每 5 分鐘', expr: '*/5 * * * *' },
  { label: '每 15 分鐘', expr: '*/15 * * * *' },
  { label: '每 30 分鐘', expr: '*/30 * * * *' },
  { label: '每小時', expr: '0 * * * *' },
  { label: '每 6 小時', expr: '0 */6 * * *' },
  { label: '每天 0:00', expr: '0 0 * * *' },
  { label: '每天 9:00', expr: '0 9 * * *' },
  { label: '每天 12:00', expr: '0 12 * * *' },
  { label: '平日 9:00', expr: '0 9 * * 1-5' },
  { label: '週末 10:00', expr: '0 10 * * 0,6' },
  { label: '每週一 9:00', expr: '0 9 * * 1' },
  { label: '每月 1 號', expr: '0 0 1 * *' },
  { label: '每月月底近似', expr: '0 0 28-31 * *' },
  { label: '每季初', expr: '0 0 1 1,4,7,10 *' },
  { label: '每年 1/1', expr: '0 0 1 1 *' },
]

const DOW_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const MON_NAMES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

const FIELD_META: Record<
  FieldKey,
  { label: string; hint: string; minN: number; maxN: number; chips: string[] }
> = {
  min: {
    label: '分',
    hint: '0–59',
    minN: 0,
    maxN: 59,
    chips: ['*', '0', '*/5', '*/15', '*/30', '0,30'],
  },
  hour: {
    label: '時',
    hint: '0–23',
    minN: 0,
    maxN: 23,
    chips: ['*', '0', '9', '12', '18', '*/6', '9-17'],
  },
  dom: {
    label: '日',
    hint: '1–31',
    minN: 1,
    maxN: 31,
    chips: ['*', '1', '15', '1,15', '1-7'],
  },
  mon: {
    label: '月',
    hint: '1–12',
    minN: 1,
    maxN: 12,
    chips: ['*', '1', '6', '12', '1,4,7,10', '1-3'],
  },
  dow: {
    label: '週',
    hint: '0–6（0=日）',
    minN: 0,
    maxN: 6,
    chips: ['*', '1-5', '0,6', '1', '5', '0'],
  },
}

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
  const dayMatch = matchField(dom, d.getDate(), 1, 31)
  const dowMatch = matchField(dow, d.getDay(), 0, 6)
  // classic cron: when both DOM and DOW are restricted, either may match (OR)
  const bothRestricted = dom.trim() !== '*' && dow.trim() !== '*'
  const dayOk = bothRestricted ? dayMatch || dowMatch : dayMatch && dowMatch
  return (
    matchField(min, d.getMinutes(), 0, 59) &&
    matchField(hour, d.getHours(), 0, 23) &&
    matchField(mon, d.getMonth() + 1, 1, 12) &&
    dayOk
  )
}

function nextRuns(min: string, hour: string, dom: string, mon: string, dow: string, n = NEXT_COUNT) {
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
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && (dow === '0,6' || dow === '6,0')) {
    return `週末 ${hour.padStart(2, '0')}:${min.padStart(2, '0')} 執行`
  }
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '每小時的第 0 分執行'
  return parts.join('；')
}

function estimateInterval(min: string, hour: string, dom: string, mon: string, dow: string): string {
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '約每 1 分鐘'
  const step = /^\*\/(\d+)$/.exec(min.trim())
  if (step && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `約每 ${step[1]} 分鐘`
  }
  if (min === '0' && /^\*\/(\d+)$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    return `約每 ${/^\*\/(\d+)$/.exec(hour)![1]} 小時`
  }
  if (/^\d+$/.test(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '約每 1 小時'
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '*') return '約每天 1 次'
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '1-5') {
    return '約每個平日 1 次'
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && /^\d$/.test(dow)) {
    return '約每週 1 次'
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    return '約每月 1 次'
  }
  return '視欄位組合而定'
}

function validateFieldPart(part: string, min: number, max: number): string | null {
  const v = part.trim()
  if (!v) return '欄位不可空白'
  if (v === '*' || v === '?') return null

  const step = /^\*\/(\d+)$/.exec(v)
  if (step) {
    const n = Number(step[1])
    if (!Number.isInteger(n) || n <= 0) return '步進必須為正整數'
    if (n > max - min + 1) return `步進過大（上限約 ${max - min + 1}）`
    return null
  }

  const rangeStep = /^(\d+)-(\d+)\/(\d+)$/.exec(v)
  if (rangeStep) {
    const a = Number(rangeStep[1])
    const b = Number(rangeStep[2])
    const s = Number(rangeStep[3])
    if (![a, b, s].every(Number.isInteger)) return '範圍／步進須為整數'
    if (a < min || b > max || a > b) return `範圍需在 ${min}–${max} 且由小到大`
    if (s <= 0) return '步進必須為正整數'
    return null
  }

  if (/^\d+-\d+$/.test(v)) {
    const [a, b] = v.split('-').map(Number)
    if (!Number.isInteger(a) || !Number.isInteger(b)) return '範圍須為整數'
    if (a! < min || b! > max || a! > b!) return `範圍需在 ${min}–${max} 且由小到大`
    return null
  }

  if (/^\d+$/.test(v)) {
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) return `數值需在 ${min}–${max}`
    return null
  }

  return '不支援的語法（可用 *、數字、範圍、列表、*/n）'
}

function validateCronField(value: string, min: number, max: number): string | null {
  const v = value.trim()
  if (!v) return '不可空白'
  if (v.includes(',')) {
    for (const p of v.split(',')) {
      const err = validateFieldPart(p, min, max)
      if (err) return err
    }
    return null
  }
  return validateFieldPart(v, min, max)
}

function parseExpr(input: string): { ok: true; parts: [string, string, string, string, string] } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/^@\w+\s*/, '')
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 6) {
    // drop seconds (Quartz / some systems) — keep last 5
    const five = parts.slice(1) as [string, string, string, string, string]
    return { ok: true, parts: five }
  }
  if (parts.length !== 5) return { ok: false, error: '需為 5 欄（分 時 日 月 週）；6 欄會略過秒' }
  return { ok: true, parts: parts as [string, string, string, string, string] }
}

export default function Page() {
  const [min, setMin] = useLocalStorage('lab:cron-generator:min', '0')
  const [hour, setHour] = useLocalStorage('lab:cron-generator:hour', '9')
  const [dom, setDom] = useLocalStorage('lab:cron-generator:dom', '*')
  const [mon, setMon] = useLocalStorage('lab:cron-generator:mon', '*')
  const [dow, setDow] = useLocalStorage('lab:cron-generator:dow', '*')
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const setters: Record<FieldKey, (v: string) => void> = {
    min: setMin,
    hour: setHour,
    dom: setDom,
    mon: setMon,
    dow: setDow,
  }
  const values: Record<FieldKey, string> = { min, hour, dom, mon, dow }

  const fieldErrors = useMemo(() => {
    const out: Record<FieldKey, string | null> = {
      min: validateCronField(min, 0, 59),
      hour: validateCronField(hour, 0, 23),
      dom: validateCronField(dom, 1, 31),
      mon: validateCronField(mon, 1, 12),
      dow: validateCronField(dow, 0, 6),
    }
    return out
  }, [min, hour, dom, mon, dow])

  const hasError = Object.values(fieldErrors).some(Boolean)
  const expr = `${min} ${hour} ${dom} ${mon} ${dow}`
  const human = hasError ? '請先修正欄位語法' : describeCron(min, hour, dom, mon, dow)
  const interval = hasError ? '—' : estimateInterval(min, hour, dom, mon, dow)
  const upcoming = useMemo(
    () => (hasError ? [] : nextRuns(min, hour, dom, mon, dow, NEXT_COUNT)),
    [min, hour, dom, mon, dow, hasError],
  )
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const bothDayRestricted = dom.trim() !== '*' && dow.trim() !== '*'
  const crontabLine = `# ${human}\n${expr}`

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function applyExpr(e: string) {
    const parsed = parseExpr(e)
    if (!parsed.ok) {
      setPasteError(parsed.error)
      return
    }
    const [a, b, c, d, f] = parsed.parts
    setMin(limitText(a, FIELD_MAX))
    setHour(limitText(b, FIELD_MAX))
    setDom(limitText(c, FIELD_MAX))
    setMon(limitText(d, FIELD_MAX))
    setDow(limitText(f, FIELD_MAX))
    setPasteError('')
    setPaste(e.trim())
  }

  function applyPaste() {
    if (!isNonEmpty(paste)) {
      setPasteError('請貼上 cron 表達式')
      return
    }
    applyExpr(paste)
  }

  const gapHint =
    upcoming.length >= 2
      ? Math.round((upcoming[1]!.getTime() - upcoming[0]!.getTime()) / 60_000)
      : null

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row cg-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={hasError}
            onClick={() => void copyVal(expr, 'expr')}
            icon="copy"
          >
            {copied === 'expr' ? '已複製' : '複製表達式'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={hasError}
            onClick={() => void copyVal(crontabLine, 'line')}
            icon="copy"
          >
            {copied === 'line' ? '已複製' : '複製 crontab 行'}
          </ActionButton>
        </div>
      }
    >
      <div className="cg-calc">
        <div className="pw-stats">
          <span className={`metric mono${hasError ? ' warn' : ''}`}>{expr}</span>
          <span className="tag">{interval}</span>
          <span className="tag">{tz}</span>
          {upcoming[0] && (
            <span className="tag">下次 {upcoming[0].toLocaleString('zh-TW', { hour12: false })}</span>
          )}
          {bothDayRestricted && <span className="tag">日∪週</span>}
        </div>

        <div className="cg-main">
          <section className="panel cg-builder">
            <h3 className="pw-panel-title">組裝</h3>

            <div className="pw-block">
              <div className="label">預設</div>
              <div className="pw-chips">
                {PRESETS.map((p) => (
                  <button
                    key={p.expr + p.label}
                    type="button"
                    className={`btn sm ${expr === p.expr ? 'accent' : 'ghost'}`}
                    onClick={() => applyExpr(p.expr)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pw-block">
              <div className="label">貼上表達式</div>
              <div className="row cg-paste-row">
                <input
                  className={`field mono${pasteError ? ' is-invalid' : ''}`}
                  style={{ flex: 1 }}
                  value={paste}
                  maxLength={EXPR_MAX}
                  spellCheck={false}
                  placeholder="*/5 * * * *"
                  onChange={(e) => {
                    setPaste(limitText(e.target.value, EXPR_MAX))
                    setPasteError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPaste()
                  }}
                />
                <ActionButton className="btn sm accent" onClick={applyPaste}>
                  套用
                </ActionButton>
              </div>
              {pasteError && <p className="field-error">{pasteError}</p>}
              <div className="field-meta">
                <span>
                  {charCount(paste)} / {EXPR_MAX}
                </span>
              </div>
            </div>

            <div className="cg-fields">
              {(Object.keys(FIELD_META) as FieldKey[]).map((key) => {
                const metaF = FIELD_META[key]
                const err = fieldErrors[key]
                return (
                  <label key={key} className="cg-field">
                    <span className="label">
                      {metaF.label}（{metaF.hint}）
                    </span>
                    <input
                      className={`field mono${err ? ' is-invalid' : ''}`}
                      value={values[key]}
                      maxLength={FIELD_MAX}
                      spellCheck={false}
                      onChange={(e) => setters[key](limitText(e.target.value, FIELD_MAX))}
                    />
                    <div className="pw-chips cg-field-chips">
                      {metaF.chips.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`btn sm ${values[key] === c ? 'accent' : 'ghost'}`}
                          onClick={() => setters[key](c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="field-meta">
                      <span>
                        {charCount(values[key])} / {FIELD_MAX}
                      </span>
                    </div>
                    {err && <p className="field-error">{err}</p>}
                  </label>
                )
              })}
            </div>
          </section>

          <section className="panel cg-preview">
            <h3 className="pw-panel-title">預覽</h3>

            <div className="cg-expr-block">
              <div className="muted">Cron 表達式（分 時 日 月 週）</div>
              <div className="row cg-expr-row">
                <code className="mono cg-expr">{expr}</code>
                <ActionButton
                  className="btn sm accent"
                  disabled={hasError}
                  onClick={() => void copyVal(expr, 'expr')}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'expr' ? '已複製' : '複製'}
                />
              </div>
            </div>

            <div className="cg-human">
              <div className="muted">說明</div>
              <p className="cg-human-text">{human}</p>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={hasError}
                  onClick={() => void copyVal(human, 'human')}
                  icon="copy"
                >
                  {copied === 'human' ? '已複製' : '複製說明'}
                </ActionButton>
                <ActionButton
                  className="btn sm ghost"
                  disabled={hasError}
                  onClick={() => void copyVal(crontabLine, 'line')}
                  icon="copy"
                >
                  {copied === 'line' ? '已複製' : 'crontab 行'}
                </ActionButton>
              </div>
            </div>

            <div className="label">接下來約 {NEXT_COUNT} 次（本機時區）</div>
            <ul className="cg-runs">
              {upcoming.map((d, i) => (
                <li key={d.getTime()}>
                  <span className="tag">#{i + 1}</span>
                  <code className="mono">{d.toLocaleString('zh-TW', { hour12: false })}</code>
                  <span className="muted">週{DOW_NAMES[d.getDay()]}</span>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyVal(d.toISOString(), `run-${i}`)}
                    icon="copy"
                    iconOnly
                    tooltip="複製 ISO"
                  />
                </li>
              ))}
              {!upcoming.length && (
                <li className="muted" style={{ listStyle: 'none' }}>
                  {hasError
                    ? '欄位語法有誤，修正後即可預覽'
                    : '無法在一年內找到符合時間，請檢查表達式'}
                </li>
              )}
            </ul>
            {gapHint != null && (
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                前兩次間隔約 {gapHint} 分鐘
              </p>
            )}
          </section>
        </div>

        <section className="panel cg-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">表達式</span>
              <strong className="mono">{expr}</strong>
            </li>
            <li>
              <span className="muted">預估頻率</span>
              <strong>{interval}</strong>
            </li>
            <li>
              <span className="muted">時區</span>
              <strong>{tz}</strong>
            </li>
            <li>
              <span className="muted">日／週同時限定</span>
              <strong>{bothDayRestricted ? '是（OR：符合其一即可）' : '否'}</strong>
            </li>
            <li>
              <span className="muted">下次執行</span>
              <strong className="mono">
                {upcoming[0] ? upcoming[0].toLocaleString('zh-TW', { hour12: false }) : '—'}
              </strong>
            </li>
            <li>
              <span className="muted">欄位摘要</span>
              <strong>
                分 {min} · 時 {hour} · 日 {dom} · 月 {mon} · 週 {dow}
              </strong>
            </li>
          </ul>

          <div className="pw-block">
            <div className="label">語法速查</div>
            <ul className="cg-syntax">
              <li>
                <code>*</code> 任意值
              </li>
              <li>
                <code>*/n</code> 每隔 n（如 <code>*/15</code>）
              </li>
              <li>
                <code>a-b</code> 範圍（如 <code>1-5</code>）
              </li>
              <li>
                <code>a,b,c</code> 列表
              </li>
              <li>
                <code>a-b/n</code> 範圍內每隔 n
              </li>
              <li>
                週：<code>0</code>=日 … <code>6</code>=六；平日常用 <code>1-5</code>
              </li>
            </ul>
          </div>

          <p className="muted pw-hint">
            標準 5 欄 Unix cron（無秒）。日與週同時非 <code>*</code> 時，多數實作為 OR。下次時間以分鐘掃描近似；內容存於本機。
          </p>
        </section>
      </div>
    </ProjectShell>
  )
}
