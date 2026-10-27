import { getProject } from '../registry'
import { FeatureLayout } from '../../components/FeatureLayout'
import { FtToolHero } from '../../components/FeatureToolUI'
import { ActionButton } from '../../components/ActionButton'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, limitText } from '../../lib/utils'

const meta = getProject('weather-dashboard')!

const QUERY_MAX = 40

type Place = {
  name: string
  country: string
  latitude: number
  longitude: number
}

type DayForecast = {
  day: string
  date: string
  high: number
  low: number
  icon: string
  condition: string
  precipProb: number
  uvMax: number
}

type HourForecast = {
  time: string
  label: string
  temp: number
  icon: string
  precipProb: number
}

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
  cloud: number
  precip: number
  uv: number
  isDay: boolean
  sunrise: string
  sunset: string
  updatedAt: number
  forecast: DayForecast[]
  hourly: HourForecast[]
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

function formatClock(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function uvLabel(uv: number) {
  if (uv < 3) return '低'
  if (uv < 6) return '中'
  if (uv < 8) return '高'
  if (uv < 11) return '很高'
  return '極高'
}

type ForecastApi = {
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
    surface_pressure: number
    visibility: number
    cloud_cover: number
    precipitation: number
    is_day: number
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max?: number[]
    uv_index_max?: number[]
    sunrise?: string[]
    sunset?: string[]
  }
  hourly?: {
    time: string[]
    temperature_2m: number[]
    weather_code: number[]
    precipitation_probability?: number[]
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
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,visibility,cloud_cover,precipitation,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    timezone: 'auto',
    forecast_days: '7',
    forecast_hours: '24',
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
      date: time.slice(5),
      high: Math.round(daily.temperature_2m_max[i] ?? 0),
      low: Math.round(daily.temperature_2m_min[i] ?? 0),
      icon: w.icon,
      condition: w.condition,
      precipProb: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      uvMax: Math.round((daily.uv_index_max?.[i] ?? 0) * 10) / 10,
    }
  })

  const now = Date.now()
  const hourly: HourForecast[] = []
  if (data.hourly?.time?.length) {
    for (let i = 0; i < data.hourly.time.length && hourly.length < 12; i++) {
      const iso = data.hourly.time[i]!
      const ts = Date.parse(iso)
      if (Number.isNaN(ts) || ts < now - 30 * 60 * 1000) continue
      const w = weatherFromCode(data.hourly.weather_code[i] ?? 0)
      hourly.push({
        time: iso,
        label: formatClock(iso),
        temp: Math.round(data.hourly.temperature_2m[i] ?? 0),
        icon: w.icon,
        precipProb: Math.round(data.hourly.precipitation_probability?.[i] ?? 0),
      })
    }
  }

  const visibilityKm = Math.round((cur.visibility / 1000) * 10) / 10
  return {
    place,
    temp: Math.round(cur.temperature_2m),
    feels: Math.round(cur.apparent_temperature),
    humidity: Math.round(cur.relative_humidity_2m),
    wind: Math.round(cur.wind_speed_10m),
    condition,
    icon,
    high,
    low,
    pressure: Math.round(cur.surface_pressure),
    visibility: visibilityKm,
    cloud: Math.round(cur.cloud_cover),
    precip: Math.round(cur.precipitation * 10) / 10,
    uv: Math.round((daily.uv_index_max?.[0] ?? 0) * 10) / 10,
    isDay: cur.is_day === 1,
    sunrise: daily.sunrise?.[0] ?? '',
    sunset: daily.sunset?.[0] ?? '',
    updatedAt: Date.parse(cur.time) || Date.now(),
    forecast,
    hourly,
  }
}

