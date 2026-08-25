import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('robots-generator') ?? {
  slug: 'robots-generator',
  title: 'robots.txt 產生器',
  description: '產生 robots.txt 規則。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [allowAll, setAllowAll] = useLocalStorage('lab:robots-generator:allow', true)
  const [disallow, setDisallow] = useLocalStorage('lab:robots-generator:disallow', '/admin\n/private')
  const [sitemap, setSitemap] = useLocalStorage('lab:robots-generator:sitemap', 'https://mini-project-lab-wheat.vercel.app/sitemap.xml')
  const [copied, setCopied] = useState(false)

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

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          產生簡易 robots.txt。實際爬蟲行為因引擎而異；此工具不涵蓋多 User-agent 區塊。
        </p>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={allowAll} onChange={(e) => setAllowAll(e.target.checked)} />
          預設允許全部（無 Disallow 時）
        </label>
        <label className="stack">
          <span className="label">Disallow 路徑（每行一個）</span>
          <textarea
            className="field mono"
            rows={5}
            value={disallow}
            maxLength={2000}
            onChange={(e) => setDisallow(limitText(e.target.value, 2000))}
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
        <div className="row">
          <button
            type="button"
            className="btn accent"
            onClick={async () => {
              await copyText(text)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadText('robots.txt', text)}>
            下載
          </button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </pre>
      </div>
    </ProjectShell>
  )
}
