import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, formatBytes, isNonEmpty, limitText, copyText, downloadText, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'

const meta = getProject('json-to-csv')!

const JSON_MAX = 200_000
const FILTER_MAX = 80
const FILE_MAX = 512_000
const PREVIEW_ROWS = 8
const HISTORY_CAP = 20

type ViewMode = 'split' | 'edit' | 'result'

type HistoryItem = {
  id: string
  at: number
  label: string
  input: string
  delimiter: string
  flattenNested: boolean
  rowCount: number
  colCount: number
}

type ColStat = {
  key: string
  filled: number
  empty: number
  fillRate: number
}

const SAMPLE = `[
  { "name": "Ada", "age": 36, "address": { "city": "Taipei", "zip": "100" } },
  { "name": "Lin", "age": 28, "address": { "city": "Kaohsiung" }, "tags": ["dev", "ui"] }
]`

const PRESETS: Record<string, { label: string; body: string }> = {
  nested: { label: '巢狀地址', body: SAMPLE },
  orders: {
    label: '訂單明細',
    body: `[
  { "id": "A-001", "item": "鍵盤", "qty": 2, "price": 1290 },
  { "id": "A-002", "item": "滑鼠", "qty": 1, "price": 690 },
  { "id": "A-003", "item": "耳機", "qty": 3, "price": 1590 }
]`,
  },
  contacts: {
    label: '聯絡人',
    body: `[
  { "name": "陳雅婷", "email": "yt@example.com", "tags": ["客戶"] },
  { "name": "林志豪", "email": "hao@example.com", "tags": ["夥伴", "開源"] }
]`,
  },
  wrapped: {
    label: 'API 包一層',
    body: `{
  "ok": true,
  "data": [
    { "id": 1, "title": "Draft", "done": false },
    { "id": 2, "title": "Ship", "done": true }
  ]
}`,
  },
}

const WRAP_KEYS = ['data', 'items', 'results', 'rows', 'list', 'records'] as const

function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj == null) {
    if (prefix) out[prefix] = ''
    return out
  }
  if (Array.isArray(obj)) {
    out[prefix || 'value'] = obj.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(';')
    return out
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (!entries.length && prefix) out[prefix] = ''
    for (const [k, v] of entries) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key, out)
      } else if (Array.isArray(v)) {
        out[key] = v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(';')
      } else {
        out[key] = v
      }
    }
    return out
  }
  out[prefix || 'value'] = obj
  return out
}

function toCsv(rows: Record<string, unknown>[], delimiter: string, sortKeys: boolean) {
  if (!rows.length) return { csv: '', keys: [] as string[] }
  let keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  if (sortKeys) keys = keys.slice().sort((a, b) => a.localeCompare(b))
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return {
    csv: [keys.join(delimiter), ...rows.map((r) => keys.map((k) => esc(r[k])).join(delimiter))].join('\n'),
    keys,
  }
}

function extractArray(data: unknown): { rows: unknown[]; source: string } {
  if (Array.isArray(data)) return { rows: data, source: '根陣列' }
  if (data && typeof data === 'object') {
    for (const key of WRAP_KEYS) {
      const v = (data as Record<string, unknown>)[key]
      if (Array.isArray(v)) return { rows: v, source: `.${key}` }
    }
  }
  throw new Error('請提供物件陣列，或含 data／items／results 等陣列欄位的物件')
}

function parseErrorHint(input: string, message: string) {
  const m = /position\s+(\d+)/i.exec(message) || /at position\s+(\d+)/i.exec(message)
  if (!m) return message
  const pos = Number(m[1])
  const before = input.slice(0, pos)
  const line = before.split('\n').length
  const col = before.length - before.lastIndexOf('\n')
  return `${message}（約第 ${line} 行、第 ${col} 欄）`
}

