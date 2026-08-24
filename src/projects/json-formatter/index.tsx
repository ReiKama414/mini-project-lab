import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('json-formatter')!

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeysDeep(obj[k])
        return acc
      }, {})
  }
  return value
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function parseErrorHint(input: string, message: string) {
  const m = /position\s+(\d+)/i.exec(message) || /at position\s+(\d+)/i.exec(message)
  if (!m) return message
  const pos = Number(m[1])
  const before = input.slice(0, pos)
  const line = before.split('\n').length
  const col = before.length - before.lastIndexOf('\n')
  return `${message}（約第 ${line} 行、第 ${col} 欄）`
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:json-formatter:input',
    '{\n  "hello": "world",\n  "n": [1, 2, 3],\n  "nested": { "a": 1, "b": true }\n}',
  )
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [sortKeys, setSortKeys] = useState(false)
  const [path, setPath] = useState('')
  const [pathResult, setPathResult] = useState('')
  const [copied, setCopied] = useState(false)

  const status = useMemo(() => {
    if (!input.trim()) return { ok: false, msg: '空白' }
    try {
      JSON.parse(input)
      return { ok: true, msg: '有效 JSON' }
    } catch (e) {
      return { ok: false, msg: parseErrorHint(input, e instanceof Error ? e.message : '無效') }
    }
  }, [input])

  function run(pretty: boolean) {
    try {
      let obj: unknown = JSON.parse(input)
      if (sortKeys) obj = sortKeysDeep(obj)
      setOutput(JSON.stringify(obj, null, pretty ? 2 : 0))
      setError('')
      setCopied(false)
    } catch (e) {
      setError(parseErrorHint(input, e instanceof Error ? e.message : '無效 JSON'))
      setOutput('')
    }
  }

  function queryPath() {
    try {
      const obj = JSON.parse(input)
      const val = getByPath(obj, path.trim())
      if (val === undefined) {
        setPathResult('（無此路徑）')
      } else {
        setPathResult(typeof val === 'string' ? val : JSON.stringify(val, null, 2))
      }
      setError('')
    } catch (e) {
      setError(parseErrorHint(input, e instanceof Error ? e.message : '無效 JSON'))
      setPathResult('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="stack">
          <span className="label">輸入 JSON</span>
          <textarea
            className="field mono"
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className={status.ok ? 'muted' : ''} style={status.ok ? undefined : { color: 'var(--rose)' }}>
            {status.msg}
          </span>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
            排序鍵名
          </label>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn accent" onClick={() => run(true)}>
            格式化
          </button>
          <button className="btn teal" onClick={() => run(false)}>
            壓縮
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              try {
                JSON.parse(input)
                setError('')
                setOutput('✓ 驗證通過')
              } catch (e) {
                setError(parseErrorHint(input, e instanceof Error ? e.message : '無效 JSON'))
                setOutput('')
              }
            }}
          >
            驗證
          </button>
          <button
            className="btn ghost"
            disabled={!output || output.startsWith('✓')}
            onClick={async () => {
              await copyText(output)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button
            className="btn ghost"
            disabled={!output || output.startsWith('✓')}
            onClick={() => downloadText('data.json', output, 'application/json')}
          >
            下載
          </button>
        </div>
        {error && (
          <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
            {error}
          </p>
        )}
        {output && (
          <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 320 }}>
            {output}
          </pre>
        )}
        <div className="stack">
          <span className="label">路徑查詢（選用，例如 nested.a 或 n[0]）</span>
          <div className="row">
            <input
              className="field mono"
              style={{ flex: 1 }}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="nested.a"
            />
            <button className="btn accent" onClick={queryPath}>
              查詢
            </button>
            <button className="btn ghost sm" disabled={!pathResult} onClick={() => void copyText(pathResult)}>
              複製結果
            </button>
          </div>
          {pathResult && (
            <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
              {pathResult}
            </pre>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
