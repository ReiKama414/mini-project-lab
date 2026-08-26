import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import ExcelJS from 'exceljs'
import { downloadText, formatBytes } from '../../lib/utils'
import { stringifyCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('excel-to-csv') ?? {
  slug: 'excel-to-csv',
  title: 'Excel → CSV',
  description: '本機將 .xlsx 轉成 CSV（ExcelJS）。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const FILE_MAX = 15 * 1024 * 1024

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value && value.result != null) return cellToString(value.result as ExcelJS.CellValue)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join('')
    }
    if ('formula' in value) return String((value as ExcelJS.CellFormulaValue).result ?? '')
  }
  return String(value)
}

export default function Page() {
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState('')
  const [csv, setCsv] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null)

  function sheetToCsv(wb: ExcelJS.Workbook, name: string) {
    const ws = wb.getWorksheet(name)
    if (!ws) return ''
    const rows: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (cells.length < colNumber - 1) cells.push('')
        cells.push(cellToString(cell.value))
      })
      rows.push(cells)
    })
    const width = Math.max(1, ...rows.map((r) => r.length))
    return stringifyCsv(rows.map((r) => {
      const copy = r.slice()
      while (copy.length < width) copy.push('')
      return copy
    }))
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      return
    }
    if (!/\.xlsx$/i.test(file.name) && file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setError('請上傳 .xlsx（已停用有 CVE 的舊版 xlsx／xls 解析）')
      return
    }
    setBusy(true)
    setError('')
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const names = wb.worksheets.map((w) => w.name)
      setWorkbook(wb)
      setSheets(names)
      const first = names[0] || ''
      setSheet(first)
      setInfo(`${file.name} · ${formatBytes(file.size)}`)
      setCsv(first ? sheetToCsv(wb, first) : '')
    } catch {
      setError('無法讀取 Excel（請確認為有效 .xlsx）')
      setWorkbook(null)
      setCsv('')
    } finally {
      setBusy(false)
    }
  }

  function selectSheet(name: string) {
    setSheet(name)
    if (!workbook) return
    setCsv(sheetToCsv(workbook, name))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          使用 ExcelJS 本機解析（已移除有 high CVE 的 SheetJS <code>xlsx</code> 套件）。僅支援 .xlsx。
        </p>
        <FileDrop
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          maxBytes={FILE_MAX}
          disabled={busy}
          label="拖放 Excel（.xlsx）到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {busy && <p className="field-hint">讀取中…</p>}
        {info && <p className="muted">{info}</p>}
        {sheets.length > 0 && (
          <label className="stack">
            <span className="label">工作表</span>
            <select className="field" value={sheet} onChange={(e) => selectSheet(e.target.value)}>
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="field-error">{error}</p>}
        {csv && (
          <>
            <button
              type="button"
              className="btn accent"
              onClick={() => downloadText(`${sheet || 'sheet'}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')}
            >
              下載 CSV
            </button>
            <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
              {csv.slice(0, 8000)}
              {csv.length > 8000 ? '\n…' : ''}
            </pre>
          </>
        )}
        {!csv && !error && !busy && <p className="muted">選擇 .xlsx 後會在本機轉換，不會上傳伺服器。</p>}
      </div>
    </ProjectShell>
  )
}
