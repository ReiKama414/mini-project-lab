import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import ExcelJS from 'exceljs'
import { copyText, downloadText, formatBytes } from '../../lib/utils'
import { stringifyCsv } from '../../lib/csv'

const fallback: ProjectMeta = {
  slug: 'excel-to-csv',
  title: 'Excel → CSV',
  description: '本機 ExcelJS 讀取 .xlsx，工作表選取與 CSV 下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['data'],
}
const meta = getProject('excel-to-csv') ?? fallback

const FILE_MAX = 15 * 1024 * 1024
const PREVIEW_MAX = 8_000

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
  const [dims, setDims] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [bom, setBom] = useState(true)

  function sheetToCsv(wb: ExcelJS.Workbook, name: string): { csv: string; rows: number; cols: number } {
    const ws = wb.getWorksheet(name)
    if (!ws) return { csv: '', rows: 0, cols: 0 }
    const rows: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (cells.length < colNumber - 1) cells.push('')
        cells.push(cellToString(cell.value))
      })
      rows.push(cells)
    })
    const width = rows.length ? Math.max(...rows.map((r) => r.length), 1) : 0
    const normalized = rows.map((r) => {
      const copy = r.slice()
      while (copy.length < width) copy.push('')
      return copy
    })
    return {
      csv: stringifyCsv(normalized),
      rows: normalized.length,
      cols: width,
    }
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
    setCopied(null)
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const names = wb.worksheets.map((w) => w.name)
      setWorkbook(wb)
      setSheets(names)
      const first = names[0] || ''
      setSheet(first)
      setInfo(`${file.name} · ${formatBytes(file.size)}`)
      if (first) {
        const result = sheetToCsv(wb, first)
        setCsv(result.csv)
        setDims(`${result.rows} 列 × ${result.cols} 欄`)
      } else {
        setCsv('')
        setDims('')
      }
    } catch {
      setError('無法讀取 Excel（請確認為有效 .xlsx）')
      setWorkbook(null)
      setCsv('')
      setDims('')
      setSheets([])
      setSheet('')
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  function selectSheet(name: string) {
    setSheet(name)
    if (!workbook) return
    const result = sheetToCsv(workbook, name)
    setCsv(result.csv)
    setDims(`${result.rows} 列 × ${result.cols} 欄`)
    setCopied(null)
  }

  function clearAll() {
    setWorkbook(null)
    setSheets([])
    setSheet('')
    setCsv('')
    setInfo('')
    setDims('')
    setError('')
    setCopied(null)
  }

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const exportBody = bom ? `\uFEFF${csv}` : csv
  const preview = csv.length > PREVIEW_MAX ? `${csv.slice(0, PREVIEW_MAX)}\n…` : csv

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!csv} onClick={() => void copyVal(csv, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!csv}
            onClick={() => downloadText(`${sheet || 'sheet'}.csv`, exportBody, 'text/csv;charset=utf-8')}
            icon="download"
          >
            下載 CSV
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {info && <span className="tag">{info}</span>}
              {dims && <span className="tag">{dims}</span>}
              {sheets.length > 0 && <span className="tag">{sheets.length} 工作表</span>}
              {busy && <span className="tag">讀取中…</span>}
              {error && <span className="tag xc-tag-warn">讀取失敗</span>}
            </div>
          </div>
          {sheets.length > 0 && (
            <div className="pw-block">
              <div className="label">工作表</div>
              <div className="pw-chips">
                {sheets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn sm ${sheet === s ? 'accent' : 'ghost'}`}
                    onClick={() => selectSheet(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={bom} onChange={(e) => setBom(e.target.checked)} />
              下載加 UTF-8 BOM（Excel 友善）
            </label>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">Excel 輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!workbook && !error} onClick={clearAll}>
                清除
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            {!error && busy && <p className="field-hint">讀取中…</p>}
            <FileDrop
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放 Excel（.xlsx）"
              hint={`上限 ${formatBytes(FILE_MAX)} · 僅 .xlsx`}
              onFiles={(files) => void onFile(files[0] ?? null)}
            />
            <div className="field-meta">
              <span>ExcelJS · 本機解析</span>
              <span>{csv ? formatBytes(new Blob([csv]).size) : '尚未載入'}</span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">CSV 輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!csv}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(csv, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!csv}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText(`${sheet || 'sheet'}.csv`, exportBody, 'text/csv;charset=utf-8')}
                />
              </div>
            </div>
            {csv ? (
              <pre className="xc-pre mono">{preview}</pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                選擇 .xlsx 後會在本機轉成 CSV
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">引擎</span>
              <strong>ExcelJS 本機讀取（已移除有 high CVE 的 SheetJS xlsx 套件）</strong>
            </li>
            <li>
              <span className="muted">格式</span>
              <strong>僅支援 .xlsx；舊版 .xls 請先用試算表另存為 xlsx</strong>
            </li>
            <li>
              <span className="muted">儲存格</span>
              <strong>公式取結果值；富文字合併為純文字；日期輸出 ISO</strong>
            </li>
            <li>
              <span className="muted">BOM</span>
              <strong>開啟後下載會加 UTF-8 BOM，方便 Excel 正確辨識中文</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解析，不上傳；相關：CSV Editor、CSV → JSON</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
