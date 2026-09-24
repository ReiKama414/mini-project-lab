import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'og-preview',
  title: 'OG 預覽',
  description: '模擬社群分享卡片並產生 OG meta 標籤',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['design'],
}
const meta = getProject('og-preview') ?? fallback

const T = 70
const D = 160
const U = 300

const SAMPLES = [
  {
    label: '本站',
    title: 'Mini Project Lab',
    desc: '本機優先的實用小工具集合',
    url: 'https://mini-project-lab-wheat.vercel.app',
    image: 'https://picsum.photos/1200/630',
  },
  {
    label: '產品頁',
    title: '新品上市｜示範標題',
    desc: '一段適合社群分享的產品描述，約 80～120 字為佳。',
    url: 'https://example.com/product',
    image: 'https://picsum.photos/seed/og/1200/630',
  },
  {
    label: '文章',
    title: '如何寫好 Open Graph 標題',
    desc: '標題清楚、描述具體、圖片足夠大，分享預覽才好看。',
    url: 'https://example.com/blog/og-tips',
    image: 'https://picsum.photos/seed/blog/1200/630',
  },
]

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function metaContent(html: string, prop: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re1) || html.match(re2)
  return m?.[1] ? decodeEntities(m[1].trim()) : ''
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:og-preview:title', SAMPLES[0]!.title)
  const [desc, setDesc] = useLocalStorage('lab:og-preview:desc', SAMPLES[0]!.desc)
  const [url, setUrl] = useLocalStorage('lab:og-preview:url', SAMPLES[0]!.url)
  const [image, setImage] = useLocalStorage('lab:og-preview:image', SAMPLES[0]!.image)
  const [copied, setCopied] = useState<string | null>(null)
  const [fetchMsg, setFetchMsg] = useState('')
  const [fetching, setFetching] = useState(false)
  const [hint, setHint] = useState('')

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

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function fetchFromUrl() {
    const full = normalizeHttpUrl(url)
    if (!isValidHttpUrl(full)) {
      setFetchMsg('請先輸入有效網址')
      return
    }
    setFetching(true)
    setFetchMsg('抓取中…')
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(full)}&t=${Date.now()}`
      const res = await fetch(proxy)
      if (!res.ok) throw new Error('proxy fail')
      const data = (await res.json()) as { contents?: string }
      const html = data.contents || ''
      if (!html) throw new Error('empty')
      const ogTitle = metaContent(html, 'og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || ''
      const ogDesc = metaContent(html, 'og:description') || metaContent(html, 'description') || ''
      const ogImage = metaContent(html, 'og:image')
      if (ogTitle) setTitle(limitText(decodeEntities(ogTitle), T))
      if (ogDesc) setDesc(limitText(decodeEntities(ogDesc), D))
      if (ogImage) {
        const imgUrl = normalizeHttpUrl(ogImage)
        if (isValidHttpUrl(imgUrl)) setImage(limitText(imgUrl, U))
      }
      setFetchMsg(ogTitle || ogDesc || ogImage ? '已填入抓到的 OG 欄位' : '頁面無明顯 OG 標籤，欄位未變更')
    } catch {
      setFetchMsg('抓取失敗（CORS／代理限制），資料未變更')
    } finally {
      setFetching(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!tags} onClick={() => void copyVal(tags, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            onClick={() => downloadText('og-tags.html', tags, 'text/html')}
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
              {isNonEmpty(title) && <span className="tag">標題 {charCount(title)}</span>}
              {!urlOk && <span className="tag xc-tag-warn">網址無效</span>}
              {!imgOk && <span className="tag xc-tag-warn">圖片無效</span>}
              {fetching && <span className="tag">抓取中…</span>}
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
                    setTitle(s.title)
                    setDesc(s.desc)
                    setUrl(s.url)
                    setImage(s.image)
                    setHint(`已套用「${s.label}」`)
                    setFetchMsg('')
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <ActionButton
              className="btn sm teal"
              disabled={fetching || !urlOk || !isNonEmpty(url)}
              onClick={() => void fetchFromUrl()}
              icon="none"
            >
              {fetching ? '抓取中…' : '從網址抓取 OG'}
            </ActionButton>
          </div>
          {(fetchMsg || hint) && <p className="field-hint">{fetchMsg || hint}</p>}
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">欄位</h3>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              <label className="stack">
                <span className="label">標題</span>
                <input
                  className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`}
                  value={title}
                  maxLength={T}
                  onChange={(e) => {
                    setTitle(limitText(e.target.value, T))
                    setHint('')
                  }}
                />
                <div className="field-meta">
                  <span>
                    {charCount(title)} / {T}
                  </span>
                </div>
              </label>
              <label className="stack">
                <span className="label">描述</span>
                <textarea
                  className="field"
                  rows={3}
                  value={desc}
                  maxLength={D}
                  onChange={(e) => {
                    setDesc(limitText(e.target.value, D))
                    setHint('')
                  }}
                />
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
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">卡片預覽</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製標籤'}
                  onClick={() => void copyVal(tags, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('og-tags.html', tags, 'text/html')}
                />
              </div>
            </div>
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
                  {urlOk ? normalizeHttpUrl(url).replace(/^https?:\/\//, '') : 'example.com'}
                </div>
                <strong style={{ display: 'block', marginTop: 4 }}>{title || '標題'}</strong>
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                  {desc}
                </p>
              </div>
            </div>
            <pre className="xc-pre mono" style={{ marginTop: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
              {tags}
            </pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">預覽</span>
              <strong>視覺示意，非各社群平台真實渲染；實際外觀依平台裁切與快取而定</strong>
            </li>
            <li>
              <span className="muted">抓取</span>
              <strong>經第三方代理讀取網頁 HTML，可能受 CORS／配額限制</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>og:image 建議 ≥ 1200×630；標題約 60 字內、描述約 160 字內</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Meta Tags 產生器</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
