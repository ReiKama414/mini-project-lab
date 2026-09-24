import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, isValidHttpUrl, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'sitemap-generator',
  title: 'Sitemap 產生器',
  description: '從網址清單產生簡易 sitemap.xml',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('sitemap-generator') ?? fallback

const MAX = 20_000
const URL_CAP = 500
const FILE_MAX = 2 * 1024 * 1024

const SAMPLES = [
  {
    label: '本站',
    body: 'https://mini-project-lab-wheat.vercel.app/\nhttps://mini-project-lab-wheat.vercel.app/p/todo-list\nhttps://mini-project-lab-wheat.vercel.app/p/pomodoro',
  },
  {
    label: '範例站',
    body: 'https://example.com/\nhttps://example.com/about\nhttps://example.com/blog',
  },
]

export default function Page() {
  const [urls, setUrls] = useLocalStorage('lab:sitemap-generator:urls', SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function copyVal(val: string, key: string) {
    if (!canExport) return
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
            disabled={!canExport}
            onClick={() => void copyVal(xml, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!canExport}
            onClick={() => downloadText('sitemap.xml', xml, 'application/xml')}
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
              <span className="tag">有效 {goodCount}</span>
              {!!bad.length && <span className="tag xc-tag-warn">無效 {bad.length}</span>}
              {truncated && <span className="tag xc-tag-warn">已截斷</span>}
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
                    setUrls(s.body)
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
              <h3 className="pw-panel-title">網址清單</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!urls} onClick={() => setUrls('')}>
                清除
              </ActionButton>
            </div>
            {!isNonEmpty(urls) && <p className="field-error">請輸入至少一個網址</p>}
            {!!bad.length && (
              <p className="field-error">
                無效網址：{bad.slice(0, 5).join(', ')}
                {bad.length > 5 ? ` 等 ${bad.length} 筆` : ''}
              </p>
            )}
            {truncated && <p className="field-error">超過 {URL_CAP} 筆，已截斷</p>}
            {hint && !bad.length && isNonEmpty(urls) && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept=".txt,.csv,text/plain,text/csv"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放網址清單"
              hint={`上限 ${formatBytes(FILE_MAX)} · 每行一個 URL`}
              onFiles={(files) => {
                void (async () => {
                  const f = files[0]
                  if (!f) return
                  setBusy(true)
                  try {
                    setUrls(limitText(await f.text(), MAX))
                    setHint(`已載入「${f.name}」`)
                  } catch {
                    setHint('')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            />
            <textarea
              className={`field mono xc-textarea${!isNonEmpty(urls) ? ' is-invalid' : ''}`}
              value={urls}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setUrls(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="網址清單"
            />
            <div className="field-meta">
              <span>僅 &lt;loc&gt; · 最多 {URL_CAP} 筆</span>
              <span>
                {charCount(urls).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">sitemap.xml</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!canExport}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(xml, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!canExport}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('sitemap.xml', xml, 'application/xml')}
                />
              </div>
            </div>
            {canExport ? (
              <pre className="xc-pre mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
                {xml}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                全部網址有效後才可匯出
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">格式</span>
              <strong>簡易 urlset（僅 &lt;loc&gt;），不含 lastmod／priority／changefreq</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>單次最多 {URL_CAP} 筆有效網址</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>robots.txt 產生器（可填 Sitemap: URL）</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
