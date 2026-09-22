import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, formatBytes, isNonEmpty, limitText, copyText, downloadText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'

const meta = getProject('json-formatter')!

const JSON_MAX = 200_000
const PATH_MAX = 200
const FILE_MAX = 512_000

type IndentOpt = 2 | 4
type ViewMode = 'split' | 'edit' | 'result'

const SAMPLES: Record<string, { label: string; body: string }> = {
  basic: {
    label: '基礎',
    body: `{
  "hello": "world",
  "n": [1, 2, 3],
  "nested": { "a": 1, "b": true }
}`,
  },
  api: {
    label: 'API',
    body: `{
  "ok": true,
  "data": {
    "id": "usr_42",
    "name": "Ada",
    "roles": ["admin", "editor"],
    "meta": { "createdAt": "2026-09-10T08:00:00Z", "score": 98.5 }
  },
  "error": null
}`,
  },
  array: {
    label: '陣列',
    body: `[
  { "id": 1, "title": "Todo", "done": false },
  { "id": 2, "title": "Ship", "done": true }
]`,
  },
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
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

function rootTypeLabel(value: unknown) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function analyzeJson(value: unknown) {
  let objects = 0
  let arrays = 0
  let strings = 0
  let numbers = 0
  let booleans = 0
  let nulls = 0
  let keys = 0
  let maxDepth = 0

  function walk(v: unknown, depth: number) {
    maxDepth = Math.max(maxDepth, depth)
    if (v === null) {
      nulls += 1
      return
    }
    if (Array.isArray(v)) {
      arrays += 1
      for (const item of v) walk(item, depth + 1)
      return
    }
    switch (typeof v) {
      case 'object': {
        objects += 1
        for (const val of Object.values(v as Record<string, unknown>)) {
          keys += 1
          walk(val, depth + 1)
        }
        break
      }
      case 'string':
        strings += 1
        break
      case 'number':
        numbers += 1
        break
      case 'boolean':
        booleans += 1
        break
    }
  }

  walk(value, 1)

  const topKeys =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value as Record<string, unknown>).slice(0, 24)
      : Array.isArray(value)
        ? value.slice(0, 12).map((_, i) => `[${i}]`)
        : []

  return {
    objects,
    arrays,
    strings,
    numbers,
    booleans,
    nulls,
    keys,
    maxDepth,
    rootType: rootTypeLabel(value),
    topKeys,
    arrayLen: Array.isArray(value) ? value.length : null as number | null,
  }
}

