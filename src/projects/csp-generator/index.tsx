import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('csp-generator') ?? {
  slug: 'csp-generator',
  title: 'CSP 產生器',
  description: '組裝 Content-Security-Policy。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const FIELD_MAX = 200

export default function Page() {
  const [defaultSrc, setDefaultSrc] = useLocalStorage('lab:csp-generator:default', "'self'")
  const [scriptSrc, setScriptSrc] = useLocalStorage('lab:csp-generator:script', "'self'")
  const [styleSrc, setStyleSrc] = useLocalStorage('lab:csp-generator:style', "'self' 'unsafe-inline'")
  const [imgSrc, setImgSrc] = useLocalStorage('lab:csp-generator:img', "'self' data: https:")
  const [connectSrc, setConnectSrc] = useLocalStorage('lab:csp-generator:connect', "'self'")
  const [frameAncestors, setFrameAncestors] = useLocalStorage('lab:csp-generator:frame', "'none'")
  const [copied, setCopied] = useState(false)

  const header = useMemo(() => {
    return [
      `default-src ${defaultSrc}`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src ${imgSrc}`,
      `connect-src ${connectSrc}`,
      `frame-ancestors ${frameAncestors}`,
    ].join('; ')
  }, [defaultSrc, scriptSrc, styleSrc, imgSrc, connectSrc, frameAncestors])

  const full = `Content-Security-Policy: ${header}`
  const empty = ![defaultSrc, scriptSrc, styleSrc, imgSrc, connectSrc, frameAncestors].every(isNonEmpty)

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          組裝常見 CSP 指令草稿，非正式安全稽核。含 <code>unsafe-inline</code> 時請評估風險；上線前請用實際站點測試。
        </p>
        {(
          [
            ['default-src', defaultSrc, setDefaultSrc],
            ['script-src', scriptSrc, setScriptSrc],
            ['style-src', styleSrc, setStyleSrc],
            ['img-src', imgSrc, setImgSrc],
            ['connect-src', connectSrc, setConnectSrc],
            ['frame-ancestors', frameAncestors, setFrameAncestors],
          ] as const
        ).map(([label, val, set]) => (
          <label key={label} className="stack">
            <span className="label">{label}</span>
            <input
              className={`field mono${!isNonEmpty(val) ? ' is-invalid' : ''}`}
              value={val}
              maxLength={FIELD_MAX}
              onChange={(e) => set(limitText(e.target.value, FIELD_MAX))}
            />
          </label>
        ))}
        {empty && <p className="field-error">請填寫所有指令來源</p>}
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={empty}
            onClick={async () => {
              await copyText(header)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製 Header 值'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={empty}
            onClick={() => downloadText('csp-header.txt', full)}
          >
            下載
          </button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {full}
        </pre>
      </div>
    </ProjectShell>
  )
}
