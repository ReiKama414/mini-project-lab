import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'csp-generator',
  title: 'CSP 產生器',
  description: '組裝 Content-Security-Policy 標頭草稿',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('csp-generator') ?? fallback

const FIELD_MAX = 200

type CspState = {
  defaultSrc: string
  scriptSrc: string
  styleSrc: string
  imgSrc: string
  connectSrc: string
  frameAncestors: string
}

const PRESETS: { label: string; values: CspState }[] = [
  {
    label: '嚴格 self',
    values: {
      defaultSrc: "'self'",
      scriptSrc: "'self'",
      styleSrc: "'self'",
      imgSrc: "'self'",
      connectSrc: "'self'",
      frameAncestors: "'none'",
    },
  },
  {
    label: '常見站點',
    values: {
      defaultSrc: "'self'",
      scriptSrc: "'self'",
      styleSrc: "'self' 'unsafe-inline'",
      imgSrc: "'self' data: https:",
      connectSrc: "'self'",
      frameAncestors: "'none'",
    },
  },
  {
    label: 'CDN 腳本',
    values: {
      defaultSrc: "'self'",
      scriptSrc: "'self' https://cdn.example.com",
      styleSrc: "'self' 'unsafe-inline'",
      imgSrc: "'self' data: https:",
      connectSrc: "'self' https://api.example.com",
      frameAncestors: "'none'",
    },
  },
]

export default function Page() {
  const [defaultSrc, setDefaultSrc] = useLocalStorage('lab:csp-generator:default', "'self'")
  const [scriptSrc, setScriptSrc] = useLocalStorage('lab:csp-generator:script', "'self'")
  const [styleSrc, setStyleSrc] = useLocalStorage('lab:csp-generator:style', "'self' 'unsafe-inline'")
  const [imgSrc, setImgSrc] = useLocalStorage('lab:csp-generator:img', "'self' data: https:")
  const [connectSrc, setConnectSrc] = useLocalStorage('lab:csp-generator:connect', "'self'")
  const [frameAncestors, setFrameAncestors] = useLocalStorage('lab:csp-generator:frame', "'none'")
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

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
  const hasUnsafe = /unsafe-inline|unsafe-eval/.test(header)

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setDefaultSrc(p.values.defaultSrc)
    setScriptSrc(p.values.scriptSrc)
    setStyleSrc(p.values.styleSrc)
    setImgSrc(p.values.imgSrc)
    setConnectSrc(p.values.connectSrc)
    setFrameAncestors(p.values.frameAncestors)
    setHint(`已套用「${p.label}」`)
  }

  const fields = [
    ['default-src', defaultSrc, setDefaultSrc],
    ['script-src', scriptSrc, setScriptSrc],
    ['style-src', styleSrc, setStyleSrc],
    ['img-src', imgSrc, setImgSrc],
    ['connect-src', connectSrc, setConnectSrc],
    ['frame-ancestors', frameAncestors, setFrameAncestors],
  ] as const

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={empty}
            onClick={() => void copyVal(header, 'val')}
            icon="copy"
          >
            {copied === 'val' ? '已複製' : '複製值'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={empty}
            onClick={() => downloadText('csp-header.txt', full)}
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
              <span className="tag">6 指令</span>
              {hasUnsafe && <span className="tag xc-tag-warn">含 unsafe</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">指令來源</h3>
            </div>
            {empty && <p className="field-error">請填寫所有指令來源</p>}
            {hint && !empty && <p className="field-hint">{hint}</p>}
            <div className="stack" style={{ gap: 10 }}>
              {fields.map(([label, val, set]) => (
                <label key={label} className="stack">
                  <span className="label">{label}</span>
                  <input
                    className={`field mono${!isNonEmpty(val) ? ' is-invalid' : ''}`}
                    value={val}
                    maxLength={FIELD_MAX}
                    spellCheck={false}
                    onChange={(e) => {
                      set(limitText(e.target.value, FIELD_MAX))
                      setHint('')
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">Header 輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={empty}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'full' ? '已複製' : '複製完整標頭'}
                  onClick={() => void copyVal(full, 'full')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={empty}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('csp-header.txt', full)}
                />
              </div>
            </div>
            <pre className="xc-pre mono" style={{ wordBreak: 'break-all' }}>
              {full}
            </pre>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <ActionButton
                className="btn sm ghost"
                disabled={empty}
                onClick={() => void copyVal(header, 'val')}
                icon="copy"
              >
                {copied === 'val' ? '已複製' : '僅複製值'}
              </ActionButton>
            </div>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">用途</span>
              <strong>組裝 CSP 草稿；非正式安全稽核，上線前請用實際站點測試</strong>
            </li>
            <li>
              <span className="muted">風險</span>
              <strong>含 unsafe-inline／unsafe-eval 時請評估 XSS 風險</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>HTTP Header Analyzer、Privacy Checker</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
