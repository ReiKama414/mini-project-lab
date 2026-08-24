import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('website-screenshot')!

type Device = 'desktop' | 'tablet' | 'mobile'

function hashHue(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

function normalizeUrl(raw: string) {
  const t = raw.trim()
  if (!t) return ''
  return t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`
}

export default function Page() {
  const [url, setUrl] = useLocalStorage('lab:website-screenshot:url', 'https://example.com')
  const [device, setDevice] = useLocalStorage<Device>('lab:website-screenshot:device', 'desktop')
  const [shot, setShot] = useState(true)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [loadingMeta, setLoadingMeta] = useState(false)

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

  async function fetchMeta() {
    if (!fullUrl || host === 'invalid') return
    setLoadingMeta(true)
    try {
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(fullUrl)}&t=${Date.now()}`
      const res = await fetch(proxy)
      if (!res.ok) throw new Error('proxy fail')
      const data = (await res.json()) as { contents?: string }
      const html = data.contents || ''
      const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim()
      const d =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]
      setTitle(t || host)
      setDesc(d || `無法解析 description · ${host}`)
    } catch {
      setTitle(host)
      setDesc('無法取得 meta（CORS／代理限制），改用佔位資訊')
    } finally {
      setLoadingMeta(false)
      setShot(true)
    }
  }

  function openUrl() {
    if (!fullUrl || host === 'invalid') return
    window.open(fullUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="field" style={{ flex: 1, minWidth: 200 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <button type="button" className="btn accent" onClick={() => void fetchMeta()} disabled={loadingMeta}>
            {loadingMeta ? '讀取 meta…' : '產生預覽卡'}
          </button>
          <button type="button" className="btn teal" onClick={openUrl}>
            開啟網址
          </button>
        </div>
        <div className="row">
          {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
            <button key={d} type="button" className={`btn sm ${device === d ? 'accent' : 'ghost'}`} onClick={() => setDevice(d)}>
              {d}
            </button>
          ))}
        </div>

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
              </div>
              <div
                style={{
                  height: h,
                  background: `linear-gradient(145deg, hsl(${hue} 55% 42%), hsl(${(hue + 48) % 360} 45% 28%))`,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  padding: 24,
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: device === 'mobile' ? 22 : 28, fontWeight: 700 }}>{title || host}</div>
                  <p style={{ color: '#ffffffcc', marginTop: 8 }}>{desc || '截圖佔位預覽'}</p>
                  <span className="tag" style={{ marginTop: 8, display: 'inline-block' }}>
                    {device} · {new Date().toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel stack">
              <div className="label">URL Meta Card</div>
              <strong>{title || host}</strong>
              <p className="muted" style={{ fontSize: 13 }}>
                {desc || '按「產生預覽卡」嘗試抓取 title / description'}
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
