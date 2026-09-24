import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'json-diff',
  title: 'JSON Diff',
  description: '扁平化路徑比對兩份 JSON 的新增／刪除／變更',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['dev'],
}
const meta = getProject('json-diff') ?? fallback

const MAX = 100_000
const FILE_MAX = 4 * 1024 * 1024

const SAMPLES = [
  {
    label: '年齡變更',
    a: '{\n  "name": "Ada",\n  "age": 36\n}',
    b: '{\n  "name": "Ada",\n  "age": 37,\n  "city": "Taipei"\n}',
  },
  {
    label: '巢狀',
    a: '{\n  "user": { "id": 1, "role": "editor" }\n}',
    b: '{\n  "user": { "id": 1, "role": "admin" }\n}',
  },
  {
    label: '陣列',
    a: '{\n  "tags": ["a", "b"]\n}',
    b: '{\n  "tags": ["a", "c"]\n}',
  },
]

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

type DiffRow = { path: string; left: string; right: string; kind: string }

export default function Page() {
  const [a, setA] = useLocalStorage('lab:json-diff:a', SAMPLES[0]!.a)
  const [b, setB] = useLocalStorage('lab:json-diff:b', SAMPLES[0]!.b)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const result = useMemo(() => {
    if (!isNonEmpty(a) || !isNonEmpty(b)) {
      return { diff: [] as DiffRow[], error: '請填寫兩側 JSON', ready: false }
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
        .filter(Boolean) as DiffRow[]
      return { diff: rows, error: '', ready: true }
    } catch (e) {
      return { diff: [] as DiffRow[], error: zhParseError(e), ready: false }
    }
  }, [a, b])

  const report = result.diff.map((d) => `${d.kind} ${d.path}: ${d.left} → ${d.right}`).join('\n')

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function loadSide(side: 'a' | 'b', file: File) {
    setBusy(true)
    try {
      const text = limitText(await file.text(), MAX)
      if (side === 'a') setA(text)
      else setB(text)
      setHint(`已載入「${file.name}」到${side === 'a' ? '左側' : '右側'}`)
    } catch {
      setHint('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!result.diff.length}
            onClick={() => void copyVal(report, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製差異'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.diff.length}
            onClick={() => downloadText('json-diff.txt', report)}
            icon="download"
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {result.ready && !result.error && (
                <span className="tag">{result.diff.length ? `${result.diff.length} 處差異` : '相同'}</span>
              )}
              {result.error && isNonEmpty(a) && isNonEmpty(b) && (
                <span className="tag xc-tag-warn">解析失敗</span>
              )}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setA(s.a)
                    setB(s.b)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">左側 JSON</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!a} onClick={() => setA('')}>
                清除
              </ActionButton>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept=".json,application/json,text/plain"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放左側 JSON"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => {
                const f = files[0]
                if (f) void loadSide('a', f)
              }}
            />
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(a) ? ' is-invalid' : ''}`}
              value={a}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setA(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="左側 JSON"
            />
            <div className="field-meta">
              <span>扁平化路徑</span>
              <span>
                {charCount(a).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">右側 JSON</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!b} onClick={() => setB('')}>
                清除
              </ActionButton>
            </div>
            <FileDrop
              accept=".json,application/json,text/plain"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放右側 JSON"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => {
                const f = files[0]
                if (f) void loadSide('b', f)
              }}
            />
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(b) ? ' is-invalid' : ''}`}
              value={b}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setB(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="右側 JSON"
            />
            <div className="field-meta">
              <span>即時比對</span>
              <span>
                {charCount(b).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>
        </div>

        <section className="panel xc-out">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">差異結果</h3>
            <div className="row" style={{ gap: 6 }}>
              <ActionButton
                className="btn sm ghost"
                disabled={!result.diff.length}
                icon="copy"
                iconOnly
                tooltip={copied === 'out' ? '已複製' : '複製'}
                onClick={() => void copyVal(report, 'out')}
              />
              <ActionButton
                className="btn sm ghost"
                disabled={!result.diff.length}
                icon="download"
                iconOnly
                tooltip="下載"
                onClick={() => downloadText('json-diff.txt', report)}
              />
            </div>
          </div>
          {result.error && isNonEmpty(a) && isNonEmpty(b) && <p className="field-error">{result.error}</p>}
          {result.ready && !result.diff.length && <p className="field-hint">兩側相同，無差異</p>}
          {result.diff.length > 0 ? (
            <ul className="list">
              {result.diff.map((d) => (
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
            </ul>
          ) : (
            !result.error && <p className="muted" style={{ margin: 0 }}>有效 JSON 會即時顯示差異</p>
          )}
        </section>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>路徑扁平化後比對鍵值（非完整 tree／LCS diff）</strong>
            </li>
            <li>
              <span className="muted">陣列</span>
              <strong>以索引比對；重排可能顯示為多處變更</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解析，不上傳；相關：Text Diff、JSON Formatter</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
