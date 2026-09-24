import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'robots-generator',
  title: 'robots.txt 產生器',
  description: '產生簡易 robots.txt（Allow／Disallow／Sitemap）',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('robots-generator') ?? fallback

const SAMPLES = [
  {
    label: '全開',
    allowAll: true,
    disallow: '',
    sitemap: 'https://example.com/sitemap.xml',
  },
  {
    label: '擋後台',
    allowAll: false,
    disallow: '/admin\n/private\n/api/',
    sitemap: 'https://example.com/sitemap.xml',
  },
  {
    label: '本站',
    allowAll: true,
    disallow: '/admin\n/private',
    sitemap: 'https://mini-project-lab-wheat.vercel.app/sitemap.xml',
  },
]

export default function Page() {
  const [allowAll, setAllowAll] = useLocalStorage('lab:robots-generator:allow', true)
  const [disallow, setDisallow] = useLocalStorage('lab:robots-generator:disallow', '/admin\n/private')
  const [sitemap, setSitemap] = useLocalStorage(
    'lab:robots-generator:sitemap',
    'https://mini-project-lab-wheat.vercel.app/sitemap.xml',
  )
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const sitemapOk = !isNonEmpty(sitemap) || isValidHttpUrl(sitemap)

  const text = useMemo(() => {
    const lines = ['User-agent: *']
    if (allowAll && !isNonEmpty(disallow)) lines.push('Allow: /')
    else {
      disallow
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((p) => lines.push(`Disallow: ${p}`))
      if (!lines.some((l) => l.startsWith('Disallow'))) lines.push('Allow: /')
    }
    if (isNonEmpty(sitemap) && sitemapOk) lines.push('', `Sitemap: ${sitemap.trim()}`)
    return lines.join('\n')
  }, [allowAll, disallow, sitemap, sitemapOk])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(text, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton className="btn sm accent" onClick={() => downloadText('robots.txt', text)} icon="download">
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
              <span className="tag">{allowAll ? '預設允許' : '自訂 Disallow'}</span>
              {!sitemapOk && <span className="tag xc-tag-warn">Sitemap 無效</span>}
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
                    setAllowAll(s.allowAll)
                    setDisallow(s.disallow)
                    setSitemap(s.sitemap)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={allowAll} onChange={(e) => setAllowAll(e.target.checked)} />
              預設允許全部（無 Disallow 時）
            </label>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">規則</h3>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
            <label className="stack" style={{ marginBottom: 12 }}>
              <span className="label">Disallow 路徑（每行一個）</span>
              <textarea
                className="field mono xc-textarea"
                value={disallow}
                maxLength={2000}
                spellCheck={false}
                onChange={(e) => {
                  setDisallow(limitText(e.target.value, 2000))
                  setHint('')
                }}
                aria-label="Disallow 路徑"
              />
            </label>
            <label className="stack">
              <span className="label">Sitemap URL</span>
              <input
                className={`field${!sitemapOk ? ' is-invalid' : ''}`}
                value={sitemap}
                maxLength={300}
                onChange={(e) => setSitemap(limitText(e.target.value, 300))}
              />
              {!sitemapOk && <p className="field-error">Sitemap 網址無效</p>}
            </label>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">robots.txt</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(text, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('robots.txt', text)}
                />
              </div>
            </div>
            <pre className="xc-pre mono" style={{ whiteSpace: 'pre-wrap' }}>
              {text}
            </pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">範圍</span>
              <strong>簡易 User-agent: * 區塊；不含多爬蟲專屬規則</strong>
            </li>
            <li>
              <span className="muted">行為</span>
              <strong>實際爬蟲遵循程度因引擎而異；敏感路徑仍應搭配權限控管</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Sitemap 產生器、Web Manifest</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
