import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import * as prettier from 'prettier/standalone'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('graphql-formatter') ?? {
  slug: 'graphql-formatter',
  title: 'GraphQL Formatter',
  description: '以 Prettier 格式化／壓縮 GraphQL。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000

/** Fallback indent heuristic when prettier/plugins/graphql is unavailable. */
function formatHeuristic(input: string, minify: boolean) {
  if (minify) return input.replace(/\s+/g, ' ').replace(/\s*([{}():,])\s*/g, '$1').trim()
  let d = 0
  return input
    .replace(/\s*{\s*/g, ' {\n')
    .replace(/\s*}\s*/g, '\n}\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (l.startsWith('}')) d = Math.max(0, d - 1)
      const out = '  '.repeat(d) + l
      if (l.endsWith('{')) d++
      return out
    })
    .join('\n')
}

let graphqlPluginPromise: Promise<unknown> | null = null

function loadGraphqlPlugin() {
  if (!graphqlPluginPromise) {
    graphqlPluginPromise = import('prettier/plugins/graphql')
  }
  return graphqlPluginPromise
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:graphql-formatter:input',
    'query{user(id:"1"){name email posts{title}}}',
  )
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [usingHeuristic, setUsingHeuristic] = useState(false)

  async function run(minify: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入內容')
      return
    }
    setBusy(true)
    setError('')
    try {
      let plugin: unknown | null = null
      try {
        plugin = await loadGraphqlPlugin()
      } catch {
        plugin = null
      }

      if (plugin) {
        const result = await prettier.format(input, {
          parser: 'graphql',
          plugins: [plugin as never],
          printWidth: minify ? 100000 : 80,
        })
        setOut(minify ? result.replace(/\s+/g, ' ').replace(/\s*([{}():,])\s*/g, '$1').trim() : result)
        setUsingHeuristic(false)
      } else {
        // Limitation: prettier/plugins/graphql unavailable — indent only, no syntax validation.
        setOut(formatHeuristic(input, minify))
        setUsingHeuristic(true)
      }
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（語法可能無效）')
      setOut('')
      setUsingHeuristic(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          優先使用 Prettier（graphql parser）於瀏覽器本機格式化；若外掛無法載入則改用簡易縮排（可能無法驗證語法）。
        </p>
        <label className="stack">
          <span className="label">GraphQL</span>
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
            onClick={() => downloadText('formatted.graphql', out, 'application/graphql')}
          >
            下載
          </button>
        </div>
        {usingHeuristic && out && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            目前為簡易縮排模式（非完整 GraphQL 語法檢查）。
          </p>
        )}
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
