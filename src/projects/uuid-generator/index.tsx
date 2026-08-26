import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, downloadText, limitText, parseNumber } from '../../lib/utils'

const meta = getProject('uuid-generator')!

const COUNT_MIN = 1
const COUNT_MAX = 500
const CHECK_MAX = 64

type HistoryEntry = { id: string; at: number }

function formatUuid(id: string, hyphen: boolean, upper: boolean) {
  let s = hyphen ? id : id.replace(/-/g, '')
  return upper ? s.toUpperCase() : s.toLowerCase()
}

function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryEntry[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item) {
      out.push({ id: item, at: 0 })
      continue
    }
    if (item && typeof item === 'object' && 'id' in item) {
      const id = String((item as HistoryEntry).id)
      if (!id) continue
      const at = Number((item as HistoryEntry).at)
      out.push({ id, at: Number.isFinite(at) ? at : 0 })
    }
  }
  return out
}

function formatHistoryAt(at: number) {
  if (!at) return ''
  return new Date(at).toLocaleString('zh-TW', { hour12: false })
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-generator:count', 5)
  const [hyphen, setHyphen] = useLocalStorage('lab:uuid-generator:hyphen', true)
  const [upper, setUpper] = useLocalStorage('lab:uuid-generator:upper', false)
  const [historyRaw, setHistoryRaw] = useLocalStorage<HistoryEntry[] | string[]>(
    'lab:uuid-generator:history',
    [],
  )
  const history = useMemo(() => normalizeHistory(historyRaw), [historyRaw])
  const [list, setList] = useState<string[]>([])
  const [checkInput, setCheckInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedOne, setCopiedOne] = useState<string | null>(null)

  const display = useMemo(
    () => list.map((id) => formatUuid(id, hyphen, upper)),
    [list, hyphen, upper],
  )

  const historyDisplay = useMemo(
    () =>
      history.map((entry) => ({
        ...entry,
        display: formatUuid(entry.id, hyphen, upper),
        atLabel: formatHistoryAt(entry.at),
      })),
    [history, hyphen, upper],
  )

  const validation = useMemo(() => {
    const raw = checkInput.trim()
    if (!raw) return null
    const ok = uuidValidate(raw)
    if (!ok) return { ok: false as const, message: '不是有效的 UUID' }
    try {
      const ver = uuidVersion(raw)
      return { ok: true as const, message: `有效 · UUID v${ver}` }
    } catch {
      return { ok: true as const, message: '有效 UUID' }
    }
  }, [checkInput])

  function setHistory(next: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) {
    setHistoryRaw((prev) => {
      const current = normalizeHistory(prev)
      return typeof next === 'function' ? next(current) : next
    })
  }

  function generate(append = false) {
    const n = clamp(Number.isFinite(count) ? count : COUNT_MIN, COUNT_MIN, COUNT_MAX)
    const next = Array.from({ length: n }, () => uuidv4())
    const at = Date.now()
    setList((prev) => (append ? [...prev, ...next].slice(-COUNT_MAX) : next))
    setHistory((h) => {
      const entries = next.map((id) => ({ id, at }))
      const ids = new Set(next)
      return [...entries, ...h.filter((x) => !ids.has(x.id))].slice(0, 40)
    })
    setCopied(false)
  }

  async function copyAll() {
    if (!display.length) return
    await copyText(display.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function copyOne(id: string) {
    await copyText(id)
    setCopiedOne(id)
    setTimeout(() => setCopiedOne(null), 1200)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">數量（{COUNT_MIN}–{COUNT_MAX}）</span>
            <input
              className="field"
              type="number"
              min={COUNT_MIN}
              max={COUNT_MAX}
              value={count}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) return
                setCount(clamp(n, COUNT_MIN, COUNT_MAX))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') generate(false)
              }}
            />
            <p className="field-hint">單次最多 {COUNT_MAX} 組 · UUID v4（加密亂數）</p>
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
              保留連字號
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              大寫
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={() => generate(false)}>
              產生 v4
            </button>
            <button type="button" className="btn teal" onClick={() => generate(true)}>
              追加一批
            </button>
            <button type="button" className="btn ghost" disabled={!display.length} onClick={() => void copyAll()}>
              {copied ? '已複製' : '全部複製'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!display.length}
              onClick={() => downloadText('uuids.txt', display.join('\n'))}
            >
              下載
            </button>
            <button type="button" className="btn ghost" disabled={!list.length} onClick={() => setList([])}>
              清空結果
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            快捷鍵：在數量欄按 Enter 產生。結果會寫入左側清單與右側歷史。
          </p>
          <ul className="list">
            {display.map((id, i) => (
              <li key={`${list[i]}-${i}`} className="list-item">
                <span className="mono" style={{ flex: 1, wordBreak: 'break-all' }}>
                  {id}
                </span>
                <button type="button" className="btn sm ghost" onClick={() => void copyOne(id)}>
                  {copiedOne === id ? '已複製' : '複製'}
                </button>
              </li>
            ))}
            {!display.length && (
              <p className="muted">尚未產生。設定數量後按「產生 v4」，可一次批次建立多組 UUID。</p>
            )}
          </ul>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel stack">
            <h3 style={{ margin: 0 }}>驗證 UUID</h3>
            <label className="stack">
              <span className="label">貼上要檢查的 UUID</span>
              <input
                className={`field mono${checkInput && validation && !validation.ok ? ' is-invalid' : ''}`}
                value={checkInput}
                maxLength={CHECK_MAX}
                onChange={(e) => setCheckInput(limitText(e.target.value, CHECK_MAX))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <div className="field-meta">
                <span>{charCount(checkInput)} / {CHECK_MAX}</span>
              </div>
              {validation && !validation.ok && <p className="field-error">{validation.message}</p>}
              {validation?.ok && <p className="field-hint">{validation.message}</p>}
            </label>
            <p className="muted" style={{ fontSize: 12 }}>
              使用 <code>uuid</code> 套件產生與驗證 RFC 4122 UUID v4。
            </p>
          </div>
          <div className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>歷史（最近 {historyDisplay.length}）</h3>
              <button
                type="button"
                className="btn sm ghost"
                disabled={!history.length}
                onClick={() => setHistory([])}
              >
                清除歷史
              </button>
            </div>
            <ul className="list">
              {historyDisplay.slice(0, 12).map((entry, i) => (
                <li key={`${entry.id}-${entry.at}-${i}`} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="mono" style={{ display: 'block', wordBreak: 'break-all', fontSize: 12 }}>
                      {entry.display}
                    </span>
                    {entry.atLabel && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {entry.atLabel}
                      </span>
                    )}
                  </div>
                  <button type="button" className="btn sm ghost" onClick={() => void copyOne(entry.display)}>
                    複製
                  </button>
                </li>
              ))}
              {!historyDisplay.length && <p className="muted">產生後會自動保存於此（本機）。</p>}
            </ul>
            {historyDisplay.length > 0 && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void copyText(historyDisplay.map((e) => e.display).join('\n'))}
              >
                複製全部歷史
              </button>
            )}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