function convertJson(
  input: string,
  delimiter: string,
  flattenNested: boolean,
  sortKeys: boolean,
):
  | {
      ok: true
      csv: string
      keys: string[]
      rows: Record<string, unknown>[]
      source: string
      colStats: ColStat[]
      emptyCells: number
      nestedKeys: number
    }
  | { ok: false; error: string } {
  if (!isNonEmpty(input)) return { ok: false, error: '請輸入 JSON' }
  if (charCount(input) > JSON_MAX) return { ok: false, error: `超過 ${JSON_MAX} 字元上限` }
  try {
    const data = JSON.parse(input)
    const { rows: raw, source } = extractArray(data)
    if (!raw.length) return { ok: false, error: '陣列為空' }

    const rows = raw.map((item, i) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`第 ${i + 1} 筆不是物件`)
      }
      return flattenNested
        ? flatten(item)
        : Object.fromEntries(
            Object.entries(item as Record<string, unknown>).map(([k, v]) => [
              k,
              v != null && typeof v === 'object' ? JSON.stringify(v) : v,
            ]),
          )
    })

    const { csv, keys } = toCsv(rows, delimiter || ',', sortKeys)
    const colStats: ColStat[] = keys.map((key) => {
      let filled = 0
      for (const row of rows) {
        const v = row[key]
        if (v != null && String(v) !== '') filled += 1
      }
      const empty = rows.length - filled
      return { key, filled, empty, fillRate: rows.length ? filled / rows.length : 0 }
    })
    const emptyCells = colStats.reduce((n, c) => n + c.empty, 0)
    const nestedKeys = keys.filter((k) => k.includes('.')).length

    return { ok: true, csv, keys, rows, source, colStats, emptyCells, nestedKeys }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '轉換失敗'
    return { ok: false, error: msg.includes('JSON') || /position/i.test(msg) ? parseErrorHint(input, msg) : msg }
  }
}

