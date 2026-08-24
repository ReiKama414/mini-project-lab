import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, downloadText, uid } from '../../lib/utils'

const meta = getProject('json-to-csv')!

const JSON_MAX = 200_000
const FILTER_MAX = 80

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

const SAMPLE = `[
  { "name": "Ada", "age": 36, "address": { "city": "Taipei", "zip": "100" } },
  { "name": "Lin", "age": 28, "address": { "city": "Kaohsiung" }, "tags": ["dev", "ui"] }
]`

const PRESETS = [
  {
    label: '巢狀地址',
    json: SAMPLE,
  },
  {
    label: '訂單明細',
    json: `[
  { "id": "A-001", "item": "鍵盤", "qty": 2, "price": 1290 },
  { "id": "A-002", "item": "滑鼠", "qty": 1, "price": 690 },
  { "id": "A-003", "item": "耳機", "qty": 3, "price": 1590 }
]`,
  },
  {
    label: '聯絡人',
    json: `[
  { "name": "陳雅婷", "email": "yt@example.com", "tags": ["客戶"] },
  { "name": "林志豪", "email": "hao@example.com", "tags": ["夥伴", "開源"] }
]`,
  },
]

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

function toCsv(rows: Record<string, unknown>[], delimiter: string) {
  if (!rows.length) return { csv: '', keys: [] as string[] }
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (s.includes('"') || s.includes('\n') || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return {
    csv: [keys.join(delimiter), ...rows.map((r) => keys.map((k) => esc(r[k])).join(delimiter))].join('\n'),
    keys,
  }
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:json-to-csv:input', SAMPLE)
  const [delimiter, setDelimiter] = useLocalStorage('lab:json-to-csv:delim', ',')
  const [flattenNested, setFlattenNested] = useLocalStorage('lab:json-to-csv:flatten', true)
  const [bom, setBom] = useLocalStorage('lab:json-to-csv:bom', true)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:json-to-csv:history', [])
  const [csv, setCsv] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [histFilter, setHistFilter] = useState('')

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => h.label.toLowerCase().includes(q) || h.input.toLowerCase().includes(q))
  }, [history, histFilter])

  function convert() {
    if (!isNonEmpty(input)) {
      setError('請輸入 JSON')
      return null
    }
    if (charCount(input) > JSON_MAX) {
      setError(`超過 ${JSON_MAX} 字元上限`)
      return null
    }
    try {
      const data = JSON.parse(input)
      if (!Array.isArray(data)) throw new Error('請提供 JSON 陣列，例如 [{"a":1}]')
      if (!data.length) throw new Error('陣列為空')
      const rows = data.map((item, i) => {
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
      const { csv: out, keys: ks } = toCsv(rows, delimiter || ',')
      setCsv(out)
      setKeys(ks)
      setRowCount(rows.length)
      setError('')
      setCopied(false)
      return { out, ks, rows: rows.length }
    } catch (e) {
      setError(e instanceof Error ? e.message : '轉換失敗')
      setCsv('')
      setKeys([])
      setRowCount(0)
      return null
    }
  }

  function saveHistory(result: { out: string; ks: string[]; rows: number }) {
    const label = result.ks.slice(0, 3).join(', ') || '轉換'
    setHistory((h) =>
      [
        {
          id: uid('j2c'),
          at: Date.now(),
          label: `${result.rows} 列 · ${label}`,
          input,
          delimiter,
          flattenNested,
          rowCount: result.rows,
          colCount: result.ks.length,
        },
        ...h,
      ].slice(0, 20),
    )
  }

  function runAndMaybeSave(alsoSave: boolean) {
    const result = convert()
    if (result && alsoSave) saveHistory(result)
  }

  function download() {
    if (!csv) return
    const body = bom ? `\uFEFF${csv}` : csv
    downloadText('data.csv', body, 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm accent" onClick={() => runAndMaybeSave(true)} disabled={!isNonEmpty(input)}>
            轉換並存歷史
          </button>
          <button type="button" className="btn sm ghost" disabled={!csv} onClick={download}>
            下載 CSV
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">列數 {rowCount || '—'}</span>
        <span className="tag">欄位 {keys.length || '—'}</span>
        <span className="tag">分隔符 {delimiter === '\t' ? 'Tab' : delimiter}</span>
        <span className="tag">歷史 {history.length}</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div>
            <div className="label">範例預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => setInput(p.json)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}>
              分隔符
              <select className="field" style={{ width: 120 }} value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
                <option value=",">逗號 ,</option>
                <option value=";">分號 ;</option>
                <option value={'\t'}>Tab</option>
                <option value="|">管線 |</option>
              </select>
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={flattenNested} onChange={(e) => setFlattenNested(e.target.checked)} />
              展平巢狀欄位
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} />
              下載加 BOM（Excel）
            </label>
          </div>

          <label className="stack">
            <span className="label">JSON 物件陣列</span>
            <textarea
              className={`field mono${error ? ' is-invalid' : ''}`}
              rows={12}
              value={input}
              maxLength={JSON_MAX}
              onChange={(e) => setInput(limitText(e.target.value, JSON_MAX))}
            />
            <div className="field-meta">
              <span>{charCount(input).toLocaleString()} / {JSON_MAX.toLocaleString()}</span>
            </div>
          </label>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={() => runAndMaybeSave(false)} disabled={!isNonEmpty(input)}>
              轉成 CSV
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!csv}
              onClick={async () => {
                await copyText(csv)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
            <button type="button" className="btn ghost" disabled={!csv} onClick={download}>
              下載 CSV
            </button>
            <button type="button" className="btn ghost" disabled={!csv} onClick={() => runAndMaybeSave(true)}>
              存入歷史
            </button>
          </div>

          {error && <p className="field-error">{error}</p>}

          {keys.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {keys.map((k) => (
                <span key={k} className="tag mono">
                  {k}
                </span>
              ))}
            </div>
          )}

          {csv && (
            <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
              {csv}
            </pre>
          )}
        </div>

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>轉換歷史</h3>
            <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          <input
            className="field"
            placeholder="篩選歷史…"
            value={histFilter}
            maxLength={FILTER_MAX}
            onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(histFilter)} / {FILTER_MAX}</span>
          </div>
          <ul className="list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="list-item stack">
                <strong>{h.label}</strong>
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(h.at).toLocaleString('zh-TW')} · {h.rowCount}×{h.colCount}
                  {h.flattenNested ? ' · 展平' : ''}
                </span>
                <div className="row">
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setInput(h.input)
                      setDelimiter(h.delimiter)
                      setFlattenNested(h.flattenNested)
                    }}
                  >
                    還原輸入
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
            {!filteredHistory.length && <p className="muted">尚無歷史。轉換後可按「存入歷史」。</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
