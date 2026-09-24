import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { dump as yamlDump } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'json-to-yaml',
  title: 'JSON → YAML',
  description: 'JSON 轉 YAML，可調縮排與鍵排序',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('json-to-yaml') ?? fallback

const MAX = 300_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'

const SAMPLES = [
  {
    label: '物件',
    body: `{\n  "name": "Ada",\n  "tags": ["dev", "ui"],\n  "active": true,\n  "meta": { "level": 1 }\n}`,
  },
  {
    label: '陣列',
    body: `[\n  { "id": 1, "ok": true },\n  { "id": 2, "ok": false }\n]`,
  },
  {
    label: '純量',
    body: `"hello YAML"`,
  },
]

function typeLabel(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array(${v.length})`
  return typeof v
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort((a, b) => a.localeCompare(b))) {
      out[k] = sortKeysDeep(o[k])
    }
    return out
  }
  return v
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:json-to-yaml:input',
    '{\n  "name": "Ada",\n  "tags": ["dev", "ui"],\n  "active": true\n}',
  )
  const [indent, setIndent] = useLocalStorage('lab:json-to-yaml:indent', 2)
  const [lineWidth, setLineWidth] = useLocalStorage('lab:json-to-yaml:lw', 100)
  const [sortKeys, setSortKeys] = useLocalStorage('lab:json-to-yaml:sort', false)
  const [flow, setFlow] = useLocalStorage('lab:json-to-yaml:flow', false)
  const [view, setView] = useLocalStorage<ViewMode>('lab:json-to-yaml:view', 'split')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!isNonEmpty(input)) return { out: '', err: '', kind: '', size: 0 }
    try {
      let data: unknown = JSON.parse(input)
      if (sortKeys) data = sortKeysDeep(data)
      const out = yamlDump(data, {
        indent: Math.min(8, Math.max(1, Number(indent) || 2)),
        lineWidth: Math.min(200, Math.max(40, Number(lineWidth) || 100)),
        noRefs: true,
        flowLevel: flow ? 0 : -1,
      })
      return { out, err: '', kind: typeLabel(data), size: new Blob([out]).size }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : '轉換失敗', kind: '', size: 0 }
    }
  }, [input, indent, lineWidth, sortKeys, flow])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!result.out} onClick={() => void copyVal(result.out, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.out}
            onClick={() => downloadText('data.yaml', result.out, 'application/yaml')}
            icon="download"
          >
            下載 YAML
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row xc-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '輸入'],
                  ['out', '輸出'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`btn sm ${view === id ? 'accent' : 'ghost'}`} onClick={() => setView(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-stats">
            {result.kind && <span className="tag">{result.kind}</span>}
            {result.out && <span className="tag">{formatBytes(result.size)}</span>}
            {result.err && <span className="tag xc-tag-warn">JSON 無效</span>}
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
                    setInput(s.body)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">縮排</div>
            <div className="pw-chips">
              {[2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${Number(indent) === n ? 'accent' : 'ghost'}`}
                  onClick={() => setIndent(n)}
                >
                  {n} 空白
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">行寬約</div>
            <div className="pw-chips">
              {[80, 100, 120].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${Number(lineWidth) === n ? 'accent' : 'ghost'}`}
                  onClick={() => setLineWidth(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
              鍵名排序
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={flow} onChange={(e) => setFlow(e.target.checked)} />
              Flow 風格（較像 JSON）
            </label>
          </div>
        </div>

        <div className={`xc-main xc-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel xc-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">JSON 輸入</h3>
                <ActionButton className="btn sm ghost" icon="trash" disabled={!input} onClick={() => setInput('')}>
                  清除
                </ActionButton>
              </div>
              {result.err && <p className="field-error">{result.err}</p>}
              {hint && !result.err && <p className="field-hint">{hint}</p>}
              <FileDrop
                accept=".json,application/json,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 JSON"
                hint={`上限 ${formatBytes(FILE_MAX)}`}
                onFiles={(files) => {
                  void (async () => {
                    const f = files[0]
                    if (!f) return
                    setBusy(true)
                    try {
                      setInput(limitText(await f.text(), MAX))
                      setHint(`已載入「${f.name}」`)
                    } catch {
                      setHint('')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              />
              <textarea
                className={`field mono xc-textarea${!isNonEmpty(input) ? ' is-invalid' : ''}${result.err ? ' is-invalid' : ''}`}
                value={input}
                maxLength={MAX}
                disabled={busy}
                spellCheck={false}
                onChange={(e) => setInput(limitText(e.target.value, MAX))}
                aria-label="JSON"
              />
              <div className="field-meta">
                <span>js-yaml dump · noRefs</span>
                <span>
                  {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'out') && (
            <section className="panel xc-out">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">YAML 輸出</h3>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!result.out}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'out' ? '已複製' : '複製'}
                    onClick={() => void copyVal(result.out, 'out')}
                  />
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!result.out}
                    icon="download"
                    iconOnly
                    tooltip="下載"
                    onClick={() => downloadText('data.yaml', result.out, 'application/yaml')}
                  />
                </div>
              </div>
              {result.out ? (
                <pre className="xc-pre mono">{result.out}</pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  有效 JSON 會即時轉成 YAML
                </p>
              )}
            </section>
          )}
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">引擎</span>
              <strong>js-yaml（瀏覽器本機）</strong>
            </li>
            <li>
              <span className="muted">錨點</span>
              <strong>使用 noRefs，避免輸出錨點／別名引用</strong>
            </li>
            <li>
              <span className="muted">Flow</span>
              <strong>開啟後傾向單行／JSON 風格；關閉為區塊縮排</strong>
            </li>
            <li>
              <span className="muted">注意</span>
              <strong>YAML 1.1 對 yes／no／on／off 可能有特殊語意；回轉 JSON 時請再確認</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>不上傳伺服器</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>YAML → JSON、JSON Formatter</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
