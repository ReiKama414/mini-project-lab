import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes, limitText, charCount } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-form-filler',
  title: 'PDF 表單填寫',
  description: '讀取並填寫 PDF AcroForm 欄位。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-form-filler') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const VAL_MAX = 500
const FIELD_MAX = 80

type FieldRow = { name: string; value: string }

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [fields, setFields] = useState<FieldRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    setProgress('讀取表單…')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const form = doc.getForm()
      const all = form.getFields()
      if (all.length > FIELD_MAX) {
        setError(`欄位過多（上限 ${FIELD_MAX}）`)
        setFields([])
        setFile(null)
        return
      }
      const rows: FieldRow[] = all.map((field) => {
        const name = field.getName()
        let value = ''
        try {
          // @ts-expect-error optional getText on text fields
          value = typeof field.getText === 'function' ? String(field.getText() ?? '') : ''
        } catch {
          /* ignore */
        }
        return { name, value: limitText(value, VAL_MAX) }
      })
      setFields(rows)
      setFile(f)
      setError(rows.length ? '' : '此 PDF 沒有可填表單欄位')
    } catch {
      setError('無法讀取表單（可能已加密或非 AcroForm）')
      setFields([])
      setFile(null)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress('填寫欄位…')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const form = doc.getForm()
      for (let i = 0; i < fields.length; i++) {
        const row = fields[i]!
        setProgress(`填寫第 ${i + 1}/${fields.length} 欄`)
        try {
          const tf = form.getTextField(row.name)
          tf.setText(limitText(row.value, VAL_MAX))
        } catch {
          try {
            const dd = form.getDropdown(row.name)
            dd.select(limitText(row.value, VAL_MAX))
          } catch {
            /* skip non-text */
          }
        }
      }
      setProgress('攤平並寫入…')
      form.flatten()
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-filled.pdf`,
      )
    } catch {
      setError('填寫失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn sm accent"
          disabled={!file || !fields.length || busy}
          onClick={() => void run()}
        >
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        支援 AcroForm 文字欄位；匯出時會攤平表單。單檔上限 {formatBytes(PDF_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">上傳含表單的 PDF</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {fields.length} 個欄位 · {formatBytes(file.size)}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {fields.map((row, i) => (
          <div key={row.name} className="field-wrap">
            <label className="label">{row.name}</label>
            <input
              className="field"
              value={row.value}
              maxLength={VAL_MAX}
              disabled={busy}
              onChange={(e) =>
                setFields((prev) =>
                  prev.map((r, j) => (j === i ? { ...r, value: limitText(e.target.value, VAL_MAX) } : r)),
                )
              }
            />
            <div className="field-meta">
              <span> </span>
              <span>
                {charCount(row.value)} / {VAL_MAX}
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={!file || !fields.length || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '填寫並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
