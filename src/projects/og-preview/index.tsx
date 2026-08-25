import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'

const meta: ProjectMeta = getProject('og-preview') ?? {
  slug: 'og-preview',
  title: 'OG 預覽',
  description: '預覽 Open Graph 分享卡片外觀。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

const T = 70
const D = 160
const U = 300

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:og-preview:title', 'Mini Project Lab')
  const [desc, setDesc] = useLocalStorage('lab:og-preview:desc', '本機優先的實用小工具集合')
  const [url, setUrl] = useLocalStorage('lab:og-preview:url', 'https://mini-project-lab-wheat.vercel.app')
  const [image, setImage] = useLocalStorage('lab:og-preview:image', 'https://picsum.photos/1200/630')
  const [copied, setCopied] = useState(false)
  const urlOk = !isNonEmpty(url) || isValidHttpUrl(url)
  const imgOk = !isNonEmpty(image) || isValidHttpUrl(image)

  const tags = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    return [
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:url" content="${esc(normalizeHttpUrl(url) || url)}" />`,
      `<meta property="og:image" content="${esc(normalizeHttpUrl(image) || image)}" />`,
    ].join('\n')
  }, [title, desc, url, image])

  return (
    <ProjectShell meta={meta}>
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        視覺示意預覽，非各社群平台真實渲染。實際外觀依平台裁切與快取而定。
      </p>
      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">標題</span>
            <input
              className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`}
              value={title}
              maxLength={T}
              onChange={(e) => setTitle(limitText(e.target.value, T))}
            />
            <div className="field-meta">
              <span>
                {charCount(title)} / {T}
              </span>
            </div>
            {!isNonEmpty(title) && <p className="field-error">請輸入標題</p>}
          </label>
          <label className="stack">
            <span className="label">描述</span>
            <textarea className="field" rows={3} value={desc} maxLength={D} onChange={(e) => setDesc(limitText(e.target.value, D))} />
            <div className="field-meta">
              <span>
                {charCount(desc)} / {D}
              </span>
            </div>
          </label>
          <label className="stack">
            <span className="label">網址</span>
            <input
              className={`field${!urlOk ? ' is-invalid' : ''}`}
              value={url}
              maxLength={U}
              onChange={(e) => setUrl(limitText(e.target.value, U))}
            />
            {!urlOk && <p className="field-error">網址格式無效</p>}
          </label>
          <label className="stack">
            <span className="label">圖片 URL</span>
            <input
              className={`field${!imgOk ? ' is-invalid' : ''}`}
              value={image}
              maxLength={U}
              onChange={(e) => setImage(limitText(e.target.value, U))}
            />
            {!imgOk && <p className="field-error">圖片網址無效</p>}
          </label>
          <div className="row">
            <button
              type="button"
              className="btn accent"
              onClick={async () => {
                await copyText(tags)
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '複製 OG 標籤'}
            </button>
            <button type="button" className="btn ghost" onClick={() => downloadText('og-tags.html', tags, 'text/html')}>
              下載
            </button>
          </div>
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>卡片預覽</h3>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {isNonEmpty(image) && imgOk && (
              <img
                src={normalizeHttpUrl(image)}
                alt=""
                style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
              />
            )}
            <div style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {urlOk ? normalizeHttpUrl(url).replace(/^https?:\/\//, '') : 'mini-project-lab-wheat.vercel.app'}
              </div>
              <strong style={{ display: 'block', marginTop: 4 }}>{title || '標題'}</strong>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                {desc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