function delimLabel(d: string) {
  if (d === '\t') return 'Tab'
  if (d === ',') return '逗號 ,'
  if (d === ';') return '分號 ;'
  if (d === '|') return '管線 |'
  return d
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:json-to-csv:input', SAMPLE)
  const [delimiter, setDelimiter] = useLocalStorage('lab:json-to-csv:delim', ',')
  const [flattenNested, setFlattenNested] = useLocalStorage('lab:json-to-csv:flatten', true)
  const [sortKeys, setSortKeys] = useLocalStorage('lab:json-to-csv:sortKeys', false)
  const [bom, setBom] = useLocalStorage('lab:json-to-csv:bom', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:json-to-csv:view', 'split')
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:json-to-csv:history', [])
  const [copied, setCopied] = useState<string | null>(null)
  const [histFilter, setHistFilter] = useState('')
  const [loadError, setLoadError] = useState('')
  const [note, setNote] = useState('')

  const result = useMemo(
    () => convertJson(input, delimiter, flattenNested, sortKeys),
    [input, delimiter, flattenNested, sortKeys],
  )

  const csv = result.ok ? result.csv : ''
  const keys = result.ok ? result.keys : []
  const rowCount = result.ok ? result.rows.length : 0
  const error = result.ok ? '' : result.error
  const inBytes = useMemo(() => new Blob([input]).size, [input])
  const outBytes = useMemo(() => (csv ? new Blob([csv]).size : 0), [csv])

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => h.label.toLowerCase().includes(q) || h.input.toLowerCase().includes(q))
  }, [history, histFilter])

  const previewRows = result.ok ? result.rows.slice(0, PREVIEW_ROWS) : []

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function saveHistory() {
    if (!result.ok) return
    const label = result.keys.slice(0, 3).join(', ') || '轉換'
    setHistory((h) =>
      [
        {
          id: uid('j2c'),
          at: Date.now(),
          label: `${result.rows.length} 列 · ${label}`,
          input,
          delimiter,
          flattenNested,
          rowCount: result.rows.length,
          colCount: result.keys.length,
        },
        ...h,
      ].slice(0, HISTORY_CAP),
    )
    setNote('已存入歷史')
  }

  function download() {
    if (!csv) return
    const body = bom ? `\uFEFF${csv}` : csv
    downloadText('data.csv', body, 'text/csv;charset=utf-8')
  }

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setLoadError('')
    try {
      const text = await file.text()
      if (text.length > JSON_MAX) {
        setLoadError(`檔案內容超過 ${JSON_MAX.toLocaleString()} 字元上限`)
        return
      }
      setInput(limitText(text, JSON_MAX))
      setNote('已匯入檔案')
    } catch {
      setLoadError('無法讀取檔案')
    }
  }

  function applyPreset(body: string) {
    if (input.trim() && !confirm('套用範本會覆蓋目前輸入，確定？')) return
    setInput(body)
    setNote('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row j2c-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!csv} onClick={() => void copyVal(csv, 'csv')} icon="copy">
            {copied === 'csv' ? '已複製' : '複製 CSV'}
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!csv} onClick={download}>
            下載 CSV
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!result.ok} onClick={saveHistory}>
            存入歷史
          </ActionButton>
        </div>
      }
    >
      <div className="j2c-calc">
        <div className="pw-stats">
          <span className={`metric ${result.ok ? '' : 'warn'}`}>
            {result.ok ? `${rowCount} × ${keys.length}` : error.slice(0, 40)}
          </span>
          {result.ok && <span className="tag">{result.source}</span>}
          <span className="tag">分隔符 {delimLabel(delimiter)}</span>
          <span className="tag">{formatBytes(inBytes)}</span>
          {csv && <span className="tag">CSV {formatBytes(outBytes)}</span>}
          <span className="tag">歷史 {history.length}</span>
        </div>

        <div className="panel j2c-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row j2c-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '輸入'],
                  ['result', '結果'],
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
            <div className="label">範本</div>
            <div className="pw-chips">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button key={key} type="button" className="btn sm ghost" onClick={() => applyPreset(p.body)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row j2c-options">
            <label className="j2c-field">
              <span className="muted">分隔符</span>
              <select className="field" value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
                <option value=",">逗號 ,</option>
                <option value=";">分號 ;</option>
                <option value={'\t'}>Tab</option>
                <option value="|">管線 |</option>
              </select>
            </label>
            <label className="j2c-check">
              <input type="checkbox" checked={flattenNested} onChange={(e) => setFlattenNested(e.target.checked)} />
              <span>展平巢狀</span>
            </label>
            <label className="j2c-check">
              <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
              <span>欄位排序</span>
            </label>
            <label className="j2c-check">
              <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} />
              <span>下載加 BOM</span>
            </label>
          </div>

          <FileDrop
            accept=".json,application/json,text/plain,.txt"
            maxBytes={FILE_MAX}
            label="匯入 JSON 檔"
            hint="拖放或點擊選擇 .json / .txt"
            onFiles={(files) => void onFiles(files)}
          />
          {loadError && <p className="field-error">{loadError}</p>}
        </div>

        <div className={`j2c-main j2c-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel j2c-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">輸入</h3>
                <span className="tag mono">
                  {charCount(input).toLocaleString()} / {JSON_MAX.toLocaleString()}
                </span>
              </div>

              <div className="j2c-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!csv}
                    onClick={() => void copyVal(csv, 'csv')}
                    icon="copy"
                  >
                    {copied === 'csv' ? '已複製' : '複製 CSV'}
                  </ActionButton>
                  <ActionButton className="btn sm ghost" disabled={!csv} onClick={download}>
                    下載
                  </ActionButton>
                  <ActionButton className="btn sm accent" disabled={!result.ok} onClick={saveHistory}>
                    存入歷史
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setInput('')
                      setNote('')
                    }}
                  >
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className={`field mono j2c-textarea${!result.ok && isNonEmpty(input) ? ' is-invalid' : ''}`}
                value={input}
                maxLength={JSON_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setInput(limitText(e.target.value, JSON_MAX))
                  setNote('')
                }}
                placeholder='[{ "name": "Ada" }]'
                aria-label="JSON 輸入區"
              />
              {error && <p className="field-error">{error}</p>}
              {note && !error && <p className="field-hint">{note}</p>}
              {result.ok && (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  即時轉換自 {result.source} · {rowCount} 列 · {keys.length} 欄
                </p>
              )}
            </section>
          )}

          {(view === 'split' || view === 'result') && (
            <section className="panel j2c-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">結果</h3>
                <div className="row" style={{ gap: 6 }}>
                  {csv && <span className="tag mono">{formatBytes(outBytes)}</span>}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!csv}
                    onClick={() => void copyVal(csv, 'csv')}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'csv' ? '已複製' : '複製'}
                  />
                  <ActionButton className="btn sm ghost" disabled={!csv} onClick={download}>
                    下載
                  </ActionButton>
                </div>
              </div>

              {result.ok ? (
                <>
                  <div className="label">欄位</div>
                  <div className="j2c-keys">
                    {keys.map((k) => (
                      <span key={k} className="tag mono">
                        {k}
                      </span>
                    ))}
                  </div>

                  <div className="label">表格預覽（前 {Math.min(PREVIEW_ROWS, rowCount)} 列）</div>
                  <div className="j2c-table-wrap">
                    <table className="j2c-table">
                      <thead>
                        <tr>
                          {keys.map((k) => (
                            <th key={k}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {keys.map((k) => (
                              <td key={k} className="mono">
                                {row[k] == null ? '' : String(row[k])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="label">CSV 原文</div>
                  <pre className="j2c-output mono">{csv}</pre>
                </>
              ) : (
                <p className="muted j2c-empty">輸入有效的物件陣列後會即時顯示 CSV</p>
              )}
            </section>
          )}
        </div>

        <div className="j2c-bottom">
          <section className="panel j2c-history">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">轉換歷史</h3>
              <span className="tag">
                {history.length}/{HISTORY_CAP}
              </span>
            </div>
            <input
              className="field"
              placeholder="篩選歷史…"
              value={histFilter}
              maxLength={FILTER_MAX}
              onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
            />
            <ul className="j2c-history-list">
              {filteredHistory.map((h) => (
                <li key={h.id} className="j2c-history-item">
                  <div className="j2c-history-meta">
                    <strong>{h.label}</strong>
                    <span className="muted mono">
                      {new Date(h.at).toLocaleString('zh-TW')} · {h.rowCount}×{h.colCount}
                      {h.flattenNested ? ' · 展平' : ''} · {delimLabel(h.delimiter)}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => {
                        setInput(h.input)
                        setDelimiter(h.delimiter)
                        setFlattenNested(h.flattenNested)
                        setNote('已還原歷史輸入')
                      }}
                    >
                      還原
                    </button>
                    <DeleteButton onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))} label="刪除" />
                  </div>
                </li>
              ))}
              {!filteredHistory.length && (
                <li className="muted" style={{ listStyle: 'none' }}>
                  {history.length ? '無符合篩選的歷史' : '轉換後可按「存入歷史」'}
                </li>
              )}
            </ul>
            {!!history.length && (
              <ActionButton
                className="btn sm ghost"
                onClick={() => {
                  if (confirm('確定清空全部歷史？')) setHistory([])
                }}
              >
                清空歷史
              </ActionButton>
            )}
          </section>

          <section className="panel j2c-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            {result.ok ? (
              <>
                <ul className="pw-info-list">
                  <li>
                    <span className="muted">資料來源</span>
                    <strong className="mono">{result.source}</strong>
                  </li>
                  <li>
                    <span className="muted">列 × 欄</span>
                    <strong className="mono">
                      {rowCount} × {keys.length}
                    </strong>
                  </li>
                  <li>
                    <span className="muted">巢狀欄位</span>
                    <strong className="mono">{result.nestedKeys}</strong>
                  </li>
                  <li>
                    <span className="muted">空白儲存格</span>
                    <strong className="mono">{result.emptyCells}</strong>
                  </li>
                  <li>
                    <span className="muted">輸入大小</span>
                    <strong className="mono">{formatBytes(inBytes)}</strong>
                  </li>
                  <li>
                    <span className="muted">CSV 大小</span>
                    <strong className="mono">{formatBytes(outBytes)}</strong>
                  </li>
                  <li>
                    <span className="muted">分隔符</span>
                    <strong>{delimLabel(delimiter)}</strong>
                  </li>
                  <li>
                    <span className="muted">BOM</span>
                    <strong>{bom ? '開啟（Excel）' : '關閉'}</strong>
                  </li>
                </ul>
                <div className="label">欄位填滿率</div>
                <ul className="j2c-col-stats">
                  {result.colStats.map((c) => (
                    <li key={c.key}>
                      <code className="mono">{c.key}</code>
                      <span className="j2c-bar" aria-hidden>
                        <span style={{ width: `${Math.round(c.fillRate * 100)}%` }} />
                      </span>
                      <span className="mono muted">
                        {Math.round(c.fillRate * 100)}% · {c.filled}/{rowCount}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入有效 JSON 後會顯示結構與欄位統計
              </p>
            )}
            <p className="muted pw-hint">
              支援根陣列，或常見包一層（data／items／results…）。展平會把巢狀物件變成
              <code>a.b</code>；陣列值以分號串接。內容與歷史存於本機。
            </p>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
