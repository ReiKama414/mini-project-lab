import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { AddButton } from '../../components/AddButton'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('csv-editor') ?? {
  slug: 'csv-editor',
  title: 'CSV 編輯器',
  description: '支援引號欄位的 CSV 編輯與匯出。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['data'],
}

const MAX = 200_000
const CELL_MAX = 2000
const FILE_MAX = 5 * 1024 * 1024
const ROW_MAX = 500
const COL_MAX = 40

type PreviewLimit = 100 | 500 | 'all'

export default function Page() {
  const [raw, setRaw] = useLocalStorage('lab:csv-editor:raw', 'name,score\nAda,90\n"Lin, Jr.",88')
  const [rows, setRows] = useState<string[][]>(() => {
    try {
      return parseCsv(raw)
    } catch {
      return [['name', 'score']]
    }
  })
  const [previewLimit, setPreviewLimit] = useLocalStorage<PreviewLimit>('lab:csv-editor:preview', 100)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [fileName, setFileName] = useState('edited.csv')

  const csv = useMemo(() => stringifyCsv(rows), [rows])
  const visibleRows =
    previewLimit === 'all' ? rows : rows.slice(0, previewLimit)
  const truncated = previewLimit !== 'all' && rows.length > previewLimit

  useEffect(() => {
    setRaw(limitText(csv, MAX))
  }, [csv, setRaw])

  function loadFromText(text: string, name = 'edited.csv') {
    if (!isNonEmpty(text)) {
      setError('請輸入 CSV')
      return
    }
    if (charCount(text) > MAX) {
      setError(`超過 ${MAX} 字元`)
      return
    }
    try {
      const parsed = parseCsv(text)
      if (!parsed.length) {
        setError('無資料')
        return
      }
      if (parsed.length > ROW_MAX) {
        setError(`列數上限 ${ROW_MAX}`)
        return
      }
      if (parsed[0].length > COL_MAX) {
        setError(`欄數上限 ${COL_MAX}`)
        return
      }
      setRows(parsed)
      setFileName(name)
      setError('')
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失敗')
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      return
    }
    const text = await file.text()
    loadFromText(text, file.name.replace(/\.[^.]+$/, '') + '.csv')
  }

  function setCell(ri: number, ci: number, v: string) {
    setRows((prev) => prev.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? limitText(v, CELL_MAX) : c)) : r)))
  }

  function addRow() {
    setRows((r) => {
      if (r.length >= ROW_MAX) {
        setError(`列數上限 ${ROW_MAX}`)
        return r
      }
      setError('')
      return [...r, Array(r[0]?.length || 1).fill('')]
    })
  }

  function addCol() {
    setRows((r) => {
      if ((r[0]?.length || 0) >= COL_MAX) {
        setError(`欄數上限 ${COL_MAX}`)
        return r
      }
      setError('')
      return r.map((row) => [...row, ''])
    })
  }

  function deleteRow(ri: number) {
    setRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== ri)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          支援引號、逗號與換行欄位（RFC4180）。編輯表格會同步更新匯出內容。載入上限 {ROW_MAX} 列 × {COL_MAX}{' '}
          欄；預覽可限制顯示列數以免卡頓。
        </p>
        <FileDrop
          accept=".csv,text/csv,text/plain"
          maxBytes={FILE_MAX}
          label="拖放 CSV 到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        <label className="stack">
          <span className="label">原始 CSV</span>
          <textarea
            className={`field mono${error ? ' is-invalid' : ''}`}
            rows={5}
            value={raw}
            maxLength={MAX}
            onChange={(e) => setRaw(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(raw).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <label className="stack">
          <span className="label">預覽列數</span>
          <select
            className="field"
            style={{ width: 200 }}
            value={String(previewLimit)}
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
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={() => loadFromText(raw)}>
            從文字載入
          </button>
          <AddButton type="button"  className="ghost" onClick={addRow}>
            新增列</AddButton>
          <AddButton type="button"  className="ghost" onClick={addCol}>
            新增欄</AddButton>
          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              await copyText(csv)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn teal" onClick={() => downloadText(fileName, `\uFEFF${csv}`, 'text/csv')}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        <p className="field-hint">
          {rows.length} 列 × {rows[0]?.length ?? 0} 欄
          {truncated && ` · 僅顯示前 ${previewLimit} 列供編輯`}
        </p>
        <div style={{ overflow: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {visibleRows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ border: '1px solid var(--border)', padding: 4 }}>
                      <input
                        className="field"
                        style={{ margin: 0, minWidth: 80 }}
                        value={c}
                        maxLength={CELL_MAX}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                      />
                    </td>
                  ))}
                  <td style={{ padding: 4 }}>
                    <button type="button" className="btn sm ghost" onClick={() => deleteRow(ri)} disabled={rows.length <= 1}>
                      刪
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {truncated && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            為避免卡頓，目前僅顯示前 {previewLimit} 列（共 {rows.length} 列仍保留於匯出）。切換為「全部」可編輯其餘列。
          </p>
        )}
      </div>
    </ProjectShell>
  )
}
