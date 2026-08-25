import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useState } from 'react'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('jwt-decoder') ?? {
  slug: 'jwt-decoder',
  title: 'JWT 解碼器',
  description: '解碼 JWT header／payload（不驗證簽章）。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 8000
const DEMO =
  'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIiwiaWF0IjoxNTE2MjM5MDIyfQ.sig_demo'

function b64urlToJson(part: string) {
  const pad = '='.repeat((4 - (part.length % 4)) % 4)
  const b64 = (part + pad).replace(/-/g, '+').replace(/_/g, '/')
  const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  return JSON.parse(json)
}

export default function Page() {
  const [token, setToken] = useState(DEMO)
  const [copied, setCopied] = useState<'h' | 'p' | 'all' | null>(null)

  useEffect(() => {
    try {
      localStorage.removeItem('lab:jwt-decoder:token')
    } catch {
      /* ignore */
    }
  }, [])

  const result = useMemo(() => {
    if (!isNonEmpty(token)) return { error: '請貼上 JWT' }
    const parts = token.trim().split('.')
    if (parts.length < 2) return { error: 'JWT 至少需要 header.payload' }
    try {
      const header = b64urlToJson(parts[0]!)
      const payload = b64urlToJson(parts[1]!)
      return { header, payload, sig: parts[2] || '（無）', error: '' }
    } catch {
      return { error: '無法解碼，請確認 Base64URL 格式' }
    }
  }, [token])

  const allJson =
    'header' in result && result.header
      ? JSON.stringify({ header: result.header, payload: result.payload, signature: result.sig }, null, 2)
      : ''

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          僅解碼顯示，不驗證簽章。Token 只留在記憶體，不寫入 localStorage、不上傳。請勿貼正式環境密鑰或含敏感資料的 token。
        </p>
        <label className="stack">
          <span className="label">JWT</span>
          <textarea
            className={`field mono${result.error && isNonEmpty(token) ? ' is-invalid' : ''}`}
            rows={4}
            value={token}
            maxLength={MAX}
            autoComplete="off"
            onChange={(e) => setToken(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(token)} / {MAX}
            </span>
          </div>
        </label>
        {result.error && <p className="field-error">{result.error}</p>}
        {'header' in result && result.header && (
          <div className="grid-2">
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Header</h3>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={async () => {
                    await copyText(JSON.stringify(result.header, null, 2))
                    setCopied('h')
                  }}
                >
                  {copied === 'h' ? '已複製' : '複製'}
                </button>
              </div>
              <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(result.header, null, 2)}
              </pre>
            </div>
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Payload</h3>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={async () => {
                    await copyText(JSON.stringify(result.payload, null, 2))
                    setCopied('p')
                  }}
                >
                  {copied === 'p' ? '已複製' : '複製'}
                </button>
              </div>
              <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(result.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
        {'sig' in result && result.sig && (
          <p className="muted mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
            Signature：{result.sig}
          </p>
        )}
        {allJson && (
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                await copyText(allJson)
                setCopied('all')
              }}
            >
              {copied === 'all' ? '已複製' : '複製全部 JSON'}
            </button>
            <button type="button" className="btn ghost" onClick={() => downloadText('jwt-decoded.json', allJson, 'application/json')}>
              下載 JSON
            </button>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
