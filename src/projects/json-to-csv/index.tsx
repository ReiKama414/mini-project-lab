import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('json-to-csv')!

const SAMPLE = `[
  { "name": "Ada", "age": 36, "address": { "city": "Taipei", "zip": "100" } },
  { "name": "Lin", "age": 28, "address": { "city": "Kaohsiung" }, "tags": ["dev", "ui"] }
]`

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
  if (!rows.length) return ''
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (s.includes('"') || s.includes('\n') || s.includes(delimiter)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return [keys.join(delimiter), ...rows.map((r) => keys.map((k) => esc(r[k])).join(delimiter))].join('\n')
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:json-to-csv:input', SAMPLE)
  const [delimiter, setDelimiter] = useLocalStorage('lab:json-to-csv:delim', ',')
  const [flattenNested, setFlattenNested] = useLocalStorage('lab:json-to-csv:flatten', true)
  const [csv, setCsv] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function convert() {
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
      setCsv(toCsv(rows, delimiter || ','))
      setError('')
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '轉換失敗')
      setCsv('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn sm ghost" onClick={() => setInput(SAMPLE)}>
            載入範例
          </button>
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
            <input
              type="checkbox"
              checked={flattenNested}
              onChange={(e) => setFlattenNested(e.target.checked)}
            />
            展平巢狀欄位（address.city）
          </label>
        </div>
        <label className="stack">
          <span className="label">JSON 物件陣列</span>
          <textarea className="field mono" rows={10} value={input} onChange={(e) => setInput(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn accent" onClick={convert}>
            轉成 CSV
          </button>
          <button
            className="btn ghost"
            disabled={!csv}
            onClick={async () => {
              await copyText(csv)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button
            className="btn ghost"
            disabled={!csv}
            onClick={() => downloadText('data.csv', csv, 'text/csv;charset=utf-8')}
          >
            下載 CSV
          </button>
        </div>
        {error && (
          <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
            {error}
          </p>
        )}
        {csv && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {csv}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
