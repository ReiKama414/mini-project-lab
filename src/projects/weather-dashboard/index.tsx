import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText } from '../../lib/utils'

const meta = getProject('weather-dashboard')!

const QUERY_MAX = 40

type Place = {
  name: string
  country: string
  latitude: number
  longitude: number
}

type DayForecast = { day: string; high: number; low: number; icon: string; condition: string }

type CityWeather = {
  place: Place
  temp: number
  feels: number
  humidity: number
  wind: number
  condition: string
  icon: string
  high: number
  low: number
  pressure: number
  visibility: number
  updatedAt: number
  forecast: DayForecast[]
}

const DEFAULT_CITIES: Place[] = [
  { name: '台北', country: '台灣', latitude: 25.033, longitude: 121.5654 },
  { name: '新北', country: '台灣', latitude: 25.0169, longitude: 121.4628 },
  { name: '桃園', country: '台灣', latitude: 24.9936, longitude: 121.301 },
  { name: '台中', country: '台灣', latitude: 24.1477, longitude: 120.6736 },
  { name: '台南', country: '台灣', latitude: 22.9997, longitude: 120.227 },
  { name: '高雄', country: '台灣', latitude: 22.6273, longitude: 120.3014 },
  { name: '基隆', country: '台灣', latitude: 25.1276, longitude: 121.7392 },
  { name: '新竹', country: '台灣', latitude: 24.8138, longitude: 121 },
  { name: '嘉義', country: '台灣', latitude: 23.4801, longitude: 120.4491 },
  { name: '宜蘭', country: '台灣', latitude: 24.7021, longitude: 121.7378 },
  { name: '花蓮', country: '台灣', latitude: 23.9739, longitude: 121.6064 },
  { name: '台東', country: '台灣', latitude: 22.7972, longitude: 121.1444 },
]

function placeKey(p: Place) {
  return `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`
}

function placesEqual(a: Place, b: Place) {
  return placeKey(a) === placeKey(b)
}

/** WMO Weather interpretation codes → 繁中短標籤與圖示 */
function weatherFromCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: '晴朗', icon: '☀️' }
  if (code === 1) return { condition: '大致晴朗', icon: '🌤' }
  if (code === 2) return { condition: '局部多雲', icon: '⛅' }
  if (code === 3) return { condition: '陰天', icon: '☁️' }
  if (code === 45 || code === 48) return { condition: '霧', icon: '🌫' }
  if (code === 51 || code === 53 || code === 55) return { condition: '毛毛雨', icon: '🌦' }
  if (code === 56 || code === 57) return { condition: '凍毛毛雨', icon: '🌧' }
  if (code === 61) return { condition: '小雨', icon: '🌧' }
  if (code === 63) return { condition: '中雨', icon: '🌧' }
  if (code === 65) return { condition: '大雨', icon: '🌧' }
  if (code === 66 || code === 67) return { condition: '凍雨', icon: '🌧' }
  if (code === 71) return { condition: '小雪', icon: '🌨' }
  if (code === 73) return { condition: '中雪', icon: '🌨' }
  if (code === 75) return { condition: '大雪', icon: '❄️' }
  if (code === 77) return { condition: '雪粒', icon: '🌨' }
  if (code === 80) return { condition: '陣雨', icon: '🌧' }
  if (code === 81) return { condition: '強陣雨', icon: '🌧' }
  if (code === 82) return { condition: '暴雨', icon: '⛈' }
  if (code === 85) return { condition: '陣雪', icon: '🌨' }
  if (code === 86) return { condition: '強陣雪', icon: '❄️' }
  if (code === 95) return { condition: '雷雨', icon: '⛈' }
  if (code === 96 || code === 99) return { condition: '雷雹', icon: '⛈' }
  return { condition: '不明', icon: '🌡' }
}

function cToF(c: number) {
  return Math.round((c * 9) / 5 + 32)
}

function weekdayLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('zh-TW', { weekday: 'short' })
}

