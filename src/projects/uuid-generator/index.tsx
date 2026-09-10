import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import {
  NIL,
  MAX,
  parse as uuidParse,
  stringify as uuidStringify,
  v1 as uuidv1,
  v4 as uuidv4,
  v5 as uuidv5,
  v7 as uuidv7,
  validate as uuidValidate,
  version as uuidVersion,
} from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, downloadText, limitText, parseNumber } from '../../lib/utils'

const meta = getProject('uuid-generator')!

const COUNT_MIN = 1
const COUNT_MAX = 500
const CHECK_MAX = 80
const NAME_MAX = 200
const HISTORY_CAP = 40

type UuidVer = 'v4' | 'v7' | 'v1' | 'v5' | 'nil' | 'max'
type OutSep = 'nl' | 'comma' | 'json'
type HistoryEntry = { id: string; at: number; ver: UuidVer }

const COUNT_PRESETS = [1, 5, 10, 20, 50, 100]
const NS_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const NS_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

const VER_META: Record<UuidVer, { label: string; hint: string }> = {
  v4: { label: 'v4 亂數', hint: '最常用；122 bit 熵，適合一般 ID' },
  v7: { label: 'v7 時間序', hint: '含 Unix 時間戳，可排序、利於資料庫索引' },
  v1: { label: 'v1 時間', hint: '時間＋節點；可能暴露時序／節點資訊' },
  v5: { label: 'v5 命名', hint: '同命名空間＋名稱 → 固定結果（SHA-1）' },
  nil: { label: 'Nil', hint: '全 0 常數 UUID' },
  max: { label: 'Max', hint: '全 F 常數 UUID' },
}

function formatUuid(id: string, hyphen: boolean, upper: boolean, braces: boolean, urn: boolean) {
  const bare = id.replace(/[{}]/g, '').replace(/^urn:uuid:/i, '')
  const body = hyphen ? bare : bare.replace(/-/g, '')
  const cased = upper ? body.toUpperCase() : body.toLowerCase()
  if (urn) return `urn:uuid:${cased}`
  if (braces) return `{${cased}}`
  return cased
}

function normalizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryEntry[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item) {
      out.push({ id: item, at: 0, ver: 'v4' })
      continue
    }
    if (item && typeof item === 'object' && 'id' in item) {
      const row = item as Partial<HistoryEntry>
      const id = String(row.id ?? '')
      if (!id) continue
      const at = Number(row.at)
      const ver = (row.ver as UuidVer) || 'v4'
      out.push({ id, at: Number.isFinite(at) ? at : 0, ver })
    }
  }
  return out
}

