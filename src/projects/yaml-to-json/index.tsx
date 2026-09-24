import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { load as yamlLoad, loadAll as yamlLoadAll } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'yaml-to-json',
  title: 'YAML → JSON',
  description: 'YAML 轉 JSON，支援多文件與美化',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('yaml-to-json') ?? fallback

const MAX = 300_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'

const SAMPLES = [
  {
    label: '物件',
    body: `name: Ada\ntags:\n  - dev\n  - ui\nactive: true\n`,
  },
  {
    label: '多文件',
    body: `---\nid: 1\nname: a\n---\nid: 2\nname: b\n`,
  },
  {
    label: '巢狀',
    body: `server:\n  host: localhost\n  port: 8080\nfeatures:\n  - auth\n  - cache\n`,
  },
]

function typeLabel(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array(${v.length})`
  return typeof v
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:yaml-to-json:input',
    'name: Ada\ntags:\n  - dev\n  - ui\nactive: true\n',
  )
  const [pretty, setPretty] = useLocalStorage('lab:yaml-to-json:pretty', true)
  const [multi, setMulti] = useLocalStorage('lab:yaml-to-json:multi', false)
  const [indent, setIndent] = useLocalStorage('lab:yaml-to-json:indent', 2)
  const [view, setView] = useLocalStorage<ViewMode>('lab:yaml-to-json:view', 'split')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!isNonEmpty(input)) return { out: '', err: '', kind: '', docs: 0, size: 0 }
    try {
      let data: unknown
      let docs = 1
      if (multi) {
        const all = yamlLoadAll(input) as unknown[]
        const filtered = all.filter((d) => d !== undefined)
        docs = filtered.length
        data = filtered.length === 1 ? filtered[0] : filtered
      } else {
        data = yamlLoad(input)
      }
      const space = pretty ? Math.min(8, Math.max(0, Number(indent) || 2)) : 0
      const out = JSON.stringify(data, null, space)
      return {
        out,
        err: '',
        kind: typeLabel(data),
        docs,
        size: new Blob([out]).size,
      }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : '轉換失敗', kind: '', docs: 0, size: 0 }
    }
  }, [input, pretty, multi, indent])

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
            onClick={() => downloadText('data.json', result.out, 'application/json')}
            icon="download"
          >
            下載 JSON
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
            {multi && result.docs > 0 && <span className="tag">{result.docs} 文件</span>}
            {result.out && <span className="tag">{formatBytes(result.size)}</span>}
            {result.err && <span className="tag xc-tag-warn">YAML 無效</span>}
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
                    if (s.label === '多文件') setMulti(true)
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
              {[0, 2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${pretty && Number(indent) === n ? 'accent' : !pretty && n === 0 ? 'accent' : 'ghost'}`}
                  onClick={() => {
                    if (n === 0) setPretty(false)
                    else {
                      setPretty(true)
                      setIndent(n)
                    }
                  }}
                >
                  {n === 0 ? '壓縮' : `${n} 空白`}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
              美化 JSON
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              多文件（---）→ 陣列
            </label>
          </div>
        </div>

        <div className={`xc-main xc-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel xc-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">YAML 輸入</h3>
                <ActionButton className="btn sm ghost" icon="trash" disabled={!input} onClick={() => setInput('')}>
                  清除
                </ActionButton>
              </div>
              {result.err && <p className="field-error">{result.err}</p>}
              {hint && !result.err && <p className="field-hint">{hint}</p>}
              <FileDrop
                accept=".yaml,.yml,text/yaml,application/yaml,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 YAML"
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
                aria-label="YAML"
              />
              <div className="field-meta">
                <span>js-yaml load{multi ? 'All' : ''}</span>
                <span>
                  {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'out') && (
            <section className="panel xc-out">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">JSON 輸出</h3>
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
                    onClick={() => downloadText('data.json', result.out, 'application/json')}
                  />
                </div>
              </div>
              {result.out ? (
                <pre className="xc-pre mono">{result.out}</pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  有效 YAML 會即時轉成 JSON
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
              <strong>js-yaml load／loadAll（預設安全 schema，不執行自訂標籤程式碼）</strong>
            </li>
            <li>
              <span className="muted">多文件</span>
              <strong>以 --- 分隔；開啟後輸出文件陣列（僅一份則仍為該文件）</strong>
            </li>
            <li>
              <span className="muted">型別</span>
              <strong>YAML 可能把未加引號的 yes／no／1.0 解成 boolean／number</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解析，不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>JSON → YAML、JSON Formatter、YAML Formatter</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
