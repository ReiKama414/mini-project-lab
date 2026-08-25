import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText } from '../../lib/utils'

const meta = getProject('weather-dashboard')!

const QUERY_MAX = 40

type DayForecast = { day: string; high: number; low: number; icon: string; condition: string }
type CityWeather = {
  city: string
  country: string
  temp: number
  feels: number
  humidity: number
  wind: number
  condition: string
  high: number
  low: number
  pressure: number
  visibility: number
  updatedAt: number
  forecast: DayForecast[]
}

const DATA: CityWeather[] = [
  {
    city: '台北',
    country: '台灣',
    temp: 28,
    feels: 31,
    humidity: 72,
    wind: 12,
    condition: '多雲短暫陣雨',
    high: 30,
    low: 25,
    pressure: 1008,
    visibility: 9,
    updatedAt: Date.now() - 3 * 60_000,
    forecast: [
      { day: '週一', high: 30, low: 25, icon: '🌧', condition: '陣雨' },
      { day: '週二', high: 29, low: 24, icon: '🌧', condition: '午後雷陣雨' },
      { day: '週三', high: 31, low: 25, icon: '⛅', condition: '多雲' },
      { day: '週四', high: 32, low: 26, icon: '☀️', condition: '晴朗' },
      { day: '週五', high: 30, low: 25, icon: '🌤', condition: '晴時多雲' },
    ],
  },
  {
    city: '高雄',
    country: '台灣',
    temp: 31,
    feels: 34,
    humidity: 68,
    wind: 10,
    condition: '晴熱',
    high: 33,
    low: 27,
    pressure: 1006,
    visibility: 10,
    updatedAt: Date.now() - 5 * 60_000,
    forecast: [
      { day: '週一', high: 33, low: 27, icon: '☀️', condition: '晴' },
      { day: '週二', high: 32, low: 27, icon: '🌤', condition: '多雲' },
      { day: '週三', high: 33, low: 28, icon: '☀️', condition: '晴熱' },
      { day: '週四', high: 31, low: 26, icon: '🌧', condition: '短暫雨' },
      { day: '週五', high: 32, low: 27, icon: '⛅', condition: '多雲' },
    ],
  },
  {
    city: '東京',
    country: '日本',
    temp: 22,
    feels: 21,
    humidity: 58,
    wind: 18,
    condition: '晴時多雲',
    high: 24,
    low: 17,
    pressure: 1015,
    visibility: 12,
    updatedAt: Date.now() - 8 * 60_000,
    forecast: [
      { day: '月', high: 24, low: 17, icon: '☀️', condition: '晴' },
      { day: '火', high: 23, low: 16, icon: '☀️', condition: '晴' },
      { day: '水', high: 21, low: 15, icon: '⛅', condition: '多雲' },
      { day: '木', high: 20, low: 14, icon: '🌧', condition: '雨' },
      { day: '金', high: 22, low: 15, icon: '⛅', condition: '多雲' },
    ],
  },
  {
    city: '大阪',
    country: '日本',
    temp: 24,
    feels: 24,
    humidity: 62,
    wind: 14,
    condition: '多雲',
    high: 26,
    low: 19,
    pressure: 1012,
    visibility: 11,
    updatedAt: Date.now() - 6 * 60_000,
    forecast: [
      { day: '月', high: 26, low: 19, icon: '⛅', condition: '多雲' },
      { day: '火', high: 25, low: 18, icon: '🌤', condition: '晴時多雲' },
      { day: '水', high: 23, low: 17, icon: '🌧', condition: '小雨' },
      { day: '木', high: 24, low: 18, icon: '⛅', condition: '多雲' },
      { day: '金', high: 27, low: 20, icon: '☀️', condition: '晴' },
    ],
  },
  {
    city: '紐約',
    country: '美國',
    temp: 14,
    feels: 11,
    humidity: 45,
    wind: 22,
    condition: '涼風晴朗',
    high: 16,
    low: 9,
    pressure: 1020,
    visibility: 16,
    updatedAt: Date.now() - 12 * 60_000,
    forecast: [
      { day: 'Mon', high: 16, low: 9, icon: '☀️', condition: '晴' },
      { day: 'Tue', high: 15, low: 8, icon: '☀️', condition: '晴' },
      { day: 'Wed', high: 13, low: 7, icon: '🌬', condition: '強風' },
      { day: 'Thu', high: 12, low: 6, icon: '⛅', condition: '多雲' },
      { day: 'Fri', high: 14, low: 8, icon: '☀️', condition: '晴' },
    ],
  },
  {
    city: '舊金山',
    country: '美國',
    temp: 16,
    feels: 14,
    humidity: 70,
    wind: 20,
    condition: '薄霧',
    high: 18,
    low: 12,
    pressure: 1018,
    visibility: 6,
    updatedAt: Date.now() - 10 * 60_000,
    forecast: [
      { day: 'Mon', high: 18, low: 12, icon: '🌫', condition: '霧' },
      { day: 'Tue', high: 17, low: 11, icon: '⛅', condition: '多雲' },
      { day: 'Wed', high: 19, low: 13, icon: '☀️', condition: '晴' },
      { day: 'Thu', high: 16, low: 12, icon: '🌧', condition: '小雨' },
      { day: 'Fri', high: 18, low: 12, icon: '⛅', condition: '多雲' },
    ],
  },
  {
    city: '倫敦',
    country: '英國',
    temp: 11,
    feels: 9,
    humidity: 80,
    wind: 15,
    condition: '陰有小雨',
    high: 13,
    low: 8,
    pressure: 1002,
    visibility: 5,
    updatedAt: Date.now() - 7 * 60_000,
    forecast: [
      { day: 'Mon', high: 13, low: 8, icon: '🌧', condition: '小雨' },
      { day: 'Tue', high: 12, low: 7, icon: '🌧', condition: '雨' },
      { day: 'Wed', high: 11, low: 6, icon: '☁️', condition: '陰' },
      { day: 'Thu', high: 13, low: 8, icon: '⛅', condition: '多雲' },
      { day: 'Fri', high: 14, low: 9, icon: '🌤', condition: '轉晴' },
    ],
  },
  {
    city: '巴黎',
    country: '法國',
    temp: 18,
    feels: 17,
    humidity: 55,
    wind: 11,
    condition: '晴朗',
    high: 20,
    low: 12,
    pressure: 1016,
    visibility: 14,
    updatedAt: Date.now() - 4 * 60_000,
    forecast: [
      { day: 'Lun', high: 20, low: 12, icon: '☀️', condition: '晴' },
      { day: 'Mar', high: 19, low: 11, icon: '🌤', condition: '多雲' },
      { day: 'Mer', high: 17, low: 10, icon: '⛅', condition: '多雲' },
      { day: 'Jeu', high: 16, low: 9, icon: '🌧', condition: '陣雨' },
      { day: 'Ven', high: 18, low: 11, icon: '☀️', condition: '晴' },
    ],
  },
  {
    city: '新加坡',
    country: '新加坡',
    temp: 30,
    feels: 35,
    humidity: 82,
    wind: 8,
    condition: '悶熱偶雨',
    high: 32,
    low: 26,
    pressure: 1009,
    visibility: 8,
    updatedAt: Date.now() - 2 * 60_000,
    forecast: [
      { day: '一', high: 32, low: 26, icon: '🌧', condition: '陣雨' },
      { day: '二', high: 31, low: 26, icon: '⛅', condition: '多雲' },
      { day: '三', high: 33, low: 27, icon: '☀️', condition: '晴熱' },
      { day: '四', high: 32, low: 26, icon: '🌧', condition: '雷雨' },
      { day: '五', high: 31, low: 26, icon: '⛅', condition: '多雲' },
    ],
  },
  {
    city: '首爾',
    country: '韓國',
    temp: 19,
    feels: 18,
    humidity: 50,
    wind: 16,
    condition: '清爽晴朗',
    high: 21,
    low: 13,
    pressure: 1017,
    visibility: 15,
    updatedAt: Date.now() - 9 * 60_000,
    forecast: [
      { day: '월', high: 21, low: 13, icon: '☀️', condition: '晴' },
      { day: '화', high: 20, low: 12, icon: '🌤', condition: '多雲' },
      { day: '수', high: 18, low: 11, icon: '⛅', condition: '多雲' },
      { day: '목', high: 17, low: 10, icon: '🌧', condition: '雨' },
      { day: '금', high: 19, low: 12, icon: '☀️', condition: '晴' },
    ],
  },
]

