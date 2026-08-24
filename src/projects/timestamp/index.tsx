import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, parseNumber, copyText } from '../../lib/utils'

const meta = getProject('timestamp')!

const TS_MAX = 32
const BATCH_MAX = 10_000

function toMs(n: number) {
  return n < 1e12 ? n * 1000 : n
}

function fmt(ms: number, withTz: boolean) {
  return new Date(ms).toLocaleString('zh-TW', {
    hour12: false,
    timeZoneName: withTz ? 'short' : undefined,
  })
}

export default function Page() {
  const [now, setNow] = useState(() => Date.now())
  const [unit, setUnit] = useLocalStorage<'sec' | 'ms'>('lab:timestamp:unit', 'sec')
  const [ts, setTs] = useLocalStorage('lab:timestamp:ts', String(Math.floor(Date.now() / 1000)))
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [batchIn, setBatchIn] = useLocalStorage(
    'lab:timestamp:batch',
    `${Math.floor(Date.now() / 1000)}\n${Date.now()}`,
  )
  const [converted, setConverted] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const offsetMin = -new Date().getTimezoneOffset()
  const offsetStr = `UTC${offsetMin >= 0 ? '+' : ''}${Math.floor(offsetMin / 60)}:${String(Math.abs(offsetMin % 60)).padStart(2, '0')}`

  const liveSec = Math.floor(now / 1000)
  const displayNow = unit === 'sec' ? liveSec : now

  function convertOne() {
    if (!isNonEmpty(ts)) {
      setError('請輸入時間戳')
      setConverted('')
      return
    }
    const n = parseNumber(ts)
    if (!Number.isFinite(n)) {
      setError('無效時間戳')
      setConverted('')
      return
    }
    const ms = toMs(n)
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) {
      setError('無法解析')
      setConverted('')
      return
    }
    setError('')
    setConverted(
      [
        fmt(ms, true),
        `ISO: ${d.toISOString()}`,
        `相對：${formatDistanceToNow(d, { addSuffix: true, locale: zhTW })}`,
      ].join('\n'),
    )
  }

  function dateToTs() {
    const d = new Date(fromDate)
    if (Number.isNaN(d.getTime())) {
      setError('無效日期')
      return
    }
    setError('')
    setTs(String(unit === 'sec' ? Math.floor(d.getTime() / 1000) : d.getTime()))
  }

  const batchRows = useMemo(() => {
    return batchIn
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const n = Number(line)
        if (!Number.isFinite(n)) return { line, ok: false as const, msg: '無效' }
        const ms = toMs(n)
        const d = new Date(ms)
        if (Number.isNaN(d.getTime())) return { line, ok: false as const, msg: '無效' }
        return {
          line,
          ok: true as const,
          local: fmt(ms, true),
          iso: d.toISOString(),
          relative: formatDistanceToNow(d, { addSuffix: true, locale: zhTW }),
        }
      })
  }, [batchIn])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <button className={`btn sm ${unit === 'sec' ? 'accent' : 'ghost'}`} onClick={() => setUnit('sec')}>
              秒
            </button>
            <button className={`btn sm ${unit === 'ms' ? 'accent' : 'ghost'}`} onClick={() => setUnit('ms')}>
              毫秒
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              時區：{tz}（{offsetStr}）
            </span>
          </div>
          <div className="metric">
            <div className="muted">即時時鐘</div>
            <div style={{ fontSize: 22 }}>{fmt(now, true)}</div>
            <div className="mono row" style={{ marginTop: 8 }}>
              {displayNow}
              <button className="btn sm ghost" onClick={() => void copyText(String(displayNow))}>
                複製
              </button>
            </div>
          </div>
          <label className="stack">
            <span className="label">時間戳 → 日期</span>
            <div className="row">
              <input
                className={`field mono${error ? ' is-invalid' : ''}`}
                style={{ flex: 1 }}
                value={ts}
                maxLength={TS_MAX}
                onChange={(e) => setTs(limitText(e.target.value, TS_MAX))}
              />
              <button className="btn accent" onClick={convertOne} disabled={!isNonEmpty(ts)}>
                轉換
              </button>
            </div>
            <div className="field-meta">
              <span>{charCount(ts)} / {TS_MAX}</span>
            </div>
            {converted && (
              <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
                {converted}
              </pre>
            )}
          </label>
          <label className="stack">
            <span className="label">日期 → 時間戳（{unit === 'sec' ? '秒' : '毫秒'}）</span>
            <div className="row">
              <input
                className="field"
                type="datetime-local"
                style={{ flex: 1 }}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <button className="btn teal" onClick={dateToTs}>
                轉換
              </button>
            </div>
          </label>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="panel stack">
          <h3>批次轉換</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            每行一個時間戳；&lt; 1e12 視為秒，否則視為毫秒。
          </p>
          <textarea
            className="field mono"
            rows={8}
            value={batchIn}
            maxLength={BATCH_MAX}
            onChange={(e) => setBatchIn(limitText(e.target.value, BATCH_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(batchIn).toLocaleString()} / {BATCH_MAX.toLocaleString()}</span>
          </div>
          <ul className="list">
            {batchRows.map((r, i) => (
              <li key={`${r.line}-${i}`} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <code className="mono">{r.line}</code>
                {r.ok ? (
                  <>
                    <span>{r.local}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {r.relative} · {r.iso}
                    </span>
                    <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => void copyText(r.local)}>
                      複製本地時間
                    </button>
                  </>
                ) : (
                  <span style={{ color: 'var(--rose)' }}>{r.msg}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
