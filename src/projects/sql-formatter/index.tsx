import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { format } from 'sql-formatter'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'sql-formatter',
  title: 'SQL Formatter',
  description: 'sql-formatter 本機美化／壓縮 SQL，支援範例與下載',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('sql-formatter') ?? fallback

const MAX = 200_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'
type Mode = 'pretty' | 'minify' | null

const SAMPLES = [
  {
    label: 'SELECT',
    body: `select id,name from users where active=1 order by name asc`,
  },
  {
    label: 'JOIN',
    body: `select u.id,u.name,o.total from users u left join orders o on o.user_id=u.id where o.total>100`,
  },
  {
    label: 'CTE',
    body: `with active as (select id from users where active=1) select a.id,count(*) from active a join posts p on p.user_id=a.id group by a.id`,
  },
]

function lineCount(text: string) {
  if (!text) return 0
  return text.split('\n').length
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:sql-formatter:input',
    'select id,name from users where active=1 order by name asc',
  )
  const [view, setView] = useLocalStorage<ViewMode>('lab:sql-formatter:view', 'split')
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  async function run(minify: boolean) {
    if (!isNonEmpty(input)) {
      setError('請輸入 SQL')
      setOut('')
      setMode(null)
      return
    }
    setBusy(true)
    setError('')
    setHint('')
    try {
      if (minify) {
        setOut(input.replace(/\s+/g, ' ').trim())
      } else {
        setOut(
          format(input, {
            language: 'sql',
            tabWidth: 2,
            keywordCase: 'upper',
          }),
        )
      }
      setMode(minify ? 'minify' : 'pretty')
      setCopied(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '格式化失敗（SQL 可能無效）')
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
            onClick={() => downloadText('formatted.sql', out, 'application/sql')}
            icon="download"
          >
            下載 SQL
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
                <h3 className="pw-panel-title">SQL 輸入</h3>
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
                accept=".sql,text/plain,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 SQL"
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
                aria-label="SQL"
              />
              <div className="field-meta">
                <span>sql-formatter · keyword UPPER</span>
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
                    onClick={() => downloadText('formatted.sql', out, 'application/sql')}
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
              <strong>sql-formatter（language: sql，關鍵字轉大寫，縮排 2）</strong>
            </li>
            <li>
              <span className="muted">壓縮</span>
              <strong>僅合併空白，不做關鍵字重排或語法驗證</strong>
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
              <strong>方言特定語法（PL/pgSQL、T-SQL 等）可能排版不完美</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
