import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
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

type PreviewLimit = 100 | 500 | 'all'

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:csv-viewer:input',
    'name,age,city\nAda,36,Taipei\nLin,28,Kaohsiung',
  )
  const [delim, setDelim] = useLocalStorage('lab:csv-viewer:delim', ',')
  const [previewLimit, setPreviewLimit] = useLocalStorage<PreviewLimit>('lab:csv-viewer:preview', 100)
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
  const colCount = rows?.[0]?.length ?? 0
  const rowCount = rows?.length ?? 0
  const visible =
    rows == null
      ? []
      : previewLimit === 'all'
        ? rows
        : rows.slice(0, previewLimit)
  const truncated = rows != null && previewLimit !== 'all' && rowCount > previewLimit

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        支援引號欄位的 CSV 預覽（RFC4180）。上傳上限 {formatBytes(FILE_MAX)}。大型檔案建議限制預覽列數，以免瀏覽器卡住。
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
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
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
            <span className="label">預覽列數</span>
            <select
              className="field"
              style={{ width: 160 }}
              value={String(previewLimit)}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value
                setPreviewLimit(v === 'all' ? 'all' : (Number(v) as 100 | 500))
              }}
            >
              <option value="100">前 100 列</option>
              <option value="500">前 500 列</option>
              <option value="all">全部（可能卡頓）</option>
            </select>
          </label>
        </div>
        <FileDrop
          accept=".csv,text/csv,.tsv,text/tab-separated-values"
          maxBytes={FILE_MAX}
          disabled={busy}
          label="拖放 CSV 到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX)}`}
          onFiles={(files) => {
            void (async () => {
              const f = files[0]
              if (!f) return
              setBusy(true)
              setError('')
              try {
                setInput(limitText(await f.text(), MAX))
              } catch {
                setError('讀取失敗')
              } finally {
                setBusy(false)
              }
            })()
          }}
        />
        {(error || parseError) && <p className="field-error">{error || parseError}</p>}
        {rows && (
          <>
            <p className="field-hint" style={{ margin: 0 }}>
              {rowCount.toLocaleString()} 列 × {colCount.toLocaleString()} 欄
              {truncated && ` · 僅顯示前 ${previewLimit} 列`}
            </p>
            <div style={{ overflow: 'auto', maxHeight: 420 }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {visible.map((r, i) => (
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
            </div>
            {truncated && (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                為避免卡頓，目前僅預覽前 {previewLimit} 列（共 {rowCount.toLocaleString()} 列）。可改為「全部」顯示。
              </p>
            )}
          </>
        )}
      </div>
    </ProjectShell>
  )
}
