import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'

const meta: ProjectMeta = getProject('file-size-analyzer') ?? {
  slug: 'file-size-analyzer',
  title: '檔案大小分析',
  description: '本機分析多檔大小與佔比。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['utility'],
}

const MAX_FILES = 200
const FILE_MAX = 100 * 1024 * 1024

type Row = { name: string; size: number; type: string }

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const total = rows.reduce((s, r) => s + r.size, 0)

  function onFiles(list: FileList | null) {
    if (!list?.length) return
    if (list.length > MAX_FILES) {
      setError(`一次最多 ${MAX_FILES} 個檔案`)
      return
    }
    const arr = Array.from(list)
    for (const f of arr) {
      if (f.size > FILE_MAX) {
        setError(`「${f.name}」過大（單檔上限 ${formatBytes(FILE_MAX)}）`)
        return
      }
    }
    setError('')
    setRows(arr.map((f) => ({ name: f.name, size: f.size, type: f.type || 'unknown' })))
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        檔案僅在瀏覽器本機分析，不會上傳。最多 {MAX_FILES} 個、單檔上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">選擇檔案（可多選）</span>
          <input className="field" type="file" multiple onChange={(e) => onFiles(e.target.files)} />
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="metric">總計 {formatBytes(total)}</span>
          <span className="tag">{rows.length} 個檔案</span>
        </div>
        <ul className="list">
          {[...rows]
            .sort((a, b) => b.size - a.size)
            .map((r) => (
              <li key={r.name + r.size} className="list-item stack">
                <strong className="mono" style={{ wordBreak: 'break-all' }}>
                  {r.name}
                </strong>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="tag">{formatBytes(r.size)}</span>
                  <span className="tag">{total ? `${((r.size / total) * 100).toFixed(1)}%` : '—'}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {r.type}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${total ? (r.size / total) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          {!rows.length && <p className="muted">尚未選擇檔案。</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
