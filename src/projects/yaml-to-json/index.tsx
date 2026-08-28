import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { load as yamlLoad } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('yaml-to-json') ?? {
  slug: 'yaml-to-json',
  title: 'YAML → JSON',
  description: '將 YAML 轉成 JSON。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:yaml-to-json:input',
    'name: Ada\ntags:\n  - dev\n  - ui\nactive: true\n',
  )
  const [pretty, setPretty] = useLocalStorage('lab:yaml-to-json:pretty', true)
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  function convert() {
    if (!isNonEmpty(input)) {
      setError('請輸入 YAML')
      return
    }
    try {
      const data = yamlLoad(input)
      setOut(JSON.stringify(data, null, pretty ? 2 : 0))
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
        本機以 js-yaml 解析（不上傳）。上傳上限 {formatBytes(FILE_MAX)}。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">YAML</span>
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
        <div className="stack">
          <span className="label">上傳 YAML</span>
          <FileDrop
            accept=".yaml,.yml,text/yaml,application/yaml"
            maxBytes={FILE_MAX}
            disabled={busy}
            label="拖放檔案到此，或點擊選擇"
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
        </div>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
          美化 JSON
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={convert} disabled={!isNonEmpty(input) || busy}>
            轉成 JSON
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
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('data.json', out, 'application/json')}>
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
