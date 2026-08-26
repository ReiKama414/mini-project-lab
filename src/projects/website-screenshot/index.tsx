import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('website-screenshot')!

const URL_MAX = 2048

type Device = 'desktop' | 'tablet' | 'mobile'
type HistoryItem = { url: string; title: string; at: number }

const DEVICE_LABEL: Record<Device, string> = {
  desktop: '桌面',
  tablet: '平板',
  mobile: '手機',
}

function hashHue(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

function normalizeUrl(raw: string) {
  return normalizeHttpUrl(raw)
}

export default function Page() {
  const [url, setUrl] = useLocalStorage('lab:website-screenshot:url', 'https://example.com')
  const [device, setDevice] = useLocalStorage<Device>('lab:website-screenshot:device', 'desktop')
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:website-screenshot:history', [])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [ogImage, setOgImage] = useState('')
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [shot, setShot] = useState(true)

  const fullUrl = useMemo(() => normalizeUrl(url), [url])
  const host = useMemo(() => {
    try {
      return new URL(fullUrl).hostname
    } catch {
      return 'invalid'
    }
  }, [fullUrl])
  const hue = hashHue(host)
  const w = device === 'desktop' ? '100%' : device === 'tablet' ? 480 : 320
  const h = device === 'mobile' ? 520 : device === 'tablet' ? 360 : 300

  function pushHistory(u: string, t: string) {
    const key = normalizeUrl(u)
    if (!key) return
    setHistory((xs) => [{ url: key, title: t || key, at: Date.now() }, ...xs.filter((x) => x.url !== key)].slice(0, 12))
  }

  async function fetchMeta() {
    if (!fullUrl || host === 'invalid') return
    setLoadingMeta(true)
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}&t=${Date.now()}`
      const res = await fetch(proxy)
      if (!res.ok) throw new Error('proxy fail')
      const data = (await res.json()) as { contents?: string }
      const html = data.contents || ''
      const t =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i)?.[1] ||
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
      const d =
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]
      const img =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i)?.[1] ||
        ''
      const finalTitle = t || host
      setTitle(finalTitle)
      setDesc(d || `無法解析 description · ${host}`)
      setOgImage(img)
      pushHistory(fullUrl, finalTitle)
    } catch {
      setTitle(host)
      setDesc('無法取得 meta（CORS／代理限制），改用佔位資訊')
      setOgImage('')
      pushHistory(fullUrl, host)
    } finally {
      setLoadingMeta(false)
      setShot(true)
    }
  }

  function openUrl() {
    if (!fullUrl || host === 'invalid') return
    pushHistory(fullUrl, title || host)
    window.open(fullUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        預覽卡／OG 佔位，非真實網頁截圖。僅嘗試讀取 Open Graph／title meta，畫面為示意版面。
      </p>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className={cn('field', (!isNonEmpty(url) || !isValidHttpUrl(fullUrl)) && 'is-invalid')}
            style={{ flex: 1, minWidth: 200 }}
            maxLength={URL_MAX}
            value={url}
            onChange={(e) => setUrl(limitText(e.target.value, URL_MAX))}
            onBlur={() => {
              const n = normalizeUrl(url)
              if (isValidHttpUrl(n)) setUrl(n)
            }}
            onKeyDown={(e) => e.key === 'Enter' && isValidHttpUrl(fullUrl) && void fetchMeta()}
            placeholder="example.com 或 https://"
          />
          <button
            type="button"
            className="btn accent"
            onClick={() => void fetchMeta()}
            disabled={loadingMeta || !isValidHttpUrl(fullUrl)}
          >
            {loadingMeta ? '讀取 meta…' : '產生 OG 預覽'}
          </button>
          <button type="button" className="btn teal" onClick={openUrl} disabled={!isValidHttpUrl(fullUrl)}>
            開啟網址
          </button>
        </div>
        <div className="field-meta">
          <span className={!isValidHttpUrl(fullUrl) ? 'warn' : undefined}>
            {isValidHttpUrl(fullUrl) ? 'URL 有效' : '請輸入有效的 http(s) 網址'}
          </span>
          <span>{charCount(url)}/{URL_MAX}</span>
        </div>
        {!isValidHttpUrl(fullUrl) && isNonEmpty(url) && <p className="field-error">網址格式無效</p>}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
            <button key={d} type="button" className={`btn sm ${device === d ? 'accent' : 'ghost'}`} onClick={() => setDevice(d)}>
              {DEVICE_LABEL[d]}
            </button>
          ))}
          <span className="muted mono" style={{ fontSize: 12 }}>
            正規化：{fullUrl || '—'}
          </span>
        </div>

        {history.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="label" style={{ margin: 0 }}>
                最近網址
              </div>
              <button type="button" className="btn sm ghost" onClick={() => setHistory([])}>
                清空
              </button>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {history.map((h) => (
                <button
                  key={h.url + h.at}
                  type="button"
                  className="btn sm ghost"
                  title={h.url}
                  onClick={() => {
                    setUrl(h.url)
                    setTitle(h.title)
                    setDesc('')
                    setOgImage('')
                    setShot(true)
                  }}
                >
                  {h.title.slice(0, 28)}
                  {h.title.length > 28 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {shot && (
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '1fr 280px' : '1fr', gap: 16 }}>
            <div
              style={{
                width: w,
                maxWidth: '100%',
                margin: device === 'desktop' ? 0 : '0 auto',
                border: '1px solid var(--line)',
                borderRadius: device === 'mobile' ? 28 : 14,
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                background: 'var(--bg-elevated)',
              }}
            >
              <div className="row" style={{ padding: '8px 12px', background: 'var(--bg-muted)' }}>
                <span className="tag">● ● ●</span>
                <span className="mono muted" style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>
                  {host}
                </span>
                <span className="tag">{DEVICE_LABEL[device]}</span>
              </div>
              <div
                style={{
                  height: h,
                  background: ogImage
                    ? `center/cover no-repeat url(${ogImage}), linear-gradient(145deg, hsl(${hue} 55% 42%), hsl(${(hue + 48) % 360} 45% 28%))`
                    : `linear-gradient(145deg, hsl(${hue} 55% 42%), hsl(${(hue + 48) % 360} 45% 28%))`,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                <div style={{ background: 'rgba(0,0,0,.35)', borderRadius: 12, padding: 16, maxWidth: '100%' }}>
                  <div style={{ fontSize: device === 'mobile' ? 20 : 26, fontWeight: 700 }}>{title || host}</div>
                  <p style={{ color: '#ffffffcc', marginTop: 8, fontSize: 13 }}>{desc || 'OG／裝置框佔位（非真實截圖）'}</p>
                  <span className="tag" style={{ marginTop: 8, display: 'inline-block' }}>
                    {device} · 佔位預覽 · {new Date().toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel stack">
              <div className="label">Open Graph 預覽卡（佔位）</div>
              {ogImage ? (
                <div
                  style={{
                    height: 100,
                    borderRadius: 10,
                    background: `center/cover no-repeat url(${ogImage})`,
                    border: '1px solid var(--line)',
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 72,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, hsl(${hue} 50% 55%), hsl(${(hue + 60) % 360} 40% 40%))`,
                  }}
                />
              )}
              <strong>{title || host}</strong>
              <p className="muted" style={{ fontSize: 13 }}>
                {desc || '按「產生 OG 預覽」嘗試抓取 og:title／description／image（非網頁截圖）'}
              </p>
              <a className="mono" href={fullUrl || '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--sky)', wordBreak: 'break-all' }}>
                {fullUrl || '—'}
              </a>
              <button type="button" className="btn ghost sm" onClick={openUrl}>
                在新分頁開啟
              </button>
            </div>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
