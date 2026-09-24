import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadBlob } from '../../lib/imageCanvas'
import { charCount, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'base64-to-image',
  title: 'Base64 → 圖片',
  description: 'Data URL／Base64 還原圖片預覽與下載',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev', 'image'],
}
const meta = getProject('base64-to-image') ?? fallback

const MAX = 2_000_000
const FILE_MAX = 4 * 1024 * 1024

const SAMPLES = [
  {
    label: '1×1 PNG',
    body: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  },
  {
    label: '純 Base64',
    body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  },
]

function guessExt(src: string) {
  const m = src.match(/^data:image\/([\w+.-]+);/i)
  const t = (m?.[1] || 'png').toLowerCase()
  if (t === 'jpeg') return 'jpg'
  if (t === 'svg+xml') return 'svg'
  return t.replace(/[^a-z0-9]/g, '') || 'png'
}

function toSrc(raw: string): string {
  const url = raw.trim()
  if (!url) return ''
  if (url.startsWith('data:')) return url
  return `data:image/png;base64,${url.replace(/\s/g, '')}`
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:base64-to-image:input', SAMPLES[0]!.body)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [imgOk, setImgOk] = useState(true)

  const src = useMemo(() => (isNonEmpty(input) ? toSrc(input) : ''), [input])

  async function download() {
    if (!src || !imgOk) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error('fail')
      const blob = await res.blob()
      if (!blob.size) throw new Error('empty')
      downloadBlob(blob, `image.${guessExt(src)}`)
    } catch {
      setError('下載失敗，請確認 Base64 內容是否完整')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm accent" disabled={!src || !imgOk || busy} onClick={() => void download()} icon="download">
            {busy ? '處理中…' : '下載圖片'}
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {src && imgOk && <span className="tag">可預覽</span>}
              {src && !imgOk && <span className="tag xc-tag-warn">無法顯示</span>}
              {busy && <span className="tag">處理中…</span>}
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
                    setInput(s.body)
                    setHint(`已套用「${s.label}」`)
                    setError('')
                    setImgOk(true)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">Base64／Data URL</h3>
              <ActionButton
                className="btn sm ghost"
                icon="trash"
                disabled={!input}
                onClick={() => {
                  setInput('')
                  setHint('')
                  setError('')
                  setImgOk(true)
                }}
              >
                清除
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            {hint && !error && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept=".txt,.b64,text/plain"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放文字檔"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => {
                void (async () => {
                  const f = files[0]
                  if (!f) return
                  setBusy(true)
                  try {
                    setInput(limitText(await f.text(), MAX))
                    setHint(`已載入「${f.name}」`)
                    setError('')
                    setImgOk(true)
                  } catch {
                    setError('讀取失敗')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            />
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(input) ? ' is-invalid' : ''}`}
              value={input}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setInput(limitText(e.target.value, MAX))
                setHint('')
                setError('')
                setImgOk(true)
              }}
              aria-label="Base64 或 Data URL"
            />
            <div className="field-meta">
              <span>純 Base64 預設當 PNG</span>
              <span>
                {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">預覽</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!src || !imgOk || busy}
                icon="download"
                iconOnly
                tooltip="下載"
                onClick={() => void download()}
              />
            </div>
            {src && imgOk ? (
              <img
                src={src}
                alt="解碼預覽"
                style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }}
                onError={() => {
                  setImgOk(false)
                  setError('無法顯示圖片，請檢查編碼')
                }}
                onLoad={() => {
                  setImgOk(true)
                  setError('')
                }}
              />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                貼上有效 Data URL 或 Base64 後即時預覽
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">輸入</span>
              <strong>支援完整 Data URL，或純 Base64（預設 MIME 為 image/png）</strong>
            </li>
            <li>
              <span className="muted">下載</span>
              <strong>依 Data URL 的 MIME 推斷副檔名（png／jpg／svg…）</strong>
            </li>
            <li>
              <span className="muted">限制</span>
              <strong>內容過長可能超出瀏覽器記憶體；上限 {MAX.toLocaleString()} 字元</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解碼，不上傳；相關：圖片 → Base64</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
