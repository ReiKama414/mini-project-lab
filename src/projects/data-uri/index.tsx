import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('data-uri') ?? {
  slug: 'data-uri',
  title: 'Data URI 產生器',
  description: '將文字內容包裝成 Data URI。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 100_000
const MIME_MAX = 120

export default function Page() {
  const [mime, setMime] = useLocalStorage('lab:data-uri:mime', 'text/plain;charset=utf-8')
  const [text, setText] = useLocalStorage('lab:data-uri:text', 'Hello, 世界')
  const [mode, setMode] = useLocalStorage<'utf8' | 'base64'>('lab:data-uri:mode', 'utf8')
  const [out, setOut] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function build() {
    if (!isNonEmpty(text)) {
      setError('請輸入內容')
      return
    }
    if (!isNonEmpty(mime)) {
      setError('請輸入 MIME')
      return
    }
    try {
      if (mode === 'utf8') {
        setOut(`data:${mime.trim()},${encodeURIComponent(text)}`)
      } else {
        const bytes = new TextEncoder().encode(text)
        let bin = ''
        bytes.forEach((b) => {
          bin += String.fromCharCode(b)
        })
        setOut(`data:${mime.trim()};base64,${btoa(bin)}`)
      }
      setError('')
      setCopied(false)
    } catch {
      setError('產生失敗（內容可能含無法編碼的字元）')
      setOut('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          本機產生文字 Data URI。過長的 URI 可能無法在部分瀏覽器／屬性中使用；此工具不處理二進位檔上傳。
        </p>
        <label className="stack">
          <span className="label">MIME</span>
          <input
            className={`field${!isNonEmpty(mime) ? ' is-invalid' : ''}`}
            value={mime}
            maxLength={MIME_MAX}
            onChange={(e) => setMime(limitText(e.target.value, MIME_MAX))}
          />
        </label>
        <label className="stack">
          <span className="label">內容</span>
          <textarea
            className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
            rows={6}
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(text).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <input type="radio" checked={mode === 'utf8'} onChange={() => setMode('utf8')} />
            URL 編碼
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="radio" checked={mode === 'base64'} onChange={() => setMode('base64')} />
            Base64
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={build}>
            產生
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
          <button type="button" className="btn ghost" disabled={!out} onClick={() => downloadText('data-uri.txt', out)}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {out && (
          <>
            <p className="field-hint">長度 {out.length.toLocaleString()} 字元</p>
            <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
              {out}
            </pre>
          </>
        )}
      </div>
    </ProjectShell>
  )
}
