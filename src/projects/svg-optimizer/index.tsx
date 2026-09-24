import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'svg-optimizer',
  title: 'SVG 精簡',
  description: '移除註解、空白與編輯器屬性，本機精簡 SVG',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev', 'design'],
}
const meta = getProject('svg-optimizer') ?? fallback

const MAX = 200_000
const FILE_MAX = 4 * 1024 * 1024

const SAMPLES = [
  {
    label: '圓形圖示',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <!-- icon -->
  <circle cx="12" cy="12" r="10" fill="none" stroke="#333"/>
</svg>`,
  },
  {
    label: 'Inkscape 雜訊',
    body: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="40" height="40">
  <rect x="4" y="4" width="32" height="32" fill="#2a9d8f" inkscape:label="box" data-name="Layer 1"/>
</svg>`,
  },
  {
    label: '多餘空白',
    body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">

  <text x="4" y="14" font-size="12">Hello</text>

</svg>`,
  },
]

function optimize(svg: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error('SVG 解析失敗')
  const root = doc.documentElement
  if (!root || root.localName.toLowerCase() !== 'svg') throw new Error('找不到 <svg> 根元素')

  const walk = (node: Node) => {
    const kids = [...node.childNodes]
    for (const child of kids) {
      if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child)
        continue
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || '').replace(/\s+/g, ' ')
        if (!t.trim()) node.removeChild(child)
        else child.textContent = t
        continue
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element
        for (const attr of [...el.attributes]) {
          const name = attr.name.toLowerCase()
          if (name.startsWith('inkscape:') || name.startsWith('sodipodi:') || name === 'data-name') {
            el.removeAttribute(attr.name)
          }
        }
        walk(el)
      }
    }
  }
  walk(root)

  const serializer = new XMLSerializer()
  let out = serializer.serializeToString(root)
  out = out.replace(/>\s+</g, '><').trim()
  return out
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:svg-optimizer:input', SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const result = useMemo(() => {
    if (!isNonEmpty(input)) return { out: '', err: '', saved: 0 }
    try {
      const out = optimize(input)
      const saved = Math.max(0, charCount(input) - charCount(out))
      return { out, err: '', saved }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : '失敗', saved: 0 }
    }
  }, [input])

  const previewUrl = useMemo(() => {
    if (!result.out) return ''
    return URL.createObjectURL(new Blob([result.out], { type: 'image/svg+xml' }))
  }, [result.out])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
            onClick={() => downloadText('optimized.svg', result.out, 'image/svg+xml')}
            icon="download"
          >
            下載 SVG
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {result.out && (
                <span className="tag">
                  {charCount(input)} → {charCount(result.out)}
                </span>
              )}
              {result.saved > 0 && <span className="tag">−{result.saved} 字元</span>}
              {result.err && <span className="tag xc-tag-warn">SVG 無效</span>}
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
              <h3 className="pw-panel-title">SVG 輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!input} onClick={() => setInput('')}>
                清除
              </ActionButton>
            </div>
            {result.err && <p className="field-error">{result.err}</p>}
            {hint && !result.err && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept=".svg,image/svg+xml,text/plain"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放 SVG"
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
              onChange={(e) => {
                setInput(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="SVG"
            />
            <div className="field-meta">
              <span>DOMParser → XMLSerializer</span>
              <span>
                {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">精簡輸出</h3>
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
                  onClick={() => downloadText('optimized.svg', result.out, 'image/svg+xml')}
                />
              </div>
            </div>
            {result.out ? (
              <>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="SVG 預覽"
                    style={{ maxWidth: 120, maxHeight: 120, background: 'var(--surface)', marginBottom: 8 }}
                  />
                )}
                <pre className="xc-pre mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {result.out}
                </pre>
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                有效 SVG 會即時精簡
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">會移除</span>
              <strong>註解、多餘空白、inkscape:／sodipodi:／data-name 屬性</strong>
            </li>
            <li>
              <span className="muted">會保留</span>
              <strong>fill=&quot;none&quot;、描邊等語意屬性；非完整 SVGO 管線</strong>
            </li>
            <li>
              <span className="muted">預覽</span>
              <strong>以 Blob URL 安全顯示，不執行外部腳本</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解析，不上傳</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