function tryParse(input: string): { ok: true; value: unknown } | { ok: false; msg: string } {
  if (!input.trim()) return { ok: false, msg: '空白' }
  if (charCount(input) > JSON_MAX) return { ok: false, msg: `超過 ${JSON_MAX} 字元上限` }
  try {
    return { ok: true, value: JSON.parse(input) }
  } catch (e) {
    return { ok: false, msg: parseErrorHint(input, e instanceof Error ? e.message : '無效 JSON') }
  }
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:json-formatter:input', SAMPLES.basic!.body)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [sortKeys, setSortKeys] = useLocalStorage('lab:json-formatter:sortKeys', false)
  const [indent, setIndent] = useLocalStorage<IndentOpt>('lab:json-formatter:indent', 2)
  const [escapeUnicode, setEscapeUnicode] = useLocalStorage('lab:json-formatter:escapeUnicode', false)
  const [view, setView] = useLocalStorage<ViewMode>('lab:json-formatter:view', 'split')
  const [path, setPath] = useState('')
  const [pathResult, setPathResult] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  const parsed = useMemo(() => tryParse(input), [input])
  const stats = useMemo(() => (parsed.ok ? analyzeJson(parsed.value) : null), [parsed])
  const lines = useMemo(() => (input ? input.split(/\r?\n/).length : 0), [input])
  const outBytes = useMemo(() => (output ? new Blob([output]).size : 0), [output])
  const inBytes = useMemo(() => new Blob([input]).size, [input])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function stringify(value: unknown, pretty: boolean) {
    let obj = value
    if (sortKeys) obj = sortKeysDeep(obj)
    const space = pretty ? indent : 0
    let text = JSON.stringify(obj, null, space)
    if (escapeUnicode) {
      text = text.replace(/[\u007f-\uffff]/g, (ch) => {
        const hex = ch.charCodeAt(0).toString(16).padStart(4, '0')
        return `\\u${hex}`
      })
    }
    return text
  }

  function run(pretty: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入 JSON')
      setOutput('')
      setNote('')
      return
    }
    const result = tryParse(input)
    if (!result.ok) {
      setError(result.msg)
      setOutput('')
      setNote('')
      return
    }
    try {
      const text = stringify(result.value, pretty)
      setOutput(text)
      setError('')
      setNote(pretty ? '已格式化' : '已壓縮')
    } catch (e) {
      setError(e instanceof Error ? e.message : '處理失敗')
      setOutput('')
      setNote('')
    }
  }

  function validateOnly() {
    const result = tryParse(input)
    if (!result.ok) {
      setError(result.msg)
      setNote('')
      return
    }
    setError('')
    setNote('✓ 驗證通過')
  }

  function queryPath() {
    const result = tryParse(input)
    if (!result.ok) {
      setError(result.msg)
      setPathResult('')
      return
    }
    const val = getByPath(result.value, path.trim())
    if (val === undefined) {
      setPathResult('（無此路徑）')
    } else {
      setPathResult(typeof val === 'string' ? val : JSON.stringify(val, null, indent))
    }
    setError('')
  }

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setLoadError('')
    try {
      const text = await file.text()
      if (text.length > JSON_MAX) {
        setLoadError(`檔案內容超過 ${JSON_MAX.toLocaleString()} 字元上限`)
        return
      }
      setInput(limitText(text, JSON_MAX))
      setOutput('')
      setError('')
      setNote('已匯入檔案')
      setPathResult('')
    } catch {
      setLoadError('無法讀取檔案')
    }
  }

  function applySample(body: string) {
    if (input.trim() && !confirm('套用範本會覆蓋目前輸入，確定？')) return
    setInput(body)
    setOutput('')
    setError('')
    setNote('')
    setPathResult('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row jf-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!output}
            onClick={() => void copyVal(output, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製結果'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!output}
            onClick={() => downloadText('data.json', output, 'application/json')}
          >
            下載 JSON
          </ActionButton>
        </div>
      }
    >
      <div className="jf-calc">
        <div className="pw-stats">
          <span className={`metric ${parsed.ok ? '' : 'warn'}`}>{parsed.ok ? '有效 JSON' : parsed.msg}</span>
          <span className="tag mono">{charCount(input).toLocaleString()} 字</span>
          <span className="tag">{lines.toLocaleString()} 行</span>
          <span className="tag">{formatBytes(inBytes)}</span>
          {stats && (
            <>
              <span className="tag">{stats.rootType}</span>
              <span className="tag">深度 {stats.maxDepth}</span>
              <span className="tag">鍵 {stats.keys}</span>
            </>
          )}
        </div>

        <div className="panel jf-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row jf-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '輸入'],
                  ['result', '結果'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">範本</div>
            <div className="pw-chips">
              {Object.entries(SAMPLES).map(([key, s]) => (
                <button key={key} type="button" className="btn sm ghost" onClick={() => applySample(s.body)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row jf-options">
            <label className="jf-check">
              <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
              <span>排序鍵名</span>
            </label>
            <label className="jf-check">
              <input
                type="checkbox"
                checked={escapeUnicode}
                onChange={(e) => setEscapeUnicode(e.target.checked)}
              />
              <span>跳脫 Unicode</span>
            </label>
            <div className="row jf-indent">
              <span className="muted" style={{ fontSize: 12 }}>
                縮排
              </span>
              {([2, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${indent === n ? 'accent' : 'ghost'}`}
                  onClick={() => setIndent(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <FileDrop
            accept=".json,application/json,text/plain,.txt"
            maxBytes={FILE_MAX}
            label="匯入 JSON 檔"
            hint="拖放或點擊選擇 .json / .txt"
            onFiles={(files) => void onFiles(files)}
          />
          {loadError && <p className="field-error">{loadError}</p>}
        </div>

        <div className={`jf-main jf-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel jf-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">輸入</h3>
                <span className="tag mono">
                  {charCount(input).toLocaleString()} / {JSON_MAX.toLocaleString()}
                </span>
              </div>

              <div className="jf-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  <button
                    type="button"
                    className="btn sm accent"
                    disabled={!isNonEmpty(input)}
                    onClick={() => run(true)}
                  >
                    格式化
                  </button>
                  <button
                    type="button"
                    className="btn sm teal"
                    disabled={!isNonEmpty(input)}
                    onClick={() => run(false)}
                  >
                    壓縮
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={!isNonEmpty(input)}
                    onClick={validateOnly}
                  >
                    驗證
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={!output}
                    onClick={() => {
                      setInput(output)
                      setError('')
                      setNote('已寫回輸入')
                    }}
                  >
                    寫回輸入
                  </button>
                  <ActionButton className="btn sm ghost" onClick={() => setInput('')}>
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className={`field mono jf-textarea${!parsed.ok && isNonEmpty(input) ? ' is-invalid' : ''}`}
                value={input}
                maxLength={JSON_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setInput(limitText(e.target.value, JSON_MAX))
                  setNote('')
                }}
                placeholder='{ "hello": "world" }'
                aria-label="JSON 輸入區"
              />
              {error && <p className="field-error">{error}</p>}
              {note && !error && <p className="field-hint">{note}</p>}
            </section>
          )}

          {(view === 'split' || view === 'result') && (
            <section className="panel jf-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">結果</h3>
                <div className="row" style={{ gap: 6 }}>
                  {output && <span className="tag mono">{formatBytes(outBytes)}</span>}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!output}
                    onClick={() => void copyVal(output, 'out')}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'out' ? '已複製' : '複製'}
                  />
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!output}
                    onClick={() => downloadText('data.json', output, 'application/json')}
                  >
                    下載
                  </ActionButton>
                </div>
              </div>
              {output ? (
                <pre className="jf-output mono">{output}</pre>
              ) : (
                <p className="muted jf-empty">按「格式化」或「壓縮」後顯示於此</p>
              )}
            </section>
          )}
        </div>

        <div className="jf-bottom">
          <section className="panel jf-path">
            <h3 className="pw-panel-title">路徑查詢</h3>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              例如 <code>nested.a</code>、<code>n[0]</code>、<code>data.roles[1]</code>
            </p>
            <div className="row jf-path-row">
              <input
                className="field mono"
                style={{ flex: 1 }}
                value={path}
                maxLength={PATH_MAX}
                onChange={(e) => setPath(limitText(e.target.value, PATH_MAX))}
                placeholder="nested.a"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') queryPath()
                }}
              />
              <button
                type="button"
                className="btn accent sm"
                onClick={queryPath}
                disabled={!isNonEmpty(input) || !isNonEmpty(path)}
              >
                查詢
              </button>
              <ActionButton
                className="btn ghost sm"
                disabled={!pathResult}
                onClick={() => void copyVal(pathResult, 'path')}
                icon="copy"
              >
                {copied === 'path' ? '已複製' : '複製'}
              </ActionButton>
            </div>
            {pathResult && <pre className="jf-path-result mono">{pathResult}</pre>}
            {stats && stats.topKeys.length > 0 && (
              <div className="pw-block">
                <div className="label">頂層鍵（點擊填入路徑）</div>
                <div className="pw-chips">
                  {stats.topKeys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="btn sm ghost"
                      onClick={() => setPath(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="panel jf-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            {stats ? (
              <ul className="pw-info-list">
                <li>
                  <span className="muted">根類型</span>
                  <strong className="mono">{stats.rootType}</strong>
                </li>
                {stats.arrayLen != null && (
                  <li>
                    <span className="muted">陣列長度</span>
                    <strong className="mono">{stats.arrayLen}</strong>
                  </li>
                )}
                <li>
                  <span className="muted">最大深度</span>
                  <strong className="mono">{stats.maxDepth}</strong>
                </li>
                <li>
                  <span className="muted">物件／陣列</span>
                  <strong className="mono">
                    {stats.objects} / {stats.arrays}
                  </strong>
                </li>
                <li>
                  <span className="muted">鍵數量</span>
                  <strong className="mono">{stats.keys}</strong>
                </li>
                <li>
                  <span className="muted">字串／數字</span>
                  <strong className="mono">
                    {stats.strings} / {stats.numbers}
                  </strong>
                </li>
                <li>
                  <span className="muted">布林／null</span>
                  <strong className="mono">
                    {stats.booleans} / {stats.nulls}
                  </strong>
                </li>
                <li>
                  <span className="muted">輸入大小</span>
                  <strong className="mono">{formatBytes(inBytes)}</strong>
                </li>
                <li>
                  <span className="muted">結果大小</span>
                  <strong className="mono">{output ? formatBytes(outBytes) : '—'}</strong>
                </li>
                {output && (
                  <li>
                    <span className="muted">壓縮比</span>
                    <strong className="mono">
                      {inBytes > 0 ? `${((outBytes / inBytes) * 100).toFixed(1)}%` : '—'}
                    </strong>
                  </li>
                )}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入有效 JSON 後會顯示結構統計
              </p>
            )}
            <p className="muted pw-hint">
              內容存於本機；錯誤訊息會盡量標出行列。排序鍵名會遞迴套用；路徑查詢支援點號與
              <code>[index]</code>。
            </p>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
