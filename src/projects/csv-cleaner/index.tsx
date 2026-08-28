import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'

const meta: ProjectMeta = getProject('csv-cleaner') ?? {
  slug: 'csv-cleaner',
  title: 'CSV 清理',
  description: '修剪空白、去重與移除空列。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:csv-cleaner:input',
    'name, city\nAda, Taipei\nAda, Taipei\nLin,  \n,Kaohsiung\n  Bob , Tainan  ',
  )
  const [trimCells, setTrimCells] = useLocalStorage('lab:csv-cleaner:trim', true)
  const [dropEmpty, setDropEmpty] = useLocalStorage('lab:csv-cleaner:empty', true)
  const [dedupe, setDedupe] = useLocalStorage('lab:csv-cleaner:dedupe', true)
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  function clean() {
    if (!isNonEmpty(input)) {
      setError('請輸入 CSV')
      return
    }
    if (charCount(input) > MAX) {
      setError(`超過 ${MAX} 字元`)
      return
    }
    try {
      let rows = parseCsv(input)
      const before = rows.length
      if (trimCells) rows = rows.map((r) => r.map((c) => c.trim()))
      if (dropEmpty) rows = rows.filter((r) => r.some((c) => c.length > 0))
      if (dedupe) {
        const seen = new Set<string>()
        rows = rows.filter((r) => {
          const k = r.join('\0').toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      }
      setOut(stringifyCsv(rows))
      const cols = rows[0]?.length ?? 0
      setStats(`列數 ${before} → ${rows.length} · ${cols} 欄`)
      setError('')
      setCopied(false)
    } catch {
      setError('解析失敗')
      setOut('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        以 RFC4180 解析後修剪／去重。上傳上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">輸入 CSV</span>
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
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={trimCells} onChange={(e) => setTrimCells(e.target.checked)} />
            修剪儲存格空白
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={dropEmpty} onChange={(e) => setDropEmpty(e.target.checked)} />
            移除空列
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
            去除重複列
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={clean} disabled={!isNonEmpty(input) || busy}>
            清理
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
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('cleaned.csv', out, 'text/csv')}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {stats && <p className="field-hint">{stats}</p>}
        {out && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
            {out}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
