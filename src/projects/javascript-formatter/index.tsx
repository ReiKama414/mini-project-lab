import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import * as prettier from 'prettier/standalone'
import * as prettierPluginBabel from 'prettier/plugins/babel'
import * as prettierPluginEstree from 'prettier/plugins/estree'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'javascript-formatter',
  title: 'JavaScript Formatter',
  description: 'Prettier 本機美化／壓縮 JS，支援範例與下載',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('javascript-formatter') ?? fallback

const MAX = 200_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'
type Mode = 'pretty' | 'minify' | null

const SAMPLES = [
  {
    label: '函式',
    body: `function hi(name){return "hello "+name}\nconsole.log(hi("Ada"))`,
  },
  {
    label: '非同步',
    body: `async function load(url){const r=await fetch(url);if(!r.ok)throw new Error(r.status);return r.json()}`,
  },
  {
    label: '陣列',
    body: `const xs=[1,2,3].map(n=>n*2).filter(n=>n>2)\nconsole.log(xs.join(","))`,
  },
]

function lineCount(text: string) {
  if (!text) return 0
  return text.split('\n').length
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:javascript-formatter:input',
    'function hi(name){return "hello "+name}\nconsole.log(hi("Ada"))',
  )
  const [view, setView] = useLocalStorage<ViewMode>('lab:javascript-formatter:view', 'split')
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  async function run(minify: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入 JavaScript')
      setOut('')
      setMode(null)
      return
    }
    setBusy(true)
    setError('')
    setHint('')
    try {
      const result = await prettier.format(input, {
        parser: 'babel',
        plugins: [prettierPluginBabel, prettierPluginEstree],
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: minify ? 100000 : 80,
      })
      setOut(minify ? result.replace(/\n\s*/g, ' ').replace(/\s*([{}();,])\s*/g, '$1').trim() : result)
      setMode(minify ? 'minify' : 'pretty')
      setCopied(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（語法可能無效）')
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
            onClick={() => downloadText('formatted.js', out, 'text/javascript')}
            icon="download"
          >
            下載 JS
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
            {error && <span className="tag xc-tag-warn">格式化失敗</span>}
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
                <h3 className="pw-panel-title">JavaScript 輸入</h3>
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
                accept=".js,.mjs,.cjs,text/javascript,application/javascript,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 JS"
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
                aria-label="JavaScript"
              />
              <div className="field-meta">
                <span>Prettier babel · singleQuote</span>
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
                    onClick={() => downloadText('formatted.js', out, 'text/javascript')}
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
              <strong>Prettier standalone（babel + estree）；預設單引號與 trailing comma</strong>
            </li>
            <li>
              <span className="muted">壓縮</span>
              <strong>先格式化再合併換行／標點空白；非 terser／esbuild 等級 minify</strong>
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
              <span className="muted">限制</span>
              <strong>語法錯誤會失敗；TypeScript／JSX 可能需調整或拆段處理</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
