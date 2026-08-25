import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('http-header-analyzer') ?? {
  slug: 'http-header-analyzer',
  title: 'HTTP Header 分析',
  description: '貼上回應標頭，檢查安全相關欄位。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const MAX = 20_000
const CHECKS = [
  { name: 'content-security-policy', tip: '限制腳本／資源來源' },
  { name: 'strict-transport-security', tip: '強制 HTTPS' },
  { name: 'x-content-type-options', tip: '建議 nosniff' },
  { name: 'x-frame-options', tip: '或用 CSP frame-ancestors' },
  { name: 'referrer-policy', tip: '控制 Referer 外洩' },
  { name: 'permissions-policy', tip: '限制瀏覽器功能' },
]

export default function Page() {
  const [raw, setRaw] = useLocalStorage(
    'lab:http-header-analyzer:raw',
    'HTTP/1.1 200 OK\nContent-Type: text/html\nX-Frame-Options: DENY\nX-Content-Type-Options: nosniff\n',
  )
  const [rows, setRows] = useState<{ name: string; present: boolean; value: string; tip: string }[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function analyze() {
    if (!isNonEmpty(raw)) {
      setError('請貼上標頭')
      setRows([])
      return
    }
    const map = new Map<string, string>()
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([^:\s]+):\s*(.*)$/.exec(line)
      if (m) map.set(m[1]!.toLowerCase(), m[2]!)
    }
    setRows(CHECKS.map((c) => ({ name: c.name, tip: c.tip, present: map.has(c.name), value: map.get(c.name) || '' })))
    setError('')
    setCopied(false)
  }

  const report = rows.map((r) => `${r.present ? '有' : '缺'}\t${r.name}\t${r.value}`).join('\n')
  const missing = rows.filter((r) => !r.present).length

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          靜態檢查常見安全標頭是否存在，不連線、不驗證語意正確性。僅供快速盤點。
        </p>
        <label className="stack">
          <span className="label">原始標頭</span>
          <textarea
            className={`field mono${!isNonEmpty(raw) ? ' is-invalid' : ''}`}
            rows={10}
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
        <div className="row">
          <button type="button" className="btn accent" onClick={analyze}>
            分析
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!rows.length}
            onClick={async () => {
              await copyText(report)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製結果'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!rows.length}
            onClick={() => downloadText('header-check.txt', report)}
          >
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {!!rows.length && (
          <p className="field-hint">
            缺 {missing}／{rows.length} 項常見安全標頭
          </p>
        )}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.name} className="list-item stack">
              <div className="row">
                <span className="tag">{r.present ? '有' : '缺'}</span>
                <code className="mono">{r.name}</code>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                {r.tip}
              </span>
              {r.value && (
                <span className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {r.value}
                </span>
              )}
            </li>
          ))}
          {!rows.length && !error && <p className="muted">尚未分析</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
