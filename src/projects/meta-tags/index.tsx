import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'meta-tags',
  title: 'Meta Tags 產生器',
  description: '產生 title／description／OG／Twitter meta 草稿',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('meta-tags') ?? fallback

const SAMPLES = [
  {
    label: '本站',
    title: 'Mini Project Lab',
    desc: '本機優先的實用小工具集合',
    url: 'https://mini-project-lab-wheat.vercel.app',
    image: 'https://mini-project-lab-wheat.vercel.app/favicon.svg',
  },
  {
    label: '部落格',
    title: '技術筆記｜示範標題',
    desc: '一篇關於前端與本機工具的短文摘要。',
    url: 'https://example.com/blog/post',
    image: 'https://example.com/og.png',
  },
  {
    label: '落地頁',
    title: '產品名稱',
    desc: '一句話說明價值主張，方便搜尋與社群分享。',
    url: 'https://example.com/',
    image: 'https://example.com/cover.jpg',
  },
]

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:meta-tags:title', SAMPLES[0]!.title)
  const [desc, setDesc] = useLocalStorage('lab:meta-tags:desc', SAMPLES[0]!.desc)
  const [url, setUrl] = useLocalStorage('lab:meta-tags:url', SAMPLES[0]!.url)
  const [image, setImage] = useLocalStorage('lab:meta-tags:image', SAMPLES[0]!.image)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

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

  async function copyVal(val: string, key: string) {
    if (invalid) return
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
            disabled={invalid}
            onClick={() => void copyVal(html, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={invalid}
            onClick={() => downloadText('meta.html', html, 'text/html')}
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
              {invalid && <span className="tag xc-tag-warn">欄位待修正</span>}
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
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">欄位</h3>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
            <div className="stack" style={{ gap: 12 }}>
              <div className="grid-2">
                <label className="stack">
                  <span className="label">標題</span>
                  <input
                    className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`}
                    value={title}
                    maxLength={70}
                    onChange={(e) => {
                      setTitle(limitText(e.target.value, 70))
                      setHint('')
                    }}
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
                <textarea
                  className="field"
                  rows={3}
                  value={desc}
                  maxLength={160}
                  onChange={(e) => {
                    setDesc(limitText(e.target.value, 160))
                    setHint('')
                  }}
                />
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
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">HTML 輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={invalid}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(html, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={invalid}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('meta.html', html, 'text/html')}
                />
              </div>
            </div>
            <pre className="xc-pre mono" style={{ whiteSpace: 'pre-wrap' }}>
              {html}
            </pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">內容</span>
              <strong>含 title、description、og:* 與 twitter:card（summary_large_image）</strong>
            </li>
            <li>
              <span className="muted">用途</span>
              <strong>草稿起點；實際 SEO／社群預覽仍需依平台驗證與快取刷新</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>OG 預覽、Favicon 產生器、Web Manifest</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
