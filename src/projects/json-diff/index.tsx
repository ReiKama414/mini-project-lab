import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('json-diff') ?? {
  slug: 'json-diff',
  title: 'JSON Diff',
  description: '比較兩段 JSON 的鍵值差異。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 100_000

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (obj === null || typeof obj !== 'object') {
    out[prefix || '(root)'] = JSON.stringify(obj)
    return out
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, prefix ? `${prefix}[${i}]` : `[${i}]`, out))
    if (!obj.length) out[prefix || '(root)'] = '[]'
    return out
  }
  const entries = Object.entries(obj as Record<string, unknown>)
  if (!entries.length) out[prefix || '(root)'] = '{}'
  for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  return out
}

function zhParseError(e: unknown) {
  if (!(e instanceof Error)) return 'JSON 解析失敗'
  const m = e.message
  if (/Unexpected end/i.test(m)) return 'JSON 不完整（意外結束）'
  if (/Unexpected token/i.test(m)) return 'JSON 語法錯誤（意外字元）'
  if (/JSON/i.test(m)) return `JSON 無效：${m}`
  return m || '解析失敗'
}

export default function Page() {
  const [a, setA] = useLocalStorage('lab:json-diff:a', '{\n  "name": "Ada",\n  "age": 36\n}')
  const [b, setB] = useLocalStorage('lab:json-diff:b', '{\n  "name": "Ada",\n  "age": 37,\n  "city": "Taipei"\n}')
  const [diff, setDiff] = useState<{ path: string; left: string; right: string; kind: string }[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [compared, setCompared] = useState(false)

  function compare() {
    if (!isNonEmpty(a) || !isNonEmpty(b)) {
      setError('請填寫兩側 JSON')
      setDiff([])
      setCompared(false)
      return
    }
    try {
      const fa = flatten(JSON.parse(a))
      const fb = flatten(JSON.parse(b))
      const keys = Array.from(new Set([...Object.keys(fa), ...Object.keys(fb)])).sort()
      const rows = keys
        .map((k) => {
          const left = fa[k]
          const right = fb[k]
          if (left === right) return null
          if (left === undefined) return { path: k, left: '—', right: right!, kind: '新增' }
          if (right === undefined) return { path: k, left: left!, right: '—', kind: '刪除' }
          return { path: k, left: left!, right: right!, kind: '變更' }
        })
        .filter(Boolean) as { path: string; left: string; right: string; kind: string }[]
      setDiff(rows)
      setError('')
      setCompared(true)
      setCopied(false)
    } catch (e) {
      setError(zhParseError(e))
      setDiff([])
      setCompared(false)
    }
  }

  const report = diff.map((d) => `${d.kind} ${d.path}: ${d.left} → ${d.right}`).join('\n')

  return (
    <ProjectShell meta={meta}>
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        以路徑扁平化比較鍵值（非完整 tree / LCS diff）。陣列以索引比對，重排可能顯示為多處變更。
      </p>
      <div className="grid-2">
        <label className="stack panel">
          <span className="label">左側 JSON</span>
          <textarea
            className={`field mono${!isNonEmpty(a) ? ' is-invalid' : ''}`}
            rows={10}
            value={a}
            maxLength={MAX}
            onChange={(e) => setA(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(a).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <label className="stack panel">
          <span className="label">右側 JSON</span>
          <textarea
            className={`field mono${!isNonEmpty(b) ? ' is-invalid' : ''}`}
            rows={10}
            value={b}
            maxLength={MAX}
            onChange={(e) => setB(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(b).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
      </div>
      <div className="panel stack" style={{ marginTop: 12 }}>
        <div className="row">
          <button type="button" className="btn accent" onClick={compare}>
            比較
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!diff.length}
            onClick={async () => {
              await copyText(report)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製差異'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!diff.length}
            onClick={() => downloadText('json-diff.txt', report)}
          >
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {compared && !error && !diff.length && <p className="field-hint">兩側相同，無差異</p>}
        <ul className="list">
          {diff.map((d) => (
            <li key={d.path} className="list-item stack">
              <div className="row">
                <span className="tag">{d.kind}</span>
                <code className="mono">{d.path}</code>
              </div>
              <span className="muted mono" style={{ fontSize: 12 }}>
                {d.left} → {d.right}
              </span>
            </li>
          ))}
          {!diff.length && !error && !compared && <p className="muted">尚未比較</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
