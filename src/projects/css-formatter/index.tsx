import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import * as prettier from 'prettier/standalone'
import * as prettierPluginPostcss from 'prettier/plugins/postcss'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('css-formatter') ?? {
  slug: 'css-formatter',
  title: 'CSS Formatter',
  description: '以 Prettier 美化／壓縮 CSS。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:css-formatter:input',
    'body{margin:0;color:#111}.box{padding:8px;display:flex}',
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
      const result = await prettier.format(input, {
        parser: 'css',
        plugins: [prettierPluginPostcss],
        printWidth: minify ? 100000 : 80,
      })
      setOut(minify ? result.replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').trim() : result)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（語法可能無效）')
      setOut('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          使用 Prettier（css／postcss parser）於瀏覽器本機格式化。壓縮模式會先解析再去掉多餘空白。
        </p>
        <label className="stack">
          <span className="label">CSS</span>
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
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('formatted.css', out, 'text/css')}>
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
