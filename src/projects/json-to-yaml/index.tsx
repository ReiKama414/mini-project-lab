import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { dump as yamlDump } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('json-to-yaml') ?? {
  slug: 'json-to-yaml',
  title: 'JSON → YAML',
  description: '將 JSON 轉成 YAML。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:json-to-yaml:input',
    '{\n  "name": "Ada",\n  "tags": ["dev", "ui"],\n  "active": true\n}',
  )
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  function convert() {
    if (!isNonEmpty(input)) {
      setError('請輸入 JSON')
      return
    }
    try {
      const data = JSON.parse(input)
      setOut(yamlDump(data, { lineWidth: 100, noRefs: true }))
      setError('')
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '轉換失敗')
      setOut('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        本機以 js-yaml 轉換。上傳上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">JSON</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={10}
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
        <label className="stack">
          <span className="label">上傳 JSON</span>
          <input
            className="field"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > FILE_MAX) {
                setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
                return
              }
              setBusy(true)
              try {
                setInput(limitText(await f.text(), MAX))
                setError('')
              } catch {
                setError('讀取失敗')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={convert} disabled={!isNonEmpty(input) || busy}>
            轉成 YAML
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
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('data.yaml', out, 'application/yaml')}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {out && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {out}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
