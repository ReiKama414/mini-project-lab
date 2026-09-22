import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import {
  format,
  formatDistanceToNow,
  getDayOfYear,
  getISOWeek,
  getQuarter,
  isLeapYear,
  startOfDay,
  endOfDay,
  addHours,
  addDays,
  addWeeks,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, parseNumber, copyText, downloadText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const meta = getProject('timestamp')!

const TS_MAX = 32
const BATCH_MAX = 10_000

type Unit = 'sec' | 'ms'
type ViewMode = 'split' | 'convert' | 'batch'

function toMs(n: number) {
  // < 1e11 ≈ 1973 秒級上限前都當秒；一般用 1e12 區分
  return Math.abs(n) < 1e12 ? n * 1000 : n
}

function fmtLocal(ms: number, withTz = true) {
  return new Date(ms).toLocaleString('zh-TW', {
    hour12: false,
    timeZoneName: withTz ? 'short' : undefined,
  })
}

function defaultFromDate(ms = Date.now()) {
  const d = new Date(ms)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function parseTsInput(raw: string): { ok: true; ms: number; n: number } | { ok: false; error: string } {
  if (!isNonEmpty(raw)) return { ok: false, error: '請輸入時間戳' }
  const n = parseNumber(raw.trim())
  if (!Number.isFinite(n)) return { ok: false, error: '無效時間戳' }
  const ms = toMs(n)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return { ok: false, error: '無法解析' }
  return { ok: true, ms, n }
}

function buildFormats(ms: number) {
  const d = new Date(ms)
  const sec = Math.floor(ms / 1000)
  return [
    { key: 'local', label: '本地時間', value: fmtLocal(ms, true) },
    { key: 'iso', label: 'ISO 8601', value: d.toISOString() },
    { key: 'utc', label: 'UTC 字串', value: d.toUTCString() },
    { key: 'sql', label: '本地 SQL', value: format(d, 'yyyy-MM-dd HH:mm:ss') },
    { key: 'date', label: '日期', value: format(d, 'yyyy-MM-dd') },
    { key: 'time', label: '時間', value: format(d, 'HH:mm:ss.SSS') },
    { key: 'sec', label: 'Unix 秒', value: String(sec) },
    { key: 'ms', label: 'Unix 毫秒', value: String(ms) },
    {
      key: 'relative',
      label: '相對',
      value: formatDistanceToNow(d, { addSuffix: true, locale: zhTW }),
    },
  ] as const
}

function analyzeDate(ms: number) {
  const d = new Date(ms)
  const now = Date.now()
  const diff = ms - now
  return {
    weekday: format(d, 'EEEE', { locale: zhTW }),
    week: getISOWeek(d),
    dayOfYear: getDayOfYear(d),
    quarter: getQuarter(d),
    leap: isLeapYear(d),
    past: diff < 0,
    absSec: Math.floor(Math.abs(diff) / 1000),
    absDay: Math.floor(Math.abs(diff) / 86_400_000),
  }
}

export default function Page() {
  const [now, setNow] = useState(() => Date.now())
  const [unit, setUnit] = useLocalStorage<Unit>('lab:timestamp:unit', 'sec')
  const [ts, setTs] = useLocalStorage('lab:timestamp:ts', String(Math.floor(Date.now() / 1000)))
  const [fromDate, setFromDate] = useLocalStorage('lab:timestamp:fromDate', defaultFromDate())
  const [batchIn, setBatchIn] = useLocalStorage(
    'lab:timestamp:batch',
    `${Math.floor(Date.now() / 1000)}\n${Date.now()}`,
  )
  const [view, setView] = useLocalStorage<ViewMode>('lab:timestamp:view', 'split')
  const [copied, setCopied] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const offsetMin = -new Date().getTimezoneOffset()
  const offsetStr = `UTC${offsetMin >= 0 ? '+' : ''}${Math.floor(offsetMin / 60)}:${String(Math.abs(offsetMin % 60)).padStart(2, '0')}`

  const liveSec = Math.floor(now / 1000)
  const displayNow = unit === 'sec' ? liveSec : now

  const parsed = useMemo(() => parseTsInput(ts), [ts])
  const formats = useMemo(() => (parsed.ok ? buildFormats(parsed.ms) : null), [parsed])
  const info = useMemo(() => (parsed.ok ? analyzeDate(parsed.ms) : null), [parsed])

  const batchRows = useMemo(() => {
    return batchIn
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 500)
      .map((line) => {
        const result = parseTsInput(line)
        if (!result.ok) return { line, ok: false as const, msg: result.error }
        const d = new Date(result.ms)
        return {
          line,
          ok: true as const,
          ms: result.ms,
          local: fmtLocal(result.ms, true),
          iso: d.toISOString(),
          relative: formatDistanceToNow(d, { addSuffix: true, locale: zhTW }),
          sec: Math.floor(result.ms / 1000),
        }
      })
  }, [batchIn])

  const batchOk = batchRows.filter((r) => r.ok).length

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function fillNow() {
    const n = Date.now()
    setTs(String(unit === 'sec' ? Math.floor(n / 1000) : n))
    setFromDate(defaultFromDate(n))
    setNote('已填入現在')
  }

  function applyMs(ms: number, msg?: string) {
    setTs(String(unit === 'sec' ? Math.floor(ms / 1000) : ms))
    setFromDate(defaultFromDate(ms))
    if (msg) setNote(msg)
  }

  function dateToTs() {
    const d = new Date(fromDate)
    if (Number.isNaN(d.getTime())) {
      setNote('')
      return
    }
    applyMs(d.getTime(), '已由日期寫入時間戳')
  }

  function syncDateFromTs() {
    if (!parsed.ok) return
    setFromDate(defaultFromDate(parsed.ms))
    setNote('已同步到日期選擇器')
  }

  function downloadBatch() {
    if (!batchRows.length) return
    const lines = [
      'timestamp,unix_sec,local,iso,relative',
      ...batchRows.map((r) => {
        if (!r.ok) return `${r.line},,,,"${r.msg}"`
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
        return `${r.line},${r.sec},${esc(r.local)},${esc(r.iso)},${esc(r.relative)}`
      }),
    ]
    downloadText('timestamps.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  const presets: { label: string; run: () => void }[] = [
    { label: '現在', run: fillNow },
    { label: '今天開始', run: () => applyMs(startOfDay(new Date()).getTime(), '今天 00:00') },
    { label: '今天結束', run: () => applyMs(endOfDay(new Date()).getTime(), '今天 23:59:59') },
    { label: '+1 小時', run: () => applyMs(addHours(parsed.ok ? parsed.ms : now, 1).getTime(), '+1 小時') },
    { label: '+1 天', run: () => applyMs(addDays(parsed.ok ? parsed.ms : now, 1).getTime(), '+1 天') },
    { label: '+1 週', run: () => applyMs(addWeeks(parsed.ok ? parsed.ms : now, 1).getTime(), '+1 週') },
    { label: 'Unix 紀元', run: () => applyMs(0, '1970-01-01') },
    { label: 'Y2K38', run: () => applyMs(2_147_483_647 * 1000, '32-bit 秒上限') },
  ]

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row ts-shell-actions">
          <ActionButton className="btn sm teal" onClick={fillNow}>
            填入現在
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            onClick={() => void copyVal(String(displayNow), 'now')}
            icon="copy"
          >
            {copied === 'now' ? '已複製' : '複製現在'}
          </ActionButton>
        </div>
      }
    >
      <div className="ts-calc">
        <div className="pw-stats">
          <span className="metric mono">{displayNow}</span>
          <span className="tag">{unit === 'sec' ? '秒' : '毫秒'}</span>
          <span className="tag">{tz}</span>
          <span className="tag">{offsetStr}</span>
          {parsed.ok && info && <span className="tag">{info.weekday}</span>}
          {parsed.ok && <span className="tag">{info?.past ? '過去' : '未來'}</span>}
        </div>

        <div className="panel ts-clock">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">即時時鐘</h3>
            <div className="row ts-unit-toggle">
              <button
                type="button"
                className={`btn sm ${unit === 'sec' ? 'accent' : 'ghost'}`}
                onClick={() => setUnit('sec')}
              >
                秒
              </button>
              <button
                type="button"
                className={`btn sm ${unit === 'ms' ? 'accent' : 'ghost'}`}
                onClick={() => setUnit('ms')}
              >
                毫秒
              </button>
            </div>
          </div>
          <div className="ts-clock-time">{fmtLocal(now, true)}</div>
          <div className="row ts-clock-meta">
            <code className="mono">{displayNow}</code>
            <ActionButton
              className="btn sm ghost"
              onClick={() => void copyVal(String(displayNow), 'now')}
              icon="copy"
              iconOnly
              tooltip={copied === 'now' ? '已複製' : '複製'}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              ISO {new Date(now).toISOString()}
            </span>
          </div>
        </div>

        <div className="panel ts-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row ts-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['convert', '轉換'],
                  ['batch', '批次'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">快捷</div>
            <div className="pw-chips">
              {presets.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={p.run}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`ts-main ts-view-${view}`}>
          {(view === 'split' || view === 'convert') && (
            <section className="panel ts-convert">
              <h3 className="pw-panel-title">轉換</h3>

              <label className="stack">
                <span className="label">時間戳 → 日期（&lt; 1e12 視為秒）</span>
                <div className="row">
                  <input
                    className={`field mono${!parsed.ok && isNonEmpty(ts) ? ' is-invalid' : ''}`}
                    style={{ flex: 1 }}
                    value={ts}
                    maxLength={TS_MAX}
                    spellCheck={false}
                    onChange={(e) => {
                      setTs(limitText(e.target.value, TS_MAX))
                      setNote('')
                    }}
                    aria-label="時間戳"
                  />
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!parsed.ok}
                    onClick={syncDateFromTs}
                  >
                    同步日期
                  </ActionButton>
                </div>
                <div className="field-meta">
                  <span>
                    {charCount(ts)} / {TS_MAX}
                  </span>
                  {!parsed.ok && isNonEmpty(ts) && <span className="warn">{parsed.error}</span>}
                </div>
              </label>

              <label className="stack">
                <span className="label">日期 → 時間戳（寫入為{unit === 'sec' ? '秒' : '毫秒'}）</span>
                <div className="row">
                  <input
                    className="field"
                    type="datetime-local"
                    style={{ flex: 1 }}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                  <ActionButton className="btn sm teal" onClick={dateToTs}>
                    寫入戳記
                  </ActionButton>
                </div>
              </label>

              {note && <p className="field-hint">{note}</p>}

              {formats ? (
                <div className="ts-formats">
                  <div className="label">格式輸出</div>
                  {formats.map((f) => (
                    <div key={f.key} className="ts-format-row">
                      <span className="muted">{f.label}</span>
                      <code className="mono">{f.value}</code>
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(f.value, f.key)}
                        icon="copy"
                        iconOnly
                        tooltip={copied === f.key ? '已複製' : '複製'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  輸入有效時間戳後顯示多種格式
                </p>
              )}
            </section>
          )}

          {(view === 'split' || view === 'batch') && (
            <section className="panel ts-batch">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">批次轉換</h3>
                <div className="row" style={{ gap: 6 }}>
                  <span className="tag">
                    {batchOk}/{batchRows.length}
                  </span>
                  <ActionButton className="btn sm ghost" disabled={!batchRows.length} onClick={downloadBatch}>
                    下載 CSV
                  </ActionButton>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                每行一個時間戳；&lt; 1e12 視為秒，否則毫秒（最多顯示 500 行）
              </p>
              <textarea
                className="field mono ts-batch-input"
                value={batchIn}
                maxLength={BATCH_MAX}
                spellCheck={false}
                onChange={(e) => setBatchIn(limitText(e.target.value, BATCH_MAX))}
                placeholder={'1700000000\n1700000000000'}
                aria-label="批次時間戳"
              />
              <div className="field-meta">
                <span>
                  {charCount(batchIn).toLocaleString()} / {BATCH_MAX.toLocaleString()}
                </span>
              </div>
              <ul className="ts-batch-list">
                {batchRows.map((r, i) => (
                  <li key={`${r.line}-${i}`} className={`ts-batch-item${r.ok ? '' : ' is-bad'}`}>
                    <code className="mono">{r.line}</code>
                    {r.ok ? (
                      <>
                        <strong>{r.local}</strong>
                        <span className="muted">
                          {r.relative} · {r.iso}
                        </span>
                        <div className="row" style={{ gap: 6 }}>
                          <ActionButton
                            className="btn sm ghost"
                            onClick={() => void copyVal(r.local, `b-local-${i}`)}
                            icon="copy"
                          >
                            本地
                          </ActionButton>
                          <ActionButton
                            className="btn sm ghost"
                            onClick={() => void copyVal(r.iso, `b-iso-${i}`)}
                            icon="copy"
                          >
                            ISO
                          </ActionButton>
                          <ActionButton
                            className="btn sm ghost"
                            onClick={() => {
                              setTs(r.line)
                              setFromDate(defaultFromDate(r.ms))
                              setNote('已從批次載入')
                              setView('split')
                            }}
                          >
                            載入
                          </ActionButton>
                        </div>
                      </>
                    ) : (
                      <span className="field-error">{r.msg}</span>
                    )}
                  </li>
                ))}
                {!batchRows.length && (
                  <li className="muted" style={{ listStyle: 'none' }}>
                    貼上時間戳後即時轉換
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        <section className="panel ts-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          {parsed.ok && info ? (
            <ul className="pw-info-list">
              <li>
                <span className="muted">時區</span>
                <strong>
                  {tz}（{offsetStr}）
                </strong>
              </li>
              <li>
                <span className="muted">星期</span>
                <strong>{info.weekday}</strong>
              </li>
              <li>
                <span className="muted">ISO 週</span>
                <strong className="mono">W{info.week}</strong>
              </li>
              <li>
                <span className="muted">一年中第幾天</span>
                <strong className="mono">{info.dayOfYear}</strong>
              </li>
              <li>
                <span className="muted">季度</span>
                <strong className="mono">Q{info.quarter}</strong>
              </li>
              <li>
                <span className="muted">閏年</span>
                <strong>{info.leap ? '是' : '否'}</strong>
              </li>
              <li>
                <span className="muted">相對現在</span>
                <strong>
                  {info.past ? '過去' : '未來'} · {info.absDay} 天（{info.absSec.toLocaleString()} 秒）
                </strong>
              </li>
              <li>
                <span className="muted">Unix 秒／毫秒</span>
                <strong className="mono">
                  {Math.floor(parsed.ms / 1000)} / {parsed.ms}
                </strong>
              </li>
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              輸入有效時間戳後顯示星期、週次、相對差距等
            </p>
          )}
          <p className="muted pw-hint">
            數值絕對值 &lt; 1e12 視為秒，否則視為毫秒。日期選擇器依本機時區。內容存於本機。
          </p>
        </section>
      </div>
    </ProjectShell>
  )
}