function cToF(c: number) {
  return Math.round((c * 9) / 5 + 32)
}

export default function Page() {
  const [unit, setUnit] = useLocalStorage<'C' | 'F'>('lab:weather-dashboard:unit', 'C')
  const [city, setCity] = useLocalStorage('lab:weather-dashboard:city', DATA[0]!.city)
  const [query, setQuery] = useState('')
  const [refreshedAt, setRefreshedAt] = useState(Date.now())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DATA
    return DATA.filter(
      (d) =>
        d.city.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.condition.toLowerCase().includes(q),
    )
  }, [query])

  const w = useMemo(
    () => DATA.find((d) => d.city === city) || filtered[0] || DATA[0]!,
    [city, filtered],
  )

  const t = (c: number) => (unit === 'C' ? c : cToF(c))
  const unitLabel = unit === 'C' ? '°C' : '°F'

  function refresh() {
    setRefreshedAt(Date.now())
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="搜尋城市、國家…"
              value={query}
              maxLength={QUERY_MAX}
              onChange={(e) => setQuery(limitText(e.target.value, QUERY_MAX))}
            />
            <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
              {charCount(query)}/{QUERY_MAX}
            </span>
            <button
              className={`btn sm ${unit === 'C' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('C')}
            >
              °C
            </button>
            <button
              className={`btn sm ${unit === 'F' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('F')}
            >
              °F
            </button>
          </div>
          <ul className="list">
            {filtered.map((d) => (
              <li
                key={d.city}
                className="list-item"
                style={{
                  cursor: 'pointer',
                  outline: w.city === d.city ? '2px solid var(--accent, #f0734a)' : undefined,
                }}
                onClick={() => setCity(d.city)}
              >
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>
                    {d.city}{' '}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {d.country}
                    </span>
                  </strong>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {d.condition}
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                  {t(d.temp)}
                  {unitLabel}
                </span>
              </li>
            ))}
            {!filtered.length && <p className="muted">找不到符合的城市</p>}
          </ul>
        </div>

        <div className="panel stack">
          <div className="row">
            <div className="stack" style={{ flex: 1, gap: 2 }}>
              <strong style={{ fontSize: 22 }}>
                {w.city} · {w.country}
              </strong>
              <span className="muted">
                最後更新{' '}
                {new Date(Math.max(w.updatedAt, refreshedAt)).toLocaleString('zh-TW')}
              </span>
            </div>
            <button className="btn sm ghost" onClick={refresh}>
              重新整理
            </button>
          </div>

          <div className="metric" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>
              {t(w.temp)}
              <span style={{ fontSize: 24 }}>{unitLabel}</span>
            </div>
            <div>{w.condition}</div>
            <div className="muted">
              體感 {t(w.feels)}
              {unitLabel} · 最高 {t(w.high)}
              {unitLabel} / 最低 {t(w.low)}
              {unitLabel}
            </div>
          </div>

          <div className="grid-3">
            <div className="metric">
              <div className="muted">濕度</div>
              <div>{w.humidity}%</div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: `${w.humidity}%` }} />
              </div>
            </div>
            <div className="metric">
              <div className="muted">風速</div>
              <div>{w.wind} km/h</div>
            </div>
            <div className="metric">
              <div className="muted">氣壓</div>
              <div>{w.pressure} hPa</div>
            </div>
            <div className="metric">
              <div className="muted">能見度</div>
              <div>{w.visibility} km</div>
            </div>
            <div className="metric">
              <div className="muted">單位</div>
              <div>{unit === 'C' ? '攝氏' : '華氏'}</div>
            </div>
            <div className="metric">
              <div className="muted">資料來源</div>
              <div>示範資料</div>
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              五日預報
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {w.forecast.map((f) => (
                <div key={f.day} className="list-item">
                  <span style={{ minWidth: 48 }}>{f.day}</span>
                  <span>
                    {f.icon} {f.condition}
                  </span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>
                    {t(f.high)}
                    {unitLabel} / {t(f.low)}
                    {unitLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