type ForecastApi = {
  current: {
    time: string
    temperature_2m: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
    surface_pressure: number
    visibility: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

type GeocodeApi = {
  results?: Array<{
    name: string
    country?: string
    admin1?: string
    latitude: number
    longitude: number
  }>
}

async function fetchForecast(place: Place, signal?: AbortSignal): Promise<CityWeather> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current:
      'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,visibility',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '5',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!res.ok) throw new Error(`預報請求失敗（HTTP ${res.status}）`)
  const data = (await res.json()) as ForecastApi
  const cur = data.current
  const daily = data.daily
  const { condition, icon } = weatherFromCode(cur.weather_code)
  const high = Math.round(daily.temperature_2m_max[0] ?? cur.temperature_2m)
  const low = Math.round(daily.temperature_2m_min[0] ?? cur.temperature_2m)
  const forecast: DayForecast[] = daily.time.map((time, i) => {
    const w = weatherFromCode(daily.weather_code[i] ?? 0)
    return {
      day: weekdayLabel(time),
      high: Math.round(daily.temperature_2m_max[i] ?? 0),
      low: Math.round(daily.temperature_2m_min[i] ?? 0),
      icon: w.icon,
      condition: w.condition,
    }
  })
  const visibilityKm = Math.round((cur.visibility / 1000) * 10) / 10
  return {
    place,
    temp: Math.round(cur.temperature_2m),
    feels: Math.round(cur.temperature_2m),
    humidity: Math.round(cur.relative_humidity_2m),
    wind: Math.round(cur.wind_speed_10m),
    condition,
    icon,
    high,
    low,
    pressure: Math.round(cur.surface_pressure),
    visibility: visibilityKm,
    updatedAt: Date.parse(cur.time) || Date.now(),
    forecast,
  }
}

