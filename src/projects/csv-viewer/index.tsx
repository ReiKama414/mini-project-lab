import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('csv-viewer') ?? {
  slug: 'csv-viewer',
  title: 'CSV 檢視器',
  description: '貼上或上傳 CSV，表格預覽。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024
const PREVIEW_ROWS = 200

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:csv-viewer:input',
    'name,age,city\nAda,36,Taipei\nLin,28,Kaohsiung',
  )
  const [delim, setDelim] = useLocalStorage('lab:csv-viewer:delim', ',')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const table = useMemo(() => {
    if (!isNonEmpty(input)) return null
    try {
      const rows = parseCsv(input, delim || ',')
      if (!rows.length) throw new Error('無資料列')
      return rows
    } catch (e) {
      return e instanceof Error ? e.message : '解析失敗'
    }
  }, [input, delim])

  const rows = Array.isArray(table) ? table : null
  const parseError = typeof table === 'string' ? table : ''

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        支援引號欄位的 CSV 預覽（RFC4180）。上傳上限 {formatBytes(FILE_MAX)}，表格最多顯示前 {PREVIEW_ROWS} 列。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">CSV 內容</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={8}
            value={input}
            maxLength={MAX}
            disabled={busy}
            onChange={(e) => {
              setInput(limitText(e.target.value, MAX))
              setError('')
            }}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <label className="stack">
          <span className="label">分隔符</span>
          <select
            className="field"
            style={{ width: 160 }}
            value={delim}
            disabled={busy}
            onChange={(e) => setDelim(e.target.value)}
          >
            <option value=",">逗號</option>
            <option value=";">分號</option>
            <option value={'\t'}>Tab</option>
            <option value="|">管線</option>
          </select>
        </label>
        <label className="stack">
          <span className="label">上傳 CSV</span>
          <input
            className="field"
            type="file"
            accept=".csv,text/csv,.tsv,text/tab-separated-values"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > FILE_MAX) {
                setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
                return
              }
              setBusy(true)
              setError('')
              try {
                setInput(limitText(await f.text(), MAX))
              } catch {
                setError('讀取失敗')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        {(error || parseError) && <p className="field-error">{error || parseError}</p>}
        {rows && (
          <div style={{ overflow: 'auto', maxHeight: 420 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className="mono"
                        style={{
                          border: '1px solid var(--border)',
                          padding: '6px 8px',
                          fontWeight: i === 0 ? 600 : 400,
                          background: i === 0 ? 'var(--panel-2, transparent)' : undefined,
                        }}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_ROWS && (
              <p className="muted">
                僅顯示前 {PREVIEW_ROWS} 列（共 {rows.length}）
              </p>
            )}
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
