import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('ip-lookup')!

type IpInfo = {
  ip: string
  city?: string
  region?: string
  country_name?: string
  country_code?: string
  org?: string
  asn?: string
  timezone?: string
  latitude?: number
  longitude?: number
  postal?: string
  source?: string
}

const MOCK: IpInfo = {
  ip: '203.0.113.42',
  city: '台北',
  region: '台北市',
  country_name: '台灣',
  country_code: 'TW',
  org: 'AS3462 Data Communication Business Group',
  asn: 'AS3462',
  timezone: 'Asia/Taipei',
  latitude: 25.0375,
  longitude: 121.5637,
  postal: '100',
  source: '示範資料（離線）',
}

async function fetchPublicIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    if (!res.ok) return null
    const data = (await res.json()) as { ip: string }
    return data.ip
  } catch {
    return null
  }
}

async function fetchGeo(ip?: string): Promise<IpInfo> {
  const path = ip?.trim() ? `/${encodeURIComponent(ip.trim())}` : ''
  const res = await fetch(`https://ipapi.co${path}/json/`)
  if (!res.ok) throw new Error(`查詢失敗 ${res.status}`)
  const data = (await res.json()) as IpInfo & { error?: boolean; reason?: string }
  if (data.error) throw new Error(data.reason || '查詢失敗')
  return { ...data, source: 'ipapi.co' }
}

/** 透過 WebRTC 嘗試取得本機區域網路候選 IP（瀏覽器支援度不一） */
function probeLocalIps(timeoutMs = 2500): Promise<string[]> {
  return new Promise((resolve) => {
    const found = new Set<string>()
    let pc: RTCPeerConnection | null = null
    const finish = () => {
      try {
        pc?.close()
      } catch {
        /* ignore */
      }
      resolve([...found])
    }
    const timer = window.setTimeout(finish, timeoutMs)

    try {
      pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('lab')
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        const m = ev.candidate.candidate.match(
          /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9:]+)/i,
        )
        if (m?.[1] && !m[1].endsWith('.local')) found.add(m[1])
      }
      pc.createOffer()
        .then((offer) => pc!.setLocalDescription(offer))
        .catch(() => {
          window.clearTimeout(timer)
          finish()
        })
    } catch {
      window.clearTimeout(timer)
      finish()
    }
  })
}

export default function Page() {
  const [query, setQuery] = useLocalStorage('lab:ip-lookup:query', '')
  const [info, setInfo] = useState<IpInfo | null>(null)
  const [localIps, setLocalIps] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [probing, setProbing] = useState(false)
  const [error, setError] = useState('')
  const [usedMock, setUsedMock] = useState(false)

  async function lookup(ip?: string) {
    setLoading(true)
    setError('')
    setUsedMock(false)
    try {
      let target = ip?.trim() || ''
      if (!target) {
        const publicIp = await fetchPublicIp()
        if (publicIp) {
          target = publicIp
          setQuery(publicIp)
        }
      }
      const data = await fetchGeo(target || undefined)
      setInfo(data)
      if (!ip && data.ip) setQuery(data.ip)
    } catch (e) {
      setInfo(MOCK)
      setUsedMock(true)
      setError(
        (e instanceof Error ? e.message : '無法取得 IP 資訊') + ' · 已改用示範資料',
      )
      if (!ip) setQuery(MOCK.ip)
    } finally {
      setLoading(false)
    }
  }

  async function probeLan() {
    setProbing(true)
    const ips = await probeLocalIps()
    setLocalIps(ips)
    setProbing(false)
  }

  useEffect(() => {
    lookup()
  }, [])

  const rows: { label: string; value: string }[] = info
    ? [
        { label: 'IP', value: info.ip },
        {
          label: '地點',
          value: [info.city, info.region, info.country_name].filter(Boolean).join(', ') || '—',
        },
        { label: '國家代碼', value: info.country_code || '—' },
        { label: '組織', value: info.org || '—' },
        { label: 'ASN', value: info.asn || '—' },
        { label: '時區', value: info.timezone || '—' },
        { label: '郵遞區號', value: info.postal || '—' },
        {
          label: '座標',
          value:
            info.latitude != null && info.longitude != null
              ? `${info.latitude}, ${info.longitude}`
              : '—',
        },
        { label: '來源', value: info.source || '—' },
      ]
    : []

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted">
          公開 IP 透過 ipify，地理位置透過 ipapi.co；失敗時改用示範資料。區域網路 IP 為選用
          WebRTC 探測。
        </p>
        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="輸入 IP，空白則查本機公開 IP"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup(query)}
          />
          <button className="btn accent" disabled={loading} onClick={() => lookup(query)}>
            {loading ? '查詢中…' : '查詢'}
          </button>
          <button className="btn ghost" disabled={loading} onClick={() => lookup()}>
            本機公開 IP
          </button>
          <button className="btn teal" disabled={probing} onClick={probeLan}>
            {probing ? '探測中…' : '本機網路'}
          </button>
        </div>

        {error && <p className="muted">{error}</p>}
        {usedMock && <span className="tag">示範模式</span>}

        {info && (
          <div className="grid-2">
            {rows.map((r) => (
              <div key={r.label} className="metric">
                <div className="muted">{r.label}</div>
                <div className="row">
                  <span className={r.label === 'IP' || r.label === '座標' ? 'mono' : undefined}>
                    {r.value}
                  </span>
                  {r.value !== '—' && (
                    <button className="btn sm ghost" onClick={() => copyText(r.value)}>
                      複製
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {localIps.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">本機候選 IP（WebRTC）</span>
            <ul className="list">
              {localIps.map((ip) => (
                <li key={ip} className="list-item">
                  <span className="mono">{ip}</span>
                  <button className="btn sm ghost" onClick={() => copyText(ip)}>
                    複製
                  </button>
                  <button className="btn sm teal" onClick={() => { setQuery(ip); lookup(ip) }}>
                    查詢
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!probing && localIps.length === 0 && (
          <p className="muted">尚未探測本機網路；部分瀏覽器可能無法取得區域 IP。</p>
        )}
      </div>
    </ProjectShell>
  )
}