async function searchPlaces(name: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    name,
    count: '5',
    language: 'zh',
    format: 'json',
  })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal })
  if (!res.ok) throw new Error(`地理編碼失敗（HTTP ${res.status}）`)
  const data = (await res.json()) as GeocodeApi
  if (!data.results?.length) return []
  return data.results.map((r) => ({
    name: r.name,
    country: r.country || r.admin1 || '',
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}

export default function Page() {
  const [unit, setUnit] = useLocalStorage<'C' | 'F'>('lab:weather:unit', 'C')
  const [place, setPlace] = useLocalStorage<Place>('lab:weather:place', DEFAULT_CITIES[0]!)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [weather, setWeather] = useState<CityWeather | null>(null)
  const [listCache, setListCache] = useState<Record<string, CityWeather>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const searchAbort = useRef<AbortController | null>(null)
  const forecastAbort = useRef<AbortController | null>(null)

  const t = (c: number) => (unit === 'C' ? c : cToF(c))
  const unitLabel = unit === 'C' ? '°C' : '°F'

  const loadSelected = useCallback(async (selected: Place) => {
    forecastAbort.current?.abort()
    const ac = new AbortController()
    forecastAbort.current = ac
    setLoading(true)
    setError('')
    try {
      const w = await fetchForecast(selected, ac.signal)
      if (ac.signal.aborted) return
      setWeather(w)
      setListCache((prev) => ({ ...prev, [placeKey(selected)]: w }))
    } catch (e) {
      if (ac.signal.aborted) return
      setWeather(null)
      setError(e instanceof Error ? e.message : '無法取得天氣資料')
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSelected(place)
    return () => forecastAbort.current?.abort()
  }, [place, refreshToken, loadSelected])

  // 預先載入預設城市列表溫度（左側列表）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const results = await Promise.allSettled(DEFAULT_CITIES.map((c) => fetchForecast(c)))
      if (cancelled) return
      setListCache((prev) => {
        const next = { ...prev }
        results.forEach((r, i) => {
          const city = DEFAULT_CITIES[i]!
          if (r.status === 'fulfilled') next[placeKey(city)] = r.value
        })
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  // 地理編碼搜尋（防抖）
  useEffect(() => {
    const q = query.trim()
    searchAbort.current?.abort()
    if (!q) {
      setSearchResults(null)
      setSearching(false)
      setSearchError('')
      return
    }
    const timer = window.setTimeout(() => {
      const ac = new AbortController()
      searchAbort.current = ac
      setSearching(true)
      setSearchError('')
      void searchPlaces(q, ac.signal)
        .then((places) => {
          if (!ac.signal.aborted) setSearchResults(places)
        })
        .catch((e) => {
          if (ac.signal.aborted) return
          setSearchResults([])
          setSearchError(e instanceof Error ? e.message : '搜尋失敗')
        })
        .finally(() => {
          if (!ac.signal.aborted) setSearching(false)
        })
    }, 350)
    return () => {
      window.clearTimeout(timer)
      searchAbort.current?.abort()
    }
  }, [query])

  const listPlaces = useMemo(() => {
    if (query.trim()) return searchResults ?? []
    // 確保目前選中城市也在列表中（若來自搜尋）
    const selectedInDefaults = DEFAULT_CITIES.some((c) => placesEqual(c, place))
    if (selectedInDefaults) return DEFAULT_CITIES
    return [place, ...DEFAULT_CITIES]
  }, [query, searchResults, place])

  const isSearching = Boolean(query.trim())

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="搜尋城市…"
              value={query}
              maxLength={QUERY_MAX}
              onChange={(e) => setQuery(limitText(e.target.value, QUERY_MAX))}
            />
            <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
              {charCount(query)}/{QUERY_MAX}
            </span>
            <button
              type="button"
              className={`btn sm ${unit === 'C' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('C')}
            >
              °C
            </button>
            <button
              type="button"
              className={`btn sm ${unit === 'F' ? 'accent' : 'ghost'}`}
              onClick={() => setUnit('F')}
            >
              °F
            </button>
          </div>

          {isSearching && searching && <p className="muted">搜尋中…</p>}
          {isSearching && searchError && <p className="field-error">{searchError}</p>}

          <ul className="list">
            {listPlaces.map((d) => {
              const cached = listCache[placeKey(d)]
              const selected = placesEqual(d, place)
              return (
                <li
                  key={placeKey(d)}
                  className="list-item"
                  style={{
                    cursor: 'pointer',
                    outline: selected ? '2px solid var(--accent, #f0734a)' : undefined,
                  }}
                  onClick={() => {
                    setPlace(d)
                    setQuery('')
                    setSearchResults(null)
                  }}
                >
                  <div className="stack" style={{ flex: 1, gap: 2 }}>
                    <strong>
                      {d.name}{' '}
                      <span className="muted" style={{ fontWeight: 400 }}>
                        {d.country}
                      </span>
                    </strong>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {cached ? cached.condition : isSearching ? '點選載入天氣' : '載入中…'}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                    {cached ? (
                      <>
                        {t(cached.temp)}
                        {unitLabel}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                </li>
              )
            })}
            {isSearching && !searching && listPlaces.length === 0 && (
              <p className="muted">找不到符合的城市</p>
            )}
          </ul>
        </div>

        <div className="panel stack">
          <div className="row">
            <div className="stack" style={{ flex: 1, gap: 2 }}>
              <strong style={{ fontSize: 22 }}>
                {place.name} · {place.country}
              </strong>
              <span className="muted">
                {loading
                  ? '更新中…'
                  : weather
                    ? `最後更新 ${new Date(weather.updatedAt).toLocaleString('zh-TW')}`
                    : '尚無資料'}
              </span>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              disabled={loading}
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              重新整理
            </button>
          </div>

          {error && <p className="field-error">{error}</p>}

          {loading && !weather && <p className="muted">正在取得天氣資料…</p>}

          {weather && (
            <>
              <div className="metric" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>
                  {t(weather.temp)}
                  <span style={{ fontSize: 24 }}>{unitLabel}</span>
                </div>
                <div>
                  {weather.icon} {weather.condition}
                </div>
                <div className="muted">
                  目前 {t(weather.feels)}
                  {unitLabel} · 最高 {t(weather.high)}
                  {unitLabel} / 最低 {t(weather.low)}
                  {unitLabel}
                </div>
              </div>

              <div className="grid-3">
                <div className="metric">
                  <div className="muted">濕度</div>
                  <div>{weather.humidity}%</div>
                  <div className="progress" style={{ marginTop: 8 }}>
                    <span style={{ width: `${weather.humidity}%` }} />
                  </div>
                </div>
                <div className="metric">
                  <div className="muted">風速</div>
                  <div>{weather.wind} km/h</div>
                </div>
                <div className="metric">
                  <div className="muted">氣壓</div>
                  <div>{weather.pressure} hPa</div>
                </div>
                <div className="metric">
                  <div className="muted">能見度</div>
                  <div>{weather.visibility} km</div>
                </div>
                <div className="metric">
                  <div className="muted">單位</div>
                  <div>{unit === 'C' ? '攝氏' : '華氏'}</div>
                </div>
                <div className="metric">
                  <div className="muted">資料來源</div>
                  <div>Open-Meteo</div>
                </div>
              </div>

              <div>
                <div className="label" style={{ marginBottom: 8 }}>
                  五日預報
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {weather.forecast.map((f, i) => (
                    <div key={`${f.day}-${i}`} className="list-item">
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
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
