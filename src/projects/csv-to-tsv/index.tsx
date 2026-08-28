import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('csv-to-tsv') ?? {
  slug: 'csv-to-tsv',
  title: 'CSV → TSV',
  description: '逗號分隔轉 Tab 分隔。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:csv-to-tsv:input', 'a,b,c\n1,2,3\n"hello, world",4,5')
  const [fromDelim, setFromDelim] = useLocalStorage('lab:csv-to-tsv:from', ',')
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dims, setDims] = useState('')

  function convert() {
    if (!isNonEmpty(input)) {
      setError('請輸入內容')
      return
    }
    try {
      const rows = parseCsv(input, fromDelim || ',')
      const cleaned = rows.map((r) => r.map((c) => c.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')))
      setOut(stringifyCsv(cleaned, '\t'))
      setDims(`${cleaned.length} 列 × ${cleaned[0]?.length ?? 0} 欄`)
      setError('')
      setCopied(false)
    } catch {
      setError('轉換失敗')
      setOut('')
      setDims('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        以 RFC4180 解析來源後輸出 Tab 分隔。上傳上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">CSV 輸入</span>
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
        <FileDrop
          accept=".csv,text/csv"
          maxBytes={FILE_MAX}
          disabled={busy}
          label="拖放 CSV 到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX)}`}
          onFiles={(files) => {
            void (async () => {
              const f = files[0]
              if (!f) return
              setBusy(true)
              try {
                setInput(limitText(await f.text(), MAX))
                setError('')
              } catch {
                setError('讀取失敗')
              } finally {
                setBusy(false)
              }
            })()
          }}
        />
        <label className="row" style={{ gap: 6 }}>
          來源分隔符
          <select
            className="field"
            style={{ width: 120 }}
            value={fromDelim}
            disabled={busy}
            onChange={(e) => setFromDelim(e.target.value)}
          >
            <option value=",">逗號</option>
            <option value=";">分號</option>
            <option value="|">管線</option>
          </select>
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={convert} disabled={!isNonEmpty(input) || busy}>
            轉成 TSV
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
          <button
            type="button"
            className="btn ghost"
            disabled={!out}
            onClick={() => downloadText('data.tsv', out, 'text/tab-separated-values')}
          >
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {dims && <p className="field-hint">{dims}</p>}
        {out && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
            {out}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
