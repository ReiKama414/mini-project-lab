import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'http-header-analyzer',
  title: 'HTTP Header 分析',
  description: '貼上回應標頭，檢查常見安全欄位',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['security', 'network'],
}
const meta = getProject('http-header-analyzer') ?? fallback

const MAX = 20_000
const CHECKS = [
  { name: 'content-security-policy', tip: '限制腳本／資源來源' },
  { name: 'strict-transport-security', tip: '強制 HTTPS' },
  { name: 'x-content-type-options', tip: '建議 nosniff' },
  { name: 'x-frame-options', tip: '或用 CSP frame-ancestors' },
  { name: 'referrer-policy', tip: '控制 Referer 外洩' },
  { name: 'permissions-policy', tip: '限制瀏覽器功能' },
]

const SAMPLES = [
  {
    label: '基本',
    body: 'HTTP/1.1 200 OK\nContent-Type: text/html\nX-Frame-Options: DENY\nX-Content-Type-Options: nosniff\n',
  },
  {
    label: '較完整',
    body: `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=()
`,
  },
  {
    label: '缺安全標頭',
    body: 'HTTP/1.1 200 OK\nContent-Type: text/html\nServer: nginx\nSet-Cookie: sid=abc\n',
  },
]

function parseHeaders(raw: string) {
  const map = new Map<string, string>()
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([^:\s]+):\s*(.*)$/.exec(line)
    if (m) map.set(m[1]!.toLowerCase(), m[2]!)
  }
  return CHECKS.map((c) => ({
    name: c.name,
    tip: c.tip,
    present: map.has(c.name),
    value: map.get(c.name) || '',
  }))
}

export default function Page() {
  const [raw, setRaw] = useLocalStorage('lab:http-header-analyzer:raw', SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const rows = useMemo(() => (isNonEmpty(raw) ? parseHeaders(raw) : []), [raw])
  const report = rows.map((r) => `${r.present ? '有' : '缺'}\t${r.name}\t${r.value}`).join('\n')
  const missing = rows.filter((r) => !r.present).length
  const present = rows.length - missing

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
            disabled={!rows.length}
            onClick={() => void copyVal(report, 'report')}
            icon="copy"
          >
            {copied === 'report' ? '已複製' : '複製結果'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!rows.length}
            onClick={() => downloadText('header-check.txt', report)}
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
              {rows.length > 0 && (
                <>
                  <span className="tag">
                    有 {present}／{rows.length}
                  </span>
                  {missing > 0 && <span className="tag xc-tag-warn">缺 {missing}</span>}
                </>
              )}
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
                    setRaw(s.body)
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
              <h3 className="pw-panel-title">原始標頭</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!raw} onClick={() => setRaw('')}>
                清除
              </ActionButton>
            </div>
            {!isNonEmpty(raw) && <p className="field-error">請貼上標頭</p>}
            {hint && isNonEmpty(raw) && <p className="field-hint">{hint}</p>}
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(raw) ? ' is-invalid' : ''}`}
              value={raw}
              maxLength={MAX}
              spellCheck={false}
              onChange={(e) => {
                setRaw(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="HTTP 標頭"
            />
            <div className="field-meta">
              <span>即時分析 · 不連線</span>
              <span>
                {charCount(raw).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">安全標頭檢查</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!rows.length}
                icon="copy"
                iconOnly
                tooltip={copied === 'report' ? '已複製' : '複製'}
                onClick={() => void copyVal(report, 'report')}
              />
            </div>
            {rows.length ? (
              <ul className="list" style={{ margin: 0 }}>
                {rows.map((r) => (
                  <li key={r.name} className="list-item stack">
                    <div className="row">
                      <span className={`tag${r.present ? '' : ' xc-tag-warn'}`}>{r.present ? '有' : '缺'}</span>
                      <code className="mono">{r.name}</code>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {r.tip}
                    </span>
                    {r.value && (
                      <span className="muted mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                        {r.value}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                貼上回應標頭後即時顯示結果
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">範圍</span>
              <strong>靜態檢查常見安全標頭是否存在，不連線、不驗證語意</strong>
            </li>
            <li>
              <span className="muted">取得標頭</span>
              <strong>可用開發者工具 Network、curl -I 等貼上</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>CSP Generator</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
