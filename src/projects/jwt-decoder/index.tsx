import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'jwt-decoder',
  title: 'JWT 解碼器',
  description: '解碼 JWT Header／Payload（不驗證簽章）',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev', 'security'],
}
const meta = getProject('jwt-decoder') ?? fallback

const MAX = 8000

const SAMPLES = [
  {
    label: '無簽章示範',
    body: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIiwiaWF0IjoxNTE2MjM5MDIyfQ.sig_demo',
  },
  {
    label: '含 exp',
    body: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsIm5hbWUiOiJCb2IiLCJleHAiOjE3MDAwMDAwMDB9.sig',
  },
  {
    label: '角色陣列',
    body: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGVzIjpbImFkbWluIiwicmVhZCJdLCJpYXQiOjE1MTYyMzkwMjJ9.sig',
  },
]

function b64urlToJson(part: string) {
  const pad = '='.repeat((4 - (part.length % 4)) % 4)
  const b64 = (part + pad).replace(/-/g, '+').replace(/_/g, '/')
  const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  return JSON.parse(json)
}

function claimHint(payload: Record<string, unknown>): string[] {
  const hints: string[] = []
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number') {
    hints.push(payload.exp < now ? `exp 已過期（${payload.exp}）` : `exp 尚未過期（${payload.exp}）`)
  }
  if (typeof payload.iat === 'number') hints.push(`iat：${payload.iat}`)
  if (typeof payload.nbf === 'number') {
    hints.push(payload.nbf > now ? `nbf 尚未生效（${payload.nbf}）` : `nbf 已生效（${payload.nbf}）`)
  }
  return hints
}

export default function Page() {
  const [token, setToken] = useState(SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    try {
      localStorage.removeItem('lab:jwt-decoder:token')
    } catch {
      /* ignore */
    }
  }, [])

  const result = useMemo(() => {
    if (!isNonEmpty(token)) return { error: '請貼上 JWT', header: null, payload: null, sig: '', alg: '', hints: [] as string[] }
    const parts = token.trim().split('.')
    if (parts.length < 2) return { error: 'JWT 至少需要 header.payload', header: null, payload: null, sig: '', alg: '', hints: [] as string[] }
    try {
      const header = b64urlToJson(parts[0]!) as Record<string, unknown>
      const payload = b64urlToJson(parts[1]!) as Record<string, unknown>
      const alg = typeof header.alg === 'string' ? header.alg : ''
      return {
        header,
        payload,
        sig: parts[2] || '（無）',
        error: '',
        alg,
        hints: claimHint(payload),
      }
    } catch {
      return { error: '無法解碼，請確認 Base64URL 格式', header: null, payload: null, sig: '', alg: '', hints: [] as string[] }
    }
  }, [token])

  const headerJson = result.header ? JSON.stringify(result.header, null, 2) : ''
  const payloadJson = result.payload ? JSON.stringify(result.payload, null, 2) : ''
  const allJson =
    result.header && result.payload
      ? JSON.stringify({ header: result.header, payload: result.payload, signature: result.sig }, null, 2)
      : ''

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
            disabled={!allJson}
            onClick={() => void copyVal(allJson, 'all')}
            icon="copy"
          >
            {copied === 'all' ? '已複製' : '複製 JSON'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!allJson}
            onClick={() => downloadText('jwt-decoded.json', allJson, 'application/json')}
            icon="download"
          >
            下載 JSON
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {result.alg && <span className="tag">{result.alg}</span>}
              {result.header && <span className="tag">{token.trim().split('.').length} 段</span>}
              {result.error && isNonEmpty(token) && <span className="tag xc-tag-warn">無效</span>}
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
                    setToken(s.body)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">JWT 輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!token} onClick={() => setToken('')}>
                清除
              </ActionButton>
            </div>
            {result.error && isNonEmpty(token) && <p className="field-error">{result.error}</p>}
            {hint && !result.error && <p className="field-hint">{hint}</p>}
            {!isNonEmpty(token) && <p className="field-error">請貼上 JWT</p>}
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(token) || result.error ? ' is-invalid' : ''}`}
              value={token}
              maxLength={MAX}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setToken(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="JWT"
            />
            <div className="field-meta">
              <span>僅解碼，不驗證簽章</span>
              <span>
                {charCount(token)} / {MAX}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">解碼結果</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!allJson}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'all' ? '已複製' : '複製全部'}
                  onClick={() => void copyVal(allJson, 'all')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!allJson}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('jwt-decoded.json', allJson, 'application/json')}
                />
              </div>
            </div>
            {result.header && result.payload ? (
              <div className="stack" style={{ gap: 12 }}>
                {result.hints.length > 0 && (
                  <div className="pw-chips">
                    {result.hints.map((h) => (
                      <span key={h} className="tag">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong>Header</strong>
                    <ActionButton
                      className="btn sm ghost"
                      icon="copy"
                      iconOnly
                      tooltip={copied === 'h' ? '已複製' : '複製 Header'}
                      onClick={() => void copyVal(headerJson, 'h')}
                    />
                  </div>
                  <pre className="xc-pre mono">{headerJson}</pre>
                </div>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong>Payload</strong>
                    <ActionButton
                      className="btn sm ghost"
                      icon="copy"
                      iconOnly
                      tooltip={copied === 'p' ? '已複製' : '複製 Payload'}
                      onClick={() => void copyVal(payloadJson, 'p')}
                    />
                  </div>
                  <pre className="xc-pre mono">{payloadJson}</pre>
                </div>
                <p className="muted mono" style={{ margin: 0, fontSize: 12, wordBreak: 'break-all' }}>
                  Signature：{result.sig}
                </p>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                有效 JWT 會顯示 Header／Payload
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">用途</span>
              <strong>檢視 JWT 內容；不驗證簽章，不可當作授權依據</strong>
            </li>
            <li>
              <span className="muted">格式</span>
              <strong>header.payload[.signature]，各段為 Base64URL</strong>
            </li>
            <li>
              <span className="muted">時間宣告</span>
              <strong>若有 exp／iat／nbf，會顯示相對目前時間的粗估提示</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>Token 只留在記憶體，不寫入 localStorage、不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>JWT Generator、Base64／URL 工具</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