async function searchPlaces(name: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    name,
    count: '8',
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
  const [copied, setCopied] = useState(false)
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
    const selectedInDefaults = DEFAULT_CITIES.some((c) => placesEqual(c, place))
    if (selectedInDefaults) return DEFAULT_CITIES
    return [place, ...DEFAULT_CITIES]
  }, [query, searchResults, place])

  const isSearching = Boolean(query.trim())

  const summary = useMemo(() => {
    if (!weather) return ''
    return [
      `${weather.place.name} · ${weather.place.country}`,
      `${weather.condition} ${t(weather.temp)}${unitLabel}（體感 ${t(weather.feels)}${unitLabel}）`,
      `最高 ${t(weather.high)}${unitLabel} / 最低 ${t(weather.low)}${unitLabel}`,
      `濕度 ${weather.humidity}% · 風速 ${weather.wind} km/h · UV ${weather.uv}（${uvLabel(weather.uv)}）`,
      `日出 ${formatClock(weather.sunrise)} · 日落 ${formatClock(weather.sunset)}`,
      `資料：Open-Meteo · ${new Date(weather.updatedAt).toLocaleString('zh-TW')}`,
    ].join('\n')
  }, [weather, unit])

  async function copySummary() {
    if (!summary) return
    await copyText(summary)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function selectPlace(d: Place) {
    setPlace(d)
    setQuery('')
    setSearchResults(null)
  }

  return (
    <FeatureLayout
      meta={meta}
      infoItems={[
        { label: '資料來源', value: 'Open-Meteo（免費、免 API Key）' },
        {
          label: '目前城市',
          value: `${place.name} · ${place.country}`,
        },
        {
          label: '座標',
          value: `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`,
        },
        { label: '溫度單位', value: unit === 'C' ? '攝氏 °C' : '華氏 °F' },
        { label: '預報範圍', value: '未來 12 小時 + 7 日' },
      ]}
      faq={[
        {
          title: '體感溫度',
          body: '依風速與濕度推估的 apparent temperature，可能與實測溫度不同。',
        },
        {
          title: 'UV 指數',
          body: '取當日最高值：0–2 低、3–5 中、6–7 高、8–10 很高、11+ 極高。',
        },
        {
          title: '隱私與限制',
          body: '城市與單位會記在本機；天氣由瀏覽器直接向 Open-Meteo 請求，需網路。離線或 CORS／API 異常時會顯示錯誤。',
        },
      ]}
      actions={
        <div className="row wd-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!weather}
            onClick={() => void copySummary()}
            icon="copy"
          >
            {copied ? '已複製' : '複製摘要'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={loading}
            onClick={() => setRefreshToken((n) => n + 1)}
            icon="reset"
          >
            {loading ? '更新中…' : '重新整理'}
          </ActionButton>
        </div>
      }
      toolbar={
        <>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="label">溫度單位</span>
            <div className="wd-unit" role="group" aria-label="溫度單位">
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
          </div>
          <label className="stack wd-search">
            <span className="label">搜尋城市</span>
            <div className="row">
              <input
                className="field"
                style={{ flex: 1 }}
                placeholder="例如：東京、大阪…"
                value={query}
                maxLength={QUERY_MAX}
                onChange={(e) => setQuery(limitText(e.target.value, QUERY_MAX))}
              />
              <span className="muted wd-count">
                {charCount(query)}/{QUERY_MAX}
              </span>
            </div>
          </label>
          {isSearching && searching && <p className="muted">搜尋中…</p>}
          {isSearching && searchError && <p className="field-error">{searchError}</p>}
        </>
      }
    >
      <div className="wd-calc">
        <div className="wd-main">
          <section className="panel wd-cities">
            <h3 className="pw-panel-title">城市</h3>
            <ul className="wd-city-list" role="listbox" aria-label="城市列表">
              {listPlaces.map((d) => {
                const cached = listCache[placeKey(d)]
                const selected = placesEqual(d, place)
                return (
                  <li key={placeKey(d)}>
                    <button
                      type="button"
                      className={`wd-city ${selected ? 'is-active' : ''}`}
                      aria-selected={selected}
                      onClick={() => selectPlace(d)}
                    >
                      <span className="wd-city-text">
                        <strong>
                          {d.name}{' '}
                          <span className="muted" style={{ fontWeight: 400 }}>
                            {d.country}
                          </span>
                        </strong>
                        <span className="muted">
                          {cached
                            ? `${cached.icon} ${cached.condition}`
                            : isSearching
                              ? '點選載入天氣'
                              : '載入中…'}
                        </span>
                      </span>
                      <span className="mono wd-city-temp">
                        {cached ? (
                          <>
                            {t(cached.temp)}
                            {unitLabel}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
              {isSearching && !searching && listPlaces.length === 0 && (
                <li className="muted wd-empty">找不到符合的城市</li>
              )}
            </ul>
          </section>

          <section className="panel wd-detail">
            <div className="pw-panel-head">
              <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                <h3 className="pw-panel-title">
                  {place.name} · {place.country}
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {loading
                    ? '更新中…'
                    : weather
                      ? `最後更新 ${new Date(weather.updatedAt).toLocaleString('zh-TW')}`
                      : '尚無資料'}
                </span>
              </div>
            </div>

            {error && <p className="field-error">{error}</p>}
            {loading && !weather && <p className="muted">正在取得天氣資料…</p>}

            {weather && (
              <div className="wd-detail-body">
                <FtToolHero
                  emoji={weather.icon}
                  title={
                    <span className="mono">
                      {t(weather.temp)}
                      {unitLabel}
                    </span>
                  }
                  subtitle={weather.condition}
                  meta={`體感 ${t(weather.feels)}${unitLabel} · 最高 ${t(weather.high)}${unitLabel} / 最低 ${t(weather.low)}${unitLabel}`}
                  badge={
                    <span className={`tag ${weather.isDay ? '' : 'wd-night'}`}>{weather.isDay ? '日間' : '夜間'}</span>
                  }
                />

                <div className="wd-metrics">
                  <div className="wd-metric">
                    <span className="muted">濕度</span>
                    <strong>{weather.humidity}%</strong>
                    <div className="progress" aria-hidden>
                      <span style={{ width: `${weather.humidity}%` }} />
                    </div>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">風速</span>
                    <strong>{weather.wind} km/h</strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">氣壓</span>
                    <strong>{weather.pressure} hPa</strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">能見度</span>
                    <strong>{weather.visibility} km</strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">雲量</span>
                    <strong>{weather.cloud}%</strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">降水</span>
                    <strong>{weather.precip} mm</strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">UV 指數</span>
                    <strong>
                      {weather.uv} · {uvLabel(weather.uv)}
                    </strong>
                  </div>
                  <div className="wd-metric">
                    <span className="muted">日出／日落</span>
                    <strong>
                      {formatClock(weather.sunrise)} / {formatClock(weather.sunset)}
                    </strong>
                  </div>
                </div>

                {weather.hourly.length > 0 && (
                  <div className="wd-section">
                    <div className="label">未來時段</div>
                    <div className="wd-hourly" role="list">
                      {weather.hourly.map((h) => (
                        <div key={h.time} className="wd-hour" role="listitem">
                          <span className="muted">{h.label}</span>
                          <span aria-hidden>{h.icon}</span>
                          <strong className="mono">
                            {t(h.temp)}
                            {unitLabel}
                          </strong>
                          <span className="muted wd-hour-rain">{h.precipProb}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="wd-section wd-forecast-wrap">
                  <div className="label">七日預報</div>
                  <ul className="wd-forecast">
                    {weather.forecast.map((f, i) => (
                      <li key={`${f.date}-${i}`} className="wd-forecast-row">
                        <span className="wd-forecast-day">
                          <strong>{f.day}</strong>
                          <span className="muted">{f.date}</span>
                        </span>
                        <span className="wd-forecast-cond">
                          <span aria-hidden>{f.icon}</span>
                          {f.condition}
                        </span>
                        <span className="muted wd-forecast-meta">
                          雨 {f.precipProb}% · UV {f.uvMax}
                        </span>
                        <span className="mono wd-forecast-temp">
                          {t(f.high)}
                          {unitLabel} / {t(f.low)}
                          {unitLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

      </div>
    </FeatureLayout>
  )
}
