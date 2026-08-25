import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('csv-to-json') ?? {
  slug: 'csv-to-json',
  title: 'CSV → JSON',
  description: '將 CSV 轉成 JSON 物件陣列。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024
const ROW_MAX = 5000

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:csv-to-json:input', 'name,age\nAda,36\nLin,28')
  const [delim, setDelim] = useLocalStorage('lab:csv-to-json:delim', ',')
  const [pretty, setPretty] = useLocalStorage('lab:csv-to-json:pretty', true)
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  function convert() {
    if (!isNonEmpty(input)) {
      setError('請輸入 CSV')
      return
    }
    try {
      const rows = parseCsv(input, delim || ',')
      if (rows.length < 2) throw new Error('至少需要標題列與一筆資料')
      if (rows.length > ROW_MAX) throw new Error(`列數上限 ${ROW_MAX}`)
      const headers = rows[0]!.map((h, i) => h || `col_${i + 1}`)
      const data = rows.slice(1).map((r) => {
        const o: Record<string, string> = {}
        headers.forEach((h, i) => {
          o[h] = r[i] ?? ''
        })
        return o
      })
      setOut(JSON.stringify(data, null, pretty ? 2 : 0))
      setError('')
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '轉換失敗')
      setOut('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        第一列為欄位名；支援引號欄位。上傳上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">CSV（第一列為欄位名）</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={8}
            value={input}
            maxLength={MAX}
            disabled={busy}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <label className="stack">
          <span className="label">上傳 CSV</span>
          <input
            className="field"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > FILE_MAX) {
                setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
                return
              }
              setBusy(true)
              try {
                setInput(limitText(await f.text(), MAX))
                setError('')
              } catch {
                setError('讀取失敗')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6 }}>
            分隔符
            <select className="field" style={{ width: 120 }} value={delim} disabled={busy} onChange={(e) => setDelim(e.target.value)}>
              <option value=",">,</option>
              <option value=";">;</option>
              <option value={'\t'}>Tab</option>
            </select>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
            美化 JSON
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={convert} disabled={!isNonEmpty(input) || busy}>
            轉成 JSON
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!out}
            onClick={async () => {
              await copyText(out)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('data.json', out, 'application/json')}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {out && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {out}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
