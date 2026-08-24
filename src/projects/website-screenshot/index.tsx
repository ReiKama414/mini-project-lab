import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('website-screenshot')!

function hashHue(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

export default function Page() {
  const [url, setUrl] = useLocalStorage('lab:website-screenshot:url', 'https://example.com')
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [shot, setShot] = useState(false)

  const host = useMemo(() => {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    } catch {
      return 'invalid'
    }
  }, [url])
  const hue = hashHue(host)
  const w = device === 'desktop' ? '100%' : device === 'tablet' ? 480 : 320

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <button type="button" className="btn accent" onClick={() => setShot(true)}>
            產生預覽卡
          </button>
        </div>
        <div className="row">
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button key={d} type="button" className={`btn sm ${device === d ? 'accent' : 'ghost'}`} onClick={() => setDevice(d)}>
              {d}
            </button>
          ))}
        </div>
        {shot && (
          <div style={{ width: w, maxWidth: '100%', margin: '0 auto', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden' }}>
            <div className="row" style={{ padding: '8px 12px', background: '#1e293b' }}>
              <span className="tag">● ● ●</span>
              <span className="mono muted" style={{ flex: 1, textAlign: 'center' }}>
                {host}
              </span>
            </div>
            <div
              style={{
                height: device === 'mobile' ? 420 : 280,
                background: `linear-gradient(145deg, hsl(${hue} 60% 35%), hsl(${(hue + 40) % 360} 50% 20%))`,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{host}</div>
                <p className="muted" style={{ color: '#ffffffaa' }}>
                  截圖佔位預覽 · {device} · {new Date().toLocaleString('zh-TW')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
