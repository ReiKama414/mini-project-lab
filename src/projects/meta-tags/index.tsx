import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('meta-tags') ?? {
  slug: 'meta-tags',
  title: 'Meta Tags 產生器',
  description: '產生 HTML meta／OG 標籤。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:meta-tags:title', '我的網站')
  const [desc, setDesc] = useLocalStorage('lab:meta-tags:desc', '簡短說明')
  const [url, setUrl] = useLocalStorage('lab:meta-tags:url', 'https://example.com')
  const [image, setImage] = useLocalStorage('lab:meta-tags:image', 'https://example.com/og.png')
  const [copied, setCopied] = useState(false)

  const urlOk = !isNonEmpty(url) || isValidHttpUrl(url)
  const imgOk = !isNonEmpty(image) || isValidHttpUrl(image)
  const invalid = !isNonEmpty(title) || !urlOk || !imgOk

  const html = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    return [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(desc)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    ].join('\n')
  }, [title, desc, url, image])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          產生常用 meta／OG／Twitter 標籤草稿。實際 SEO 與社群預覽仍需依平台驗證。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">標題</span>
            <input
              className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`}
              value={title}
              maxLength={70}
              onChange={(e) => setTitle(limitText(e.target.value, 70))}
            />
            <div className="field-meta">
              <span>{charCount(title)} / 70</span>
            </div>
            {!isNonEmpty(title) && <p className="field-error">請輸入標題</p>}
          </label>
          <label className="stack">
            <span className="label">網址</span>
            <input
              className={`field${!urlOk ? ' is-invalid' : ''}`}
              value={url}
              maxLength={300}
              onChange={(e) => setUrl(limitText(e.target.value, 300))}
            />
            {!urlOk && <p className="field-error">網址格式無效</p>}
          </label>
        </div>
        <label className="stack">
          <span className="label">描述</span>
          <textarea className="field" rows={3} value={desc} maxLength={160} onChange={(e) => setDesc(limitText(e.target.value, 160))} />
          <div className="field-meta">
            <span>{charCount(desc)} / 160</span>
          </div>
        </label>
        <label className="stack">
          <span className="label">圖片</span>
          <input
            className={`field${!imgOk ? ' is-invalid' : ''}`}
            value={image}
            maxLength={300}
            onChange={(e) => setImage(limitText(e.target.value, 300))}
          />
          {!imgOk && <p className="field-error">圖片網址無效</p>}
        </label>
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={invalid}
            onClick={async () => {
              await copyText(html)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製 HTML'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={invalid}
            onClick={() => downloadText('meta.html', html, 'text/html')}
          >
            下載
          </button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
          {html}
        </pre>
      </div>
    </ProjectShell>
  )
}
