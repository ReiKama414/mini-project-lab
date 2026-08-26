import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('yaml-formatter') ?? {
  slug: 'yaml-formatter',
  title: 'YAML Formatter',
  description: '以 js-yaml 解析並格式化 YAML。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:yaml-formatter:input',
    'name: Ada\ntags: [dev, ui]\nactive: true\n',
  )
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run(minify: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入內容')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = yamlLoad(input)
      const result = yamlDump(data, {
        lineWidth: minify ? -1 : 100,
        noRefs: true,
        flowLevel: minify ? 0 : -1,
      })
      setOut(minify ? result.replace(/\n+/g, ' ').trim() : result)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（YAML 可能無效）')
      setOut('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          使用 js-yaml 於瀏覽器本機解析並重新輸出。壓縮模式會改為較緊湊的 flow 風格。
        </p>
        <label className="stack">
          <span className="label">YAML</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={10}
            value={input}
            maxLength={MAX}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" disabled={!isNonEmpty(input) || busy} onClick={() => void run(false)}>
            {busy ? '處理中…' : '格式化'}
          </button>
          <button type="button" className="btn teal" disabled={!isNonEmpty(input) || busy} onClick={() => void run(true)}>
            壓縮
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
            onClick={() => downloadText('formatted.yaml', out, 'application/yaml')}
          >
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