function analyzeUuid(raw: string) {
  const cleaned = raw.trim().replace(/^urn:uuid:/i, '').replace(/[{}]/g, '')
  if (!cleaned || !uuidValidate(cleaned)) return null
  let ver = 0
  try {
    ver = uuidVersion(cleaned)
  } catch {
    ver = 0
  }
  const bytes = uuidParse(cleaned)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  const variantNibble = bytes[8]! >> 4
  const variant =
    (bytes[8]! & 0xc0) === 0x80 ? 'RFC 4122' : (bytes[8]! & 0xe0) === 0xc0 ? 'Microsoft' : '其他／保留'
  const parts = {
    timeLow: hex.slice(0, 8),
    timeMid: hex.slice(8, 12),
    timeHi: hex.slice(12, 16),
    clock: hex.slice(16, 20),
    node: hex.slice(20, 32),
  }
  let timeHint = ''
  if (ver === 7) {
    const ts = (BigInt(bytes[0]!) << 40n) | (BigInt(bytes[1]!) << 32n) | (BigInt(bytes[2]!) << 24n) | (BigInt(bytes[3]!) << 16n) | (BigInt(bytes[4]!) << 8n) | BigInt(bytes[5]!)
    timeHint = new Date(Number(ts)).toLocaleString('zh-TW', { hour12: false })
  } else if (ver === 1) {
    // UUID v1 timestamp is 100-ns intervals since 1582-10-15
    const timeLow = (BigInt(bytes[0]!) << 24n) | (BigInt(bytes[1]!) << 16n) | (BigInt(bytes[2]!) << 8n) | BigInt(bytes[3]!)
    const timeMid = (BigInt(bytes[4]!) << 8n) | BigInt(bytes[5]!)
    const timeHi = BigInt(bytes[6]! & 0x0f) << 8n | BigInt(bytes[7]!)
    const stamp = timeLow | (timeMid << 32n) | (timeHi << 48n)
    const unixMs = Number((stamp - 0x01b21dd213814000n) / 10000n)
    if (Number.isFinite(unixMs)) timeHint = new Date(unixMs).toLocaleString('zh-TW', { hour12: false })
  }
  return {
    canonical: uuidStringify(bytes),
    ver,
    variant,
    variantNibble: variantNibble.toString(16),
    parts,
    bytes: bytes.length,
    timeHint,
    entropyBits: ver === 4 ? 122 : ver === 7 ? 74 : ver === 1 ? 62 : null,
  }
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-generator:count', 5)
  const [ver, setVer] = useLocalStorage<UuidVer>('lab:uuid-generator:ver', 'v4')
  const [hyphen, setHyphen] = useLocalStorage('lab:uuid-generator:hyphen', true)
  const [upper, setUpper] = useLocalStorage('lab:uuid-generator:upper', false)
  const [braces, setBraces] = useLocalStorage('lab:uuid-generator:braces', false)
  const [urn, setUrn] = useLocalStorage('lab:uuid-generator:urn', false)
  const [sep, setSep] = useLocalStorage<OutSep>('lab:uuid-generator:sep', 'nl')
  const [ns, setNs] = useLocalStorage('lab:uuid-generator:ns', NS_DNS)
  const [name, setName] = useLocalStorage('lab:uuid-generator:name', 'example.com')
  const [historyRaw, setHistoryRaw] = useLocalStorage<HistoryEntry[] | string[]>(
    'lab:uuid-generator:history',
    [],
  )
  const history = useMemo(() => normalizeHistory(historyRaw), [historyRaw])
  const [list, setList] = useState<string[]>([])
  const [checkInput, setCheckInput] = useState('')
  const [copied, setCopied] = useState<'all' | 'hist' | null>(null)
  const [copiedOne, setCopiedOne] = useState<string | null>(null)

  const display = useMemo(
    () => list.map((id) => formatUuid(id, hyphen, upper, braces, urn)),
    [list, hyphen, upper, braces, urn],
  )

  const joined = useMemo(() => {
    if (!display.length) return ''
    if (sep === 'comma') return display.join(', ')
    if (sep === 'json') return JSON.stringify(display, null, 2)
    return display.join('\n')
  }, [display, sep])

  const historyDisplay = useMemo(
    () =>
      history.map((entry) => ({
        ...entry,
        display: formatUuid(entry.id, hyphen, upper, braces, urn),
        atLabel: entry.at ? new Date(entry.at).toLocaleString('zh-TW', { hour12: false }) : '',
      })),
    [history, hyphen, upper, braces, urn],
  )

  const checkAnalysis = useMemo(() => analyzeUuid(checkInput), [checkInput])
  const sampleAnalysis = useMemo(() => (list[0] ? analyzeUuid(list[0]) : null), [list])
  const focusAnalysis = checkAnalysis ?? sampleAnalysis

  const validation = useMemo(() => {
    const raw = checkInput.trim()
    if (!raw) return null
    if (!checkAnalysis) return { ok: false as const, message: '不是有效的 UUID' }
    return { ok: true as const, message: `有效 · UUID v${checkAnalysis.ver} · ${checkAnalysis.variant}` }
  }, [checkInput, checkAnalysis])

  const safeCount = clamp(Number.isFinite(count) ? count : COUNT_MIN, COUNT_MIN, COUNT_MAX)
  const canMulti = ver !== 'nil' && ver !== 'max'
  const verInfo = VER_META[ver]

  function setHistory(next: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) {
    setHistoryRaw((prev) => {
      const current = normalizeHistory(prev)
      return typeof next === 'function' ? next(current) : next
    })
  }

  function makeOne(): string {
    if (ver === 'nil') return NIL
    if (ver === 'max') return MAX
    if (ver === 'v1') return uuidv1()
    if (ver === 'v7') return uuidv7()
    if (ver === 'v5') {
      const namespace = uuidValidate(ns) ? ns : NS_DNS
      return uuidv5(name || 'example', namespace)
    }
    return uuidv4()
  }

  function generate(append = false) {
    const n = canMulti ? safeCount : 1
    const next = Array.from({ length: n }, () => makeOne())
    const at = Date.now()
    setList((prev) => (append ? [...prev, ...next].slice(-COUNT_MAX) : next))
    setHistory((h) => {
      const entries = next.map((id) => ({ id, at, ver }))
      const ids = new Set(next)
      return [...entries, ...h.filter((x) => !ids.has(x.id))].slice(0, HISTORY_CAP)
    })
    setCopied(null)
  }

  async function copyAll() {
    if (!joined) return
    await copyText(joined)
    setCopied('all')
    window.setTimeout(() => setCopied(null), 1500)
  }

  async function copyOne(text: string) {
    await copyText(text)
    setCopiedOne(text)
    window.setTimeout(() => setCopiedOne(null), 1200)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row uuid-shell-actions">
          <ActionButton className="btn sm accent" onClick={() => generate(false)}>
            產生
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!display.length} onClick={() => void copyAll()}>
            {copied === 'all' ? '已複製' : '複製全部'}
          </ActionButton>
        </div>
      }
    >
      <div className="uuid-calc">
        <div className="pw-stats">
          <span className="metric">{verInfo.label}</span>
          <span className="tag">結果 {display.length}</span>
          <span className="tag">歷史 {history.length}</span>
          {focusAnalysis && <span className="tag">解析 v{focusAnalysis.ver}</span>}
        </div>

        <div className="uuid-main">
          <section className="panel uuid-settings">
            <h3 className="pw-panel-title">產生設定</h3>

            <div className="pw-block">
              <div className="label">版本</div>
              <div className="pw-chips">
                {(Object.keys(VER_META) as UuidVer[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn sm ${ver === k ? 'accent' : 'ghost'}`}
                    title={VER_META[k].hint}
                    onClick={() => setVer(k)}
                  >
                    {VER_META[k].label}
                  </button>
                ))}
              </div>
              <p className="field-hint">{verInfo.hint}</p>
            </div>

            {ver === 'v5' && (
              <>
                <div className="pw-block">
                  <div className="label">命名空間</div>
                  <div className="pw-chips">
                    <button
                      type="button"
                      className={`btn sm ${ns === NS_DNS ? 'accent' : 'ghost'}`}
                      onClick={() => setNs(NS_DNS)}
                    >
                      DNS
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${ns === NS_URL ? 'accent' : 'ghost'}`}
                      onClick={() => setNs(NS_URL)}
                    >
                      URL
                    </button>
                  </div>
                  <input
                    className="field mono"
                    value={ns}
                    maxLength={CHECK_MAX}
                    onChange={(e) => setNs(limitText(e.target.value, CHECK_MAX))}
                    placeholder="命名空間 UUID"
                  />
                </div>
                <label className="stack">
                  <span className="label">名稱</span>
                  <input
                    className="field"
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(e) => setName(limitText(e.target.value, NAME_MAX))}
                    placeholder="example.com"
                  />
                </label>
              </>
            )}

            {canMulti && (
              <>
                <label className="stack">
                  <span className="label">
                    數量：{safeCount}（{COUNT_MIN}–{COUNT_MAX}）
                  </span>
                  <input
                    className="field"
                    type="range"
                    min={COUNT_MIN}
                    max={COUNT_MAX}
                    value={safeCount}
                    onChange={(e) => setCount(clamp(parseNumber(e.target.value, COUNT_MIN), COUNT_MIN, COUNT_MAX))}
                  />
                  <input
                    className="field"
                    type="number"
                    min={COUNT_MIN}
                    max={COUNT_MAX}
                    value={safeCount}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      setCount(clamp(n, COUNT_MIN, COUNT_MAX))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') generate(false)
                    }}
                  />
                </label>
                <div className="pw-chips">
                  {COUNT_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`btn sm ${safeCount === n ? 'accent' : 'ghost'}`}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="pw-block">
              <div className="label">輸出格式</div>
              <div className="pw-chips">
                <label className={`pw-check-chip${hyphen ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
                  連字號
                </label>
                <label className={`pw-check-chip${upper ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
                  大寫
                </label>
                <label className={`pw-check-chip${braces ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={braces} onChange={(e) => setBraces(e.target.checked)} />
                  大括號
                </label>
                <label className={`pw-check-chip${urn ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={urn} onChange={(e) => setUrn(e.target.checked)} />
                  URN
                </label>
              </div>
            </div>

            <div className="pw-block">
              <div className="label">批次分隔</div>
              <div className="pw-chips">
                {(
                  [
                    ['nl', '換行'],
                    ['comma', '逗號'],
                    ['json', 'JSON'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn sm ${sep === k ? 'accent' : 'ghost'}`}
                    onClick={() => setSep(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pw-actions">
              <ActionButton className="btn accent" onClick={() => generate(false)}>
                產生
              </ActionButton>
              <ActionButton className="btn teal" disabled={!canMulti} onClick={() => generate(true)}>
                追加一批
              </ActionButton>
              <ActionButton className="btn ghost" disabled={!display.length} onClick={() => void copyAll()}>
                {copied === 'all' ? '已複製' : '複製全部'}
              </ActionButton>
              <ActionButton
                className="btn ghost"
                disabled={!display.length}
                onClick={() => downloadText('uuids.txt', joined)}
              >
                下載
              </ActionButton>
              <ActionButton className="btn ghost" disabled={!list.length} onClick={() => setList([])}>
                清空結果
              </ActionButton>
            </div>

            <div className="pw-block">
              <div className="label">驗證／解析</div>
              <input
                className={`field mono${checkInput && validation && !validation.ok ? ' is-invalid' : ''}`}
                value={checkInput}
                maxLength={CHECK_MAX}
                onChange={(e) => setCheckInput(limitText(e.target.value, CHECK_MAX))}
                placeholder="貼上 UUID（可含 urn:uuid: 或大括號）"
              />
              <div className="field-meta">
                <span>
                  {charCount(checkInput)} / {CHECK_MAX}
                </span>
              </div>
              {validation && !validation.ok && <p className="field-error">{validation.message}</p>}
              {validation?.ok && <p className="field-hint">{validation.message}</p>}
            </div>
          </section>

          <aside className="uuid-side">
            <section className="panel uuid-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">產生結果</h3>
                <span className="tag">{display.length || 0} 組</span>
              </div>
              {!display.length && (
                <p className="muted" style={{ margin: 0 }}>
                  調整左側設定後按「產生」
                </p>
              )}
              <ul className="uuid-result-list">
                {display.map((text, i) => (
                  <li key={`${list[i]}-${i}`} className="uuid-result-item">
                    <span className="mono">{text}</span>
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => void copyOne(text)}
                      icon="copy"
                      iconOnly
                      tooltip={copiedOne === text ? '已複製' : '複製'}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel uuid-info">
              <h3 className="pw-panel-title">更多資訊</h3>
              {focusAnalysis ? (
                <ul className="pw-info-list">
                  <li>
                    <span className="muted">標準形</span>
                    <strong className="mono">{focusAnalysis.canonical}</strong>
                  </li>
                  <li>
                    <span className="muted">版本</span>
                    <strong>v{focusAnalysis.ver}</strong>
                  </li>
                  <li>
                    <span className="muted">Variant</span>
                    <strong>{focusAnalysis.variant}</strong>
                  </li>
                  <li>
                    <span className="muted">位元組</span>
                    <strong>{focusAnalysis.bytes}</strong>
                  </li>
                  {focusAnalysis.entropyBits != null && (
                    <li>
                      <span className="muted">約略熵</span>
                      <strong>{focusAnalysis.entropyBits} bit</strong>
                    </li>
                  )}
                  {focusAnalysis.timeHint && (
                    <li>
                      <span className="muted">時間戳解讀</span>
                      <strong>{focusAnalysis.timeHint}</strong>
                    </li>
                  )}
                  <li>
                    <span className="muted">time-low</span>
                    <strong className="mono">{focusAnalysis.parts.timeLow}</strong>
                  </li>
                  <li>
                    <span className="muted">time-mid</span>
                    <strong className="mono">{focusAnalysis.parts.timeMid}</strong>
                  </li>
                  <li>
                    <span className="muted">time-hi／ver</span>
                    <strong className="mono">{focusAnalysis.parts.timeHi}</strong>
                  </li>
                  <li>
                    <span className="muted">clock／variant</span>
                    <strong className="mono">{focusAnalysis.parts.clock}</strong>
                  </li>
                  <li>
                    <span className="muted">node</span>
                    <strong className="mono">{focusAnalysis.parts.node}</strong>
                  </li>
                </ul>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  產生結果或貼上驗證後，會顯示欄位拆解與 variant／熵資訊
                </p>
              )}
              <p className="muted pw-hint">
                本機以 <code>uuid</code> 套件產生；不上傳。v4 適合一般 ID；需要時間可排序請用 v7。
              </p>
            </section>
          </aside>
        </div>

        <section className="panel uuid-history">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">歷史</h3>
            <div className="pw-chips">
              <ActionButton
                className="btn sm ghost"
                disabled={!historyDisplay.length}
                onClick={async () => {
                  await copyText(historyDisplay.map((e) => e.display).join('\n'))
                  setCopied('hist')
                  window.setTimeout(() => setCopied(null), 1500)
                }}
              >
                {copied === 'hist' ? '已複製' : '複製歷史'}
              </ActionButton>
              <ActionButton
                className="btn sm ghost"
                disabled={!history.length}
                onClick={() => {
                  if (confirm('確定清空全部歷史？')) setHistory([])
                }}
              >
                清空
              </ActionButton>
            </div>
          </div>
          {!historyDisplay.length && (
            <p className="muted" style={{ margin: 0 }}>
              產生後會自動保存於此（本機）
            </p>
          )}
          <ul className="uuid-history-list">
            {historyDisplay.map((entry, i) => (
              <li key={`${entry.id}-${entry.at}-${i}`} className="uuid-history-card">
                <code className="mono uuid-history-text">{entry.display}</code>
                <div className="pw-history-meta">
                  <span className="tag">{VER_META[entry.ver]?.label ?? entry.ver}</span>
                  {entry.atLabel && <span className="muted">{entry.atLabel}</span>}
                </div>
                <div className="pw-history-actions">
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setList([entry.id])
                      setCheckInput(entry.id)
                    }}
                    icon="check"
                  >
                    顯示
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyOne(entry.display)}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton
                    onClick={() => setHistory((xs) => xs.filter((x) => !(x.id === entry.id && x.at === entry.at)))}
                    label="刪除"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
