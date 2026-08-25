import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('svg-optimizer') ?? {
  slug: 'svg-optimizer',
  title: 'SVG 精簡',
  description: '移除註解、多餘空白與編輯器雜訊。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 200_000

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
  const [input, setInput] = useLocalStorage(
    'lab:svg-optimizer:input',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">\n  <!-- icon -->\n  <circle cx="12" cy="12" r="10" fill="none" stroke="#333"/>\n</svg>',
  )
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState('')
  const [copied, setCopied] = useState(false)

  const previewUrl = useMemo(() => {
    if (!out) return ''
    return URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }))
  }, [out])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function run() {
    if (!isNonEmpty(input)) {
      setError('請輸入 SVG')
      return
    }
    try {
      const result = optimize(input)
      setOut(result)
      setStats(`${charCount(input)} → ${charCount(result)} 字元（-${Math.max(0, charCount(input) - charCount(result))}）`)
      setError('')
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : '失敗')
      setOut('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          保留 <code>fill=&quot;none&quot;</code>／描邊等語意屬性；僅清註解、多餘空白與常見編輯器屬性。預覽以 Blob URL 安全顯示。
        </p>
        <label className="stack">
          <span className="label">SVG</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={10}
            value={input}
            maxLength={MAX}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={run}>
            精簡
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!out}
            onClick={async () => {
              await copyText(out)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('optimized.svg', out, 'image/svg+xml')}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {stats && <p className="field-hint">{stats}</p>}
        {out && (
          <>
            {previewUrl && <img src={previewUrl} alt="SVG 預覽" style={{ maxWidth: 120, maxHeight: 120, background: 'var(--surface)' }} />}
            <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {out}
            </pre>
          </>
        )}
      </div>
    </ProjectShell>
  )
}
