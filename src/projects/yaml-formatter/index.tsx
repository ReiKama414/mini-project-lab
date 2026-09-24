import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'yaml-formatter',
  title: 'YAML Formatter',
  description: 'js-yaml 本機解析並美化／壓縮 YAML',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('yaml-formatter') ?? fallback

const MAX = 200_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'
type Mode = 'pretty' | 'minify' | null

const SAMPLES = [
  {
    label: '物件',
    body: `name: Ada\ntags: [dev, ui]\nactive: true\n`,
  },
  {
    label: '巢狀',
    body: `server:\n  host: localhost\n  port: 8080\nfeatures:\n  - auth\n  - cache\n`,
  },
  {
    label: '列表',
    body: `- id: 1\n  name: a\n- id: 2\n  name: b\n`,
  },
]

function lineCount(text: string) {
  if (!text) return 0
  return text.split('\n').length
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:yaml-formatter:input',
    'name: Ada\ntags: [dev, ui]\nactive: true\n',
  )
  const [view, setView] = useLocalStorage<ViewMode>('lab:yaml-formatter:view', 'split')
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  async function run(minify: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入 YAML')
      setOut('')
      setMode(null)
      return
    }
    setBusy(true)
    setError('')
    setHint('')
    try {
      const data = yamlLoad(input)
      const result = yamlDump(data, {
        lineWidth: minify ? -1 : 100,
        noRefs: true,
        flowLevel: minify ? 0 : -1,
      })
      setOut(minify ? result.replace(/\n+/g, ' ').trim() : result)
      setMode(minify ? 'minify' : 'pretty')
      setCopied(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（YAML 可能無效）')
      setOut('')
      setMode(null)
    } finally {
      setBusy(false)
    }
  }

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
          <ActionButton className="btn sm ghost" disabled={!out} onClick={() => void copyVal(out, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!out}
            onClick={() => downloadText('formatted.yaml', out, 'application/yaml')}
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
            <span className="tag">{charCount(input).toLocaleString()} 字</span>
            <span className="tag">{lineCount(input).toLocaleString()} 行</span>
            {out && <span className="tag">{formatBytes(new Blob([out]).size)}</span>}
            {mode === 'pretty' && <span className="tag">已美化</span>}
            {mode === 'minify' && <span className="tag">已壓縮</span>}
            {error && <span className="tag xc-tag-warn">YAML 無效</span>}
            {busy && <span className="tag">處理中…</span>}
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
                    setOut('')
                    setError('')
                    setMode(null)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <ActionButton className="btn sm accent" disabled={!isNonEmpty(input) || busy} onClick={() => void run(false)}>
              {busy ? '處理中…' : '格式化'}
            </ActionButton>
            <ActionButton className="btn sm teal" disabled={!isNonEmpty(input) || busy} onClick={() => void run(true)}>
              壓縮
            </ActionButton>
          </div>
        </div>

        <div className={`xc-main xc-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel xc-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">YAML 輸入</h3>
                <ActionButton
                  className="btn sm ghost"
                  icon="trash"
                  disabled={!input}
                  onClick={() => {
                    setInput('')
                    setOut('')
                    setError('')
                    setMode(null)
                    setHint('')
                  }}
                >
                  清除
                </ActionButton>
              </div>
              {error && <p className="field-error">{error}</p>}
              {hint && !error && <p className="field-hint">{hint}</p>}
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
                      setOut('')
                      setError('')
                      setMode(null)
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
                className={`field mono xc-textarea${!isNonEmpty(input) ? ' is-invalid' : ''}${error ? ' is-invalid' : ''}`}
                value={input}
                maxLength={MAX}
                disabled={busy}
                spellCheck={false}
                onChange={(e) => {
                  setInput(limitText(e.target.value, MAX))
                  setError('')
                  setHint('')
                }}
                aria-label="YAML"
              />
              <div className="field-meta">
                <span>js-yaml load → dump</span>
                <span>
                  {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'out') && (
            <section className="panel xc-out">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">輸出</h3>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!out}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'out' ? '已複製' : '複製'}
                    onClick={() => void copyVal(out, 'out')}
                  />
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!out}
                    icon="download"
                    iconOnly
                    tooltip="下載"
                    onClick={() => downloadText('formatted.yaml', out, 'application/yaml')}
                  />
                </div>
              </div>
              {out ? (
                <>
                  <pre className="xc-pre mono">{out}</pre>
                  <div className="field-meta">
                    <span>
                      {charCount(out).toLocaleString()} 字 · {lineCount(out).toLocaleString()} 行
                    </span>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  按「格式化」或「壓縮」後顯示結果
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
              <strong>js-yaml load／dump（預設安全 schema，不執行自訂標籤程式碼）</strong>
            </li>
            <li>
              <span className="muted">壓縮</span>
              <strong>flowLevel 0 再合併換行；註解與錨點／引用可能遺失</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>文字約 {MAX.toLocaleString()} 字元；檔案約 {formatBytes(FILE_MAX)}</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機處理，不上傳伺服器</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>YAML → JSON、JSON → YAML</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
