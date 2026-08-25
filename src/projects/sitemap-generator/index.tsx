import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('sitemap-generator') ?? {
  slug: 'sitemap-generator',
  title: 'Sitemap 產生器',
  description: '從網址清單產生 sitemap.xml。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

const MAX = 20_000
const URL_CAP = 500

export default function Page() {
  const [urls, setUrls] = useLocalStorage(
    'lab:sitemap-generator:urls',
    'https://mini-project-lab-wheat.vercel.app/\nhttps://mini-project-lab-wheat.vercel.app/p/todo-list\nhttps://mini-project-lab-wheat.vercel.app/p/pomodoro',
  )
  const [copied, setCopied] = useState(false)

  const { xml, bad, goodCount, truncated } = useMemo(() => {
    const list = urls
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const truncated = list.length > URL_CAP
    const capped = list.slice(0, URL_CAP)
    const bad = capped.filter((u) => !isValidHttpUrl(u))
    const good = capped.filter((u) => isValidHttpUrl(u))
    const body = good.map((u) => `  <url>\n    <loc>${u.replace(/&/g, '&amp;')}</loc>\n  </url>`).join('\n')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
    return { xml, bad, goodCount: good.length, truncated }
  }, [urls])

  const canExport = goodCount > 0 && !bad.length

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          產生簡易 urlset（僅 &lt;loc&gt;）。不含 lastmod／priority；單次最多 {URL_CAP} 筆有效網址。
        </p>
        <label className="stack">
          <span className="label">網址（每行一個）</span>
          <textarea
            className={`field mono${!isNonEmpty(urls) ? ' is-invalid' : ''}`}
            rows={8}
            value={urls}
            maxLength={MAX}
            onChange={(e) => setUrls(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(urls).toLocaleString()} / {MAX.toLocaleString()} · 有效 {goodCount}
            </span>
          </div>
        </label>
        {!isNonEmpty(urls) && <p className="field-error">請輸入至少一個網址</p>}
        {!!bad.length && <p className="field-error">無效網址：{bad.slice(0, 5).join(', ')}{bad.length > 5 ? ` 等 ${bad.length} 筆` : ''}</p>}
        {truncated && <p className="field-error">超過 {URL_CAP} 筆，已截斷</p>}
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={!canExport}
            onClick={async () => {
              await copyText(xml)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製 XML'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!canExport}
            onClick={() => downloadText('sitemap.xml', xml, 'application/xml')}
          >
            下載
          </button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
          {xml}
        </pre>
      </div>
    </ProjectShell>
  )
}
