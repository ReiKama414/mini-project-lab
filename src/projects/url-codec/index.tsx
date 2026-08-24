import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('url-codec')!

type Mode = 'component' | 'uri'

export default function Page() {
  const [raw, setRaw] = useLocalStorage('lab:url-codec:raw', 'https://example.com/?q=你好&x=1 2')
  const [encoded, setEncoded] = useLocalStorage('lab:url-codec:encoded', '')
  const [mode, setMode] = useLocalStorage<Mode>('lab:url-codec:mode', 'component')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function encode() {
    try {
      setEncoded(mode === 'uri' ? encodeURI(raw) : encodeURIComponent(raw))
      setError('')
      setCopied(false)
    } catch {
      setError('編碼失敗')
    }
  }

  function decode() {
    try {
      const src = encoded || raw
      setRaw(mode === 'uri' ? decodeURI(src) : decodeURIComponent(src))
      setError('')
      setCopied(false)
    } catch {
      setError('解碼失敗：字串可能含無效 % 序列')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">模式</span>
          <button
            className={`btn sm ${mode === 'component' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('component')}
          >
            encodeURIComponent
          </button>
          <button
            className={`btn sm ${mode === 'uri' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('uri')}
          >
            encodeURI
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          {mode === 'component'
            ? '適合查詢參數與路徑片段：會編碼 / ? & = 等字元。'
            : '適合完整 URL：保留 : / ? # 等結構字元，只編碼非 ASCII 等。'}
        </p>
        <label className="stack">
          <span className="label">原始字串</span>
          <textarea className="field" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn accent" onClick={encode}>
            Encode
          </button>
          <button className="btn teal" onClick={decode}>
            Decode
          </button>
          <button
            className="btn ghost sm"
            onClick={async () => {
              await copyText(encoded || raw)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製結果'}
          </button>
          <button className="btn ghost sm" onClick={() => void copyText(raw)}>
            複製原文
          </button>
        </div>
        <label className="stack">
          <span className="label">編碼結果</span>
          <textarea
            className="field mono"
            rows={4}
            value={encoded}
            onChange={(e) => setEncoded(e.target.value)}
          />
        </label>
        {error && (
          <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
            {error}
          </p>
        )}
        <div className="metric stack">
          <span className="muted">即時對照</span>
          <code className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
            component: {(() => {
              try {
                return encodeURIComponent(raw)
              } catch {
                return '（失敗）'
              }
            })()}
          </code>
          <code className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
            uri: {(() => {
              try {
                return encodeURI(raw)
              } catch {
                return '（失敗）'
              }
            })()}
          </code>
        </div>
      </div>
    </ProjectShell>
  )
}
