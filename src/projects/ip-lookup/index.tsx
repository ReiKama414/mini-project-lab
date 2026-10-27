import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, limitText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { FtMetric, FtMetricGrid, FtToolHero, FtToolRoot, FtToolSearch } from '../../components/FeatureToolUI'

const meta = getProject('ip-lookup')!

const QUERY_MAX = 45

const SAMPLE_IPS = [
  { label: 'Google DNS', ip: '8.8.8.8' },
  { label: 'Cloudflare', ip: '1.1.1.1' },
  { label: '本機公開', ip: '' },
]

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
  currency?: string
  country_calling_code?: string
  languages?: string
  utc_offset?: string
  network?: string
  version?: string
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
  currency: 'TWD',
  country_calling_code: '+886',
  languages: 'zh-TW,zh',
  utc_offset: '+0800',
  network: '203.0.113.0/24',
  version: 'IPv4',
  source: '示範資料（離線）',
}

function flagEmoji(code?: string) {
  if (!code || code.length !== 2) return '🌐'
  const u = code.toUpperCase()
  return String.fromCodePoint(...[...u].map((c) => 127397 + c.charCodeAt(0)))
}

function mapUrl(lat?: number, lon?: number) {
  if (lat == null || lon == null) return null
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`
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
  const [copied, setCopied] = useState<string | null>(null)

  async function lookup(ip?: string) {
    setLoading(true)
    setError('')
    setUsedMock(false)
    try {
      let target = ip?.trim() || query.trim()
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
      setError((e instanceof Error ? e.message : '無法取得 IP 資訊') + ' · 已改用示範資料')
      if (!ip) setQuery(MOCK.ip)
    } finally {
      setLoading(false)
    }
  }

  async function probeLan() {
    setProbing(true)
    setLocalIps(await probeLocalIps())
    setProbing(false)
  }

  useEffect(() => {
    void lookup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locationLine = useMemo(() => {
    if (!info) return '—'
    return [info.city, info.region, info.country_name].filter(Boolean).join(' · ') || '—'
  }, [info])

  const mapLink = info ? mapUrl(info.latitude, info.longitude) : null

  const metrics = useMemo(() => {
    if (!info) return []
    return [
      { k: '國家代碼', v: info.country_code || '—' },
      { k: '時區', v: info.timezone || '—' },
      { k: 'UTC 偏移', v: info.utc_offset || '—' },
      { k: '郵遞區號', v: info.postal || '—' },
      { k: '貨幣', v: info.currency || '—' },
      { k: '電話區碼', v: info.country_calling_code || '—' },
      { k: '語言', v: info.languages || '—' },
      { k: 'ASN', v: info.asn || '—' },
      { k: '網段', v: info.network || '—' },
      { k: 'IP 版本', v: info.version || '—' },
      { k: '資料來源', v: info.source || '—' },
    ]
  }, [info])

  async function copyVal(text: string, key: string) {
    await copyText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const summary = info
    ? [
        info.ip,
        locationLine,
        info.org || '',
        info.timezone || '',
        mapLink || '',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <FeatureLayout
      meta={meta}
      actions={
        <div className="row ipl-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!info}
            onClick={() => info && void copyVal(info.ip, 'ip')}
            icon="copy"
          >
            {copied === 'ip' ? '已複製' : '複製 IP'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!summary}
            onClick={() => void copyVal(summary, 'sum')}
          >
            {copied === 'sum' ? '已複製' : '複製摘要'}
          </ActionButton>
          {mapLink && (
            <ActionButton
              className="btn sm accent"
              onClick={() => window.open(mapLink, '_blank', 'noopener,noreferrer')}
            >
              開啟地圖
            </ActionButton>
          )}
        </div>
      }
      infoItems={[
        { label: '公開 IP', value: 'api.ipify.org' },
        { label: '地理資訊', value: 'ipapi.co（免 API Key）' },
        { label: '離線備援', value: 'API 失敗時顯示 RFC5737 示範 IP' },
        { label: '本機儲存', value: '僅記住上次查詢字串' },
      ]}
      faq={[
        ftPrivacyLocal,
        {
          title: '本機網路 IP',
          body: '「本機網路」透過 WebRTC ICE 候選位址探測，不等於路由器 WAN IP，僅供除錯。',
        },
        {
          title: '準確度',
          body: '地理定位為 ISP 註冊地近似值，VPN／行動網路可能與實際位置差距大。',
        },
        {
          title: '速率限制',
          body: '免費 geolocation 有每日上限；若頻繁失敗請稍後再試或手動輸入 IP。',
        },
      ]}
    >
      <FtToolRoot>
        <FtToolSearch>
          <div className="row ipl-search-row">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="輸入 IPv4／IPv6，空白則查本機公開 IP"
              value={query}
              maxLength={QUERY_MAX}
              onChange={(e) => setQuery(limitText(e.target.value, QUERY_MAX))}
              onKeyDown={(e) => e.key === 'Enter' && void lookup(query)}
            />
            <ActionButton className="btn accent" disabled={loading} onClick={() => lookup(query)} icon="search">
              {loading ? '查詢中…' : '查詢'}
            </ActionButton>
          </div>
          <div className="field-meta">
            <span className="field-hint">{isNonEmpty(query) ? '指定 IP' : '空白＝本機公開 IP'}</span>
            <span>{charCount(query)} / {QUERY_MAX}</span>
          </div>
          <div className="ipl-actions row">
            <ActionButton className="btn sm ghost" disabled={loading} onClick={() => lookup()}>
              本機公開 IP
            </ActionButton>
            <ActionButton className="btn sm teal" disabled={probing} onClick={() => void probeLan()}>
              {probing ? '探測中…' : '探測本機網路'}
            </ActionButton>
            <div className="ipl-samples">
              {SAMPLE_IPS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  disabled={loading}
                  onClick={() => {
                    if (s.ip) {
                      setQuery(s.ip)
                      void lookup(s.ip)
                    } else void lookup()
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {(usedMock || error) && (
            <p className={usedMock ? 'field-hint' : 'field-error'} role="status">
              {error || '目前為示範資料'}
            </p>
          )}
        </FtToolSearch>

          {loading && !info ? (
            <p className="muted">正在查詢…</p>
          ) : info ? (
            <FtToolHero
              emoji={flagEmoji(info.country_code)}
              title={<span className="mono">{info.ip}</span>}
              subtitle={locationLine}
              meta={
                <>
                  {info.org || '—'}
                  {info.latitude != null && info.longitude != null && (
                    <>
                      <br />
                      <span className="mono">{info.latitude}, {info.longitude}</span>
                    </>
                  )}
                </>
              }
              badge={usedMock ? <span className="tag">示範</span> : null}
            />
          ) : (
            <p className="muted">輸入 IP 或按「本機公開 IP」開始</p>
          )}

          {info && (
            <FtMetricGrid>
              {metrics.map((m) => (
                <FtMetric
                  key={m.k}
                  label={m.k}
                  value={m.v}
                  mono={m.k === 'ASN' || m.k === '網段'}
                />
              ))}
            </FtMetricGrid>
          )}

          {localIps.length > 0 && (
            <section className="ipl-lan">
              <h3 className="pw-panel-title">本機候選 IP（WebRTC）</h3>
              <p className="muted ipl-lan-hint">部分瀏覽器可能無法取得；通常為區域網路位址。</p>
              <ul className="ipl-lan-list">
                {localIps.map((ip) => (
                  <li key={ip} className="ipl-lan-item">
                    <span className="mono">{ip}</span>
                    <div className="row">
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(ip, ip)}
                        icon="copy"
                        iconOnly
                        tooltip="複製"
                      />
                      <ActionButton
                        className="btn sm teal"
                        onClick={() => {
                          setQuery(ip)
                          void lookup(ip)
                        }}
                      >
                        查詢
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
      </FtToolRoot>
    </FeatureLayout>
  )
}
