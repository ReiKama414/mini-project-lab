import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'data-uri',
  title: 'Data URI 產生器',
  description: '文字內容包裝成 Data URI（URL 編碼或 Base64）',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('data-uri') ?? fallback

const MAX = 100_000
const MIME_MAX = 120
const FILE_MAX = 2 * 1024 * 1024

const MIME_PRESETS = [
  { label: '純文字', mime: 'text/plain;charset=utf-8' },
  { label: 'HTML', mime: 'text/html;charset=utf-8' },
  { label: 'CSS', mime: 'text/css;charset=utf-8' },
  { label: 'JSON', mime: 'application/json' },
  { label: 'SVG', mime: 'image/svg+xml' },
]

const SAMPLES = [
  { label: '問候', body: 'Hello, 世界' },
  { label: 'HTML', body: '<h1>Hi</h1><p>本機 Data URI</p>', mime: 'text/html;charset=utf-8' },
  { label: 'JSON', body: '{"ok":true,"n":1}', mime: 'application/json' },
]

type Mode = 'utf8' | 'base64'

export default function Page() {
  const [mime, setMime] = useLocalStorage('lab:data-uri:mime', 'text/plain;charset=utf-8')
  const [text, setText] = useLocalStorage('lab:data-uri:text', 'Hello, 世界')
  const [mode, setMode] = useLocalStorage<Mode>('lab:data-uri:mode', 'utf8')
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const result = useMemo(() => {
    if (!isNonEmpty(text) || !isNonEmpty(mime)) return { out: '', err: '' }
    try {
      if (mode === 'utf8') {
        return { out: `data:${mime.trim()},${encodeURIComponent(text)}`, err: '' }
      }
      const bytes = new TextEncoder().encode(text)
      let bin = ''
      bytes.forEach((b) => {
        bin += String.fromCharCode(b)
      })
      return { out: `data:${mime.trim()};base64,${btoa(bin)}`, err: '' }
    } catch {
      return { out: '', err: '產生失敗（內容可能含無法編碼的字元）' }
    }
  }, [text, mime, mode])

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!result.out}
            onClick={() => void copyVal(result.out, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.out}
            onClick={() => downloadText('data-uri.txt', result.out)}
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
              {result.out && <span className="tag">{result.out.length.toLocaleString()} 字元</span>}
              {result.out && <span className="tag">{formatBytes(new Blob([result.out]).size)}</span>}
              {result.err && <span className="tag xc-tag-warn">失敗</span>}
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
                    setText(s.body)
                    if (s.mime) setMime(s.mime)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">MIME 預設</div>
            <div className="pw-chips">
              {MIME_PRESETS.map((p) => (
                <button
                  key={p.mime}
                  type="button"
                  className={`btn sm ${mime === p.mime ? 'accent' : 'ghost'}`}
                  onClick={() => setMime(p.mime)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">編碼</div>
            <div className="pw-chips">
              {(
                [
                  ['utf8', 'URL 編碼'],
                  ['base64', 'Base64'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${mode === id ? 'accent' : 'ghost'}`}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">內容</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!text} onClick={() => setText('')}>
                清除
              </ActionButton>
            </div>
            {result.err && <p className="field-error">{result.err}</p>}
            {hint && !result.err && <p className="field-hint">{hint}</p>}
            <label className="stack" style={{ marginBottom: 8 }}>
              <span className="label">MIME</span>
              <input
                className={`field${!isNonEmpty(mime) ? ' is-invalid' : ''}`}
                value={mime}
                maxLength={MIME_MAX}
                onChange={(e) => setMime(limitText(e.target.value, MIME_MAX))}
              />
            </label>
            <FileDrop
              accept=".txt,.html,.css,.json,.svg,.md,text/plain,text/html,text/css,application/json,image/svg+xml"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放文字檔"
              hint={`上限 ${formatBytes(FILE_MAX)} · 僅文字內容`}
              onFiles={(files) => {
                void (async () => {
                  const f = files[0]
                  if (!f) return
                  setBusy(true)
                  try {
                    setText(limitText(await f.text(), MAX))
                    setHint(`已載入「${f.name}」`)
                    if (f.type) setMime(limitText(f.type, MIME_MAX))
                  } catch {
                    setHint('')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            />
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(text) ? ' is-invalid' : ''}`}
              value={text}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setText(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="Data URI 內容"
            />
            <div className="field-meta">
              <span>{mode === 'utf8' ? 'encodeURIComponent' : 'UTF-8 → Base64'}</span>
              <span>
                {charCount(text).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">Data URI</h3>
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
                  onClick={() => downloadText('data-uri.txt', result.out)}
                />
              </div>
            </div>
            {result.out ? (
              <pre className="xc-pre mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                {result.out}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入內容與 MIME 後即時產生
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">編碼</span>
              <strong>URL 編碼適合文字；Base64 較穩，但體積約大 33%</strong>
            </li>
            <li>
              <span className="muted">限制</span>
              <strong>過長 URI 可能無法用於部分瀏覽器屬性或 HTTP 標頭；此工具僅處理文字</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機產生，不上傳；相關：圖片 → Base64</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
