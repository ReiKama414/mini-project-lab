import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('unit-converter')!

const VALUE_MIN = -1e15
const VALUE_MAX = 1e15
const HISTORY_CAP = 24
const FAV_CAP = 12

type Category = 'length' | 'weight' | 'temp' | 'volume' | 'area' | 'speed' | 'time' | 'data'

type Unit = {
  id: string
  label: string
  short: string
  toBase: (n: number) => number
  fromBase: (n: number) => number
}

const UNITS: Record<Category, Unit[]> = {
  length: [
    { id: 'm', label: '公尺', short: 'm', toBase: (n) => n, fromBase: (n) => n },
    { id: 'km', label: '公里', short: 'km', toBase: (n) => n * 1000, fromBase: (n) => n / 1000 },
    { id: 'cm', label: '公分', short: 'cm', toBase: (n) => n / 100, fromBase: (n) => n * 100 },
    { id: 'mm', label: '毫米', short: 'mm', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'um', label: '微米', short: 'μm', toBase: (n) => n / 1e6, fromBase: (n) => n * 1e6 },
    { id: 'nm', label: '奈米', short: 'nm', toBase: (n) => n / 1e9, fromBase: (n) => n * 1e9 },
    { id: 'mi', label: '英里', short: 'mi', toBase: (n) => n * 1609.344, fromBase: (n) => n / 1609.344 },
    { id: 'yd', label: '碼', short: 'yd', toBase: (n) => n * 0.9144, fromBase: (n) => n / 0.9144 },
    { id: 'ft', label: '英尺', short: 'ft', toBase: (n) => n * 0.3048, fromBase: (n) => n / 0.3048 },
    { id: 'in', label: '英寸', short: 'in', toBase: (n) => n * 0.0254, fromBase: (n) => n / 0.0254 },
    { id: 'nmi', label: '海里', short: 'nmi', toBase: (n) => n * 1852, fromBase: (n) => n / 1852 },
  ],
  weight: [
    { id: 'kg', label: '公斤', short: 'kg', toBase: (n) => n, fromBase: (n) => n },
    { id: 'g', label: '公克', short: 'g', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'mg', label: '毫克', short: 'mg', toBase: (n) => n / 1e6, fromBase: (n) => n * 1e6 },
    { id: 't', label: '公噸', short: 't', toBase: (n) => n * 1000, fromBase: (n) => n / 1000 },
    { id: 'lb', label: '磅', short: 'lb', toBase: (n) => n * 0.45359237, fromBase: (n) => n / 0.45359237 },
    { id: 'oz', label: '盎司', short: 'oz', toBase: (n) => n * 0.028349523125, fromBase: (n) => n / 0.028349523125 },
    { id: 'st', label: '英石', short: 'st', toBase: (n) => n * 6.35029318, fromBase: (n) => n / 6.35029318 },
  ],
  temp: [
    { id: 'c', label: '攝氏', short: '°C', toBase: (n) => n, fromBase: (n) => n },
    { id: 'f', label: '華氏', short: '°F', toBase: (n) => ((n - 32) * 5) / 9, fromBase: (n) => (n * 9) / 5 + 32 },
    { id: 'k', label: '克氏', short: 'K', toBase: (n) => n - 273.15, fromBase: (n) => n + 273.15 },
  ],
  volume: [
    { id: 'l', label: '公升', short: 'L', toBase: (n) => n, fromBase: (n) => n },
    { id: 'ml', label: '毫升', short: 'mL', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'm3', label: '立方公尺', short: 'm³', toBase: (n) => n * 1000, fromBase: (n) => n / 1000 },
    { id: 'gal', label: '美制加侖', short: 'gal', toBase: (n) => n * 3.785411784, fromBase: (n) => n / 3.785411784 },
    { id: 'qt', label: '美制夸脫', short: 'qt', toBase: (n) => n * 0.946352946, fromBase: (n) => n / 0.946352946 },
    { id: 'cup', label: '美制杯', short: 'cup', toBase: (n) => n * 0.2365882365, fromBase: (n) => n / 0.2365882365 },
    { id: 'tbsp', label: '湯匙', short: 'tbsp', toBase: (n) => n * 0.0147867648, fromBase: (n) => n / 0.0147867648 },
    { id: 'tsp', label: '茶匙', short: 'tsp', toBase: (n) => n * 0.00492892159, fromBase: (n) => n / 0.00492892159 },
  ],
  area: [
    { id: 'm2', label: '平方公尺', short: 'm²', toBase: (n) => n, fromBase: (n) => n },
    { id: 'km2', label: '平方公里', short: 'km²', toBase: (n) => n * 1e6, fromBase: (n) => n / 1e6 },
    { id: 'cm2', label: '平方公分', short: 'cm²', toBase: (n) => n / 1e4, fromBase: (n) => n * 1e4 },
    { id: 'ha', label: '公頃', short: 'ha', toBase: (n) => n * 1e4, fromBase: (n) => n / 1e4 },
    { id: 'acre', label: '英畝', short: 'acre', toBase: (n) => n * 4046.8564224, fromBase: (n) => n / 4046.8564224 },
    { id: 'ft2', label: '平方英尺', short: 'ft²', toBase: (n) => n * 0.09290304, fromBase: (n) => n / 0.09290304 },
    { id: 'ping', label: '坪', short: '坪', toBase: (n) => n * 3.305785124, fromBase: (n) => n / 3.305785124 },
  ],
  speed: [
    { id: 'mps', label: '公尺／秒', short: 'm/s', toBase: (n) => n, fromBase: (n) => n },
    { id: 'kph', label: '公里／時', short: 'km/h', toBase: (n) => n / 3.6, fromBase: (n) => n * 3.6 },
    { id: 'mph', label: '英里／時', short: 'mph', toBase: (n) => n * 0.44704, fromBase: (n) => n / 0.44704 },
    { id: 'knot', label: '節', short: 'kn', toBase: (n) => n * (1852 / 3600), fromBase: (n) => n / (1852 / 3600) },
    { id: 'fps', label: '英尺／秒', short: 'ft/s', toBase: (n) => n * 0.3048, fromBase: (n) => n / 0.3048 },
  ],
  time: [
    { id: 's', label: '秒', short: 's', toBase: (n) => n, fromBase: (n) => n },
    { id: 'ms', label: '毫秒', short: 'ms', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'min', label: '分鐘', short: 'min', toBase: (n) => n * 60, fromBase: (n) => n / 60 },
    { id: 'h', label: '小時', short: 'h', toBase: (n) => n * 3600, fromBase: (n) => n / 3600 },
    { id: 'd', label: '天', short: 'd', toBase: (n) => n * 86400, fromBase: (n) => n / 86400 },
    { id: 'wk', label: '週', short: 'wk', toBase: (n) => n * 604800, fromBase: (n) => n / 604800 },
  ],
  data: [
    { id: 'b', label: 'Byte', short: 'B', toBase: (n) => n, fromBase: (n) => n },
    { id: 'kb', label: 'KB（十進位）', short: 'KB', toBase: (n) => n * 1e3, fromBase: (n) => n / 1e3 },
    { id: 'mb', label: 'MB（十進位）', short: 'MB', toBase: (n) => n * 1e6, fromBase: (n) => n / 1e6 },
    { id: 'gb', label: 'GB（十進位）', short: 'GB', toBase: (n) => n * 1e9, fromBase: (n) => n / 1e9 },
    { id: 'tb', label: 'TB（十進位）', short: 'TB', toBase: (n) => n * 1e12, fromBase: (n) => n / 1e12 },
    { id: 'kib', label: 'KiB（二進位）', short: 'KiB', toBase: (n) => n * 1024, fromBase: (n) => n / 1024 },
    { id: 'mib', label: 'MiB（二進位）', short: 'MiB', toBase: (n) => n * 1024 ** 2, fromBase: (n) => n / 1024 ** 2 },
    { id: 'gib', label: 'GiB（二進位）', short: 'GiB', toBase: (n) => n * 1024 ** 3, fromBase: (n) => n / 1024 ** 3 },
    { id: 'tib', label: 'TiB（二進位）', short: 'TiB', toBase: (n) => n * 1024 ** 4, fromBase: (n) => n / 1024 ** 4 },
  ],
}

const CAT_LABEL: Record<Category, string> = {
  length: '長度',
  weight: '重量',
  temp: '溫度',
  volume: '容量',
  area: '面積',
  speed: '速度',
  time: '時間',
  data: '資料量',
}

const CAT_ORDER: Category[] = ['length', 'weight', 'temp', 'volume', 'area', 'speed', 'time', 'data']

const VALUE_CHIPS: Record<Category, number[]> = {
  length: [1, 10, 100, 1000],
  weight: [1, 5, 10, 50, 100],
  temp: [0, 25, 36.5, 100],
  volume: [1, 250, 500, 1000],
  area: [1, 10, 30, 100],
  speed: [1, 30, 60, 100],
  time: [1, 60, 3600, 86400],
  data: [1, 1024, 1e6, 1e9],
}

type Preset = { label: string; cat: Category; from: string; to: string; value: number }

const PRESETS: Preset[] = [
  { label: '1 m → ft', cat: 'length', from: 'm', to: 'ft', value: 1 },
  { label: '5 km → mi', cat: 'length', from: 'km', to: 'mi', value: 5 },
  { label: '70 kg → lb', cat: 'weight', from: 'kg', to: 'lb', value: 70 },
  { label: '100 °C → °F', cat: 'temp', from: 'c', to: 'f', value: 100 },
  { label: '36.5 °C → °F', cat: 'temp', from: 'c', to: 'f', value: 36.5 },
  { label: '1 L → cup', cat: 'volume', from: 'l', to: 'cup', value: 1 },
  { label: '30 坪 → m²', cat: 'area', from: 'ping', to: 'm2', value: 30 },
  { label: '100 km/h → mph', cat: 'speed', from: 'kph', to: 'mph', value: 100 },
  { label: '1 GiB → GB', cat: 'data', from: 'gib', to: 'gb', value: 1 },
]

type Precision = 'auto' | 2 | 4 | 6 | 8

type Prefs = {
  cat: Category
  from: string
  to: string
  value: number
  precision: Precision
}

type Pair = { cat: Category; from: string; to: string }

type Hist = {
  id: string
  at: number
  cat: Category
  from: string
  to: string
  value: number
  result: number
}

function unitLabel(u: Unit) {
  return `${u.label} (${u.short})`
}

function formatNum(n: number, precision: Precision) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (precision === 'auto') {
    if (abs !== 0 && (abs >= 1e9 || abs < 1e-6)) {
      return n.toExponential(6)
    }
    const digits = abs >= 1000 ? 4 : abs >= 1 ? 6 : 8
    return Number(n.toPrecision(digits)).toLocaleString(undefined, { maximumFractionDigits: 12 })
  }
  return n.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })
}

function convert(value: number, from: Unit, to: Unit, cat: Category) {
  if (!Number.isFinite(value)) return NaN
  if (cat === 'temp' && from.id === 'k' && value < 0) return NaN
  let base = from.toBase(value)
  if (cat === 'temp') base = Math.max(base, -273.15)
  return to.fromBase(base)
}

export default function Page() {
  const [prefs, setPrefs] = useLocalStorage<Prefs>('lab:unit-converter', {
    cat: 'length',
    from: 'm',
    to: 'ft',
    value: 1,
    precision: 'auto',
  })
  const [favorites, setFavorites] = useLocalStorage<Pair[]>('lab:unit-converter:favs', [
    { cat: 'length', from: 'm', to: 'ft' },
    { cat: 'temp', from: 'c', to: 'f' },
    { cat: 'weight', from: 'kg', to: 'lb' },
  ])
  const [history, setHistory] = useLocalStorage<Hist[]>('lab:unit-converter:history', [])

  const cat = (UNITS[prefs.cat] ? prefs.cat : 'length') as Category
  const units = UNITS[cat]
  const fromId = units.some((u) => u.id === prefs.from) ? prefs.from : units[0]!.id
  const toId = units.some((u) => u.id === prefs.to) ? prefs.to : units[Math.min(1, units.length - 1)]!.id
  const value = Number.isFinite(prefs.value) ? prefs.value : 1
  const precision = prefs.precision ?? 'auto'

  const [draft, setDraft] = useState<string | null>(null)
  const [toDraft, setToDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [listQuery, setListQuery] = useState('')

  const fromUnit = units.find((u) => u.id === fromId)!
  const toUnit = units.find((u) => u.id === toId)!

  const result = useMemo(
    () => (error ? NaN : convert(value, fromUnit, toUnit, cat)),
    [error, value, fromUnit, toUnit, cat],
  )

  const rate = useMemo(() => convert(1, fromUnit, toUnit, cat), [fromUnit, toUnit, cat])
  const invRate = useMemo(() => convert(1, toUnit, fromUnit, cat), [fromUnit, toUnit, cat])

  const allResults = useMemo(() => {
    if (error || !Number.isFinite(value)) return []
    return units.map((u) => ({
      unit: u,
      value: convert(value, fromUnit, u, cat),
    }))
  }, [units, fromUnit, value, error, cat])

  const filteredResults = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return allResults
    return allResults.filter(
      ({ unit: u }) =>
        u.label.toLowerCase().includes(q) ||
        u.short.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    )
  }, [allResults, listQuery])

  function patch(next: Partial<Prefs>) {
    setPrefs({
      cat,
      from: fromId,
      to: toId,
      value,
      precision,
      ...next,
    })
  }

  function changeCat(c: Category) {
    setError('')
    setDraft(null)
    setToDraft(null)
    setListQuery('')
    setPrefs({
      cat: c,
      from: UNITS[c][0]!.id,
      to: UNITS[c][Math.min(1, UNITS[c].length - 1)]!.id,
      value,
      precision,
    })
  }

  function commitFrom(raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setError('請輸入有效數字')
      setDraft(null)
      return
    }
    if (cat === 'temp' && fromId === 'k' && n < 0) {
      setError('克氏溫度不可為負')
      setDraft(null)
      return
    }
    setError('')
    setDraft(null)
    setToDraft(null)
    patch({ value: clamp(n, VALUE_MIN, VALUE_MAX) })
  }

  function commitTo(raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setToDraft(null)
      return
    }
    if (cat === 'temp' && toId === 'k' && n < 0) {
      setError('克氏溫度不可為負')
      setToDraft(null)
      return
    }
    const back = convert(n, toUnit, fromUnit, cat)
    if (!Number.isFinite(back)) {
      setToDraft(null)
      return
    }
    setError('')
    setToDraft(null)
    setDraft(null)
    patch({ value: clamp(back, VALUE_MIN, VALUE_MAX) })
  }

  function swap() {
    if (!Number.isFinite(result)) {
      patch({ from: toId, to: fromId })
      return
    }
    setDraft(null)
    setToDraft(null)
    setError('')
    patch({ from: toId, to: fromId, value: result })
  }

  function applyPreset(p: Preset) {
    setError('')
    setDraft(null)
    setToDraft(null)
    setListQuery('')
    setPrefs({
      cat: p.cat,
      from: p.from,
      to: p.to,
      value: p.value,
      precision,
    })
  }

  function isFav(pair: Pair) {
    return favorites.some((f) => f.cat === pair.cat && f.from === pair.from && f.to === pair.to)
  }

  function toggleFavorite() {
    const pair: Pair = { cat, from: fromId, to: toId }
    if (isFav(pair)) {
      setFavorites((xs) => xs.filter((f) => !(f.cat === pair.cat && f.from === pair.from && f.to === pair.to)))
    } else {
      setFavorites((xs) => [pair, ...xs].slice(0, FAV_CAP))
    }
  }

  function pushHistory() {
    if (!Number.isFinite(result)) return
    setHistory((h) =>
      [
        {
          id: uid('uc'),
          at: Date.now(),
          cat,
          from: fromId,
          to: toId,
          value,
          result,
        },
        ...h.filter((x) => !(x.cat === cat && x.from === fromId && x.to === toId && x.value === value)),
      ].slice(0, HISTORY_CAP),
    )
  }

  async function copyEquation(nFrom: number, uFrom: Unit, nTo: number, uTo: Unit) {
    const text = `${formatNum(nFrom, precision)} ${uFrom.short} = ${formatNum(nTo, precision)} ${uTo.short}`
    await copyText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
    pushHistory()
  }

  const displayFrom = draft ?? String(value)
  const displayTo = toDraft ?? (Number.isFinite(result) ? String(Number(result.toPrecision(12))) : '')

  return (
    <ProjectShell meta={meta}>
      <div className="uc-calc">
        <div className="uc-main">
          <section className="panel uc-converter">
            <div className="uc-cats" role="tablist" aria-label="單位分類">
              {CAT_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={cat === id}
                  className={`btn sm ${cat === id ? 'accent' : 'ghost'}`}
                  onClick={() => changeCat(id)}
                >
                  {CAT_LABEL[id]}
                </button>
              ))}
            </div>

            <div className="uc-pair">
              <label className="uc-field">
                <span className="label">從</span>
                <div className="uc-input-row">
                  <input
                    className={`field mono${error ? ' is-invalid' : ''}`}
                    inputMode="decimal"
                    value={displayFrom}
                    aria-label="來源數值"
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setError('')
                    }}
                    onBlur={() => {
                      if (draft == null) return
                      commitFrom(draft)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                  />
                  <select
                    className="field uc-unit-select"
                    value={fromId}
                    aria-label="來源單位"
                    onChange={(e) => {
                      setDraft(null)
                      setToDraft(null)
                      patch({ from: e.target.value })
                    }}
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <ActionButton
                className="btn ghost uc-swap"
                onClick={swap}
                icon="swap"
                iconOnly
                tooltip="交換單位"
                aria-label="交換單位"
              />

              <label className="uc-field">
                <span className="label">到</span>
                <div className="uc-input-row">
                  <input
                    className="field mono"
                    inputMode="decimal"
                    value={displayTo}
                    aria-label="目標數值"
                    placeholder="—"
                    onChange={(e) => setToDraft(e.target.value)}
                    onBlur={() => {
                      if (toDraft == null) return
                      commitTo(toDraft)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                  <select
                    className="field uc-unit-select"
                    value={toId}
                    aria-label="目標單位"
                    onChange={(e) => {
                      setToDraft(null)
                      patch({ to: e.target.value })
                    }}
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            {error && <p className="field-error">{error}</p>}

            <div className="uc-chips" aria-label="常用數值">
              {VALUE_CHIPS[cat].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ghost${value === n && draft == null ? ' is-active' : ''}`}
                  onClick={() => {
                    setError('')
                    setDraft(null)
                    setToDraft(null)
                    patch({ value: n })
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="uc-result">
              <p className="muted uc-result-eq">
                {formatNum(value, precision)} {fromUnit.short}
                <span aria-hidden="true"> → </span>
                {toUnit.short}
              </p>
              <div className="uc-result-num mono">
                {formatNum(result, precision)}
                <span className="uc-result-unit">{toUnit.short}</span>
              </div>
              <p className="muted uc-rate-lines">
                1 {fromUnit.short} = {formatNum(rate, precision)} {toUnit.short}
                <br />
                1 {toUnit.short} = {formatNum(invRate, precision)} {fromUnit.short}
              </p>
              <div className="uc-actions">
                <label className="uc-precision">
                  <span className="muted">精度</span>
                  <select
                    className="field sm"
                    value={String(precision)}
                    onChange={(e) => {
                      const v = e.target.value
                      patch({
                        precision: v === 'auto' ? 'auto' : (Number(v) as 2 | 4 | 6 | 8),
                      })
                    }}
                  >
                    <option value="auto">自動</option>
                    <option value="2">2 位</option>
                    <option value="4">4 位</option>
                    <option value="6">6 位</option>
                    <option value="8">8 位</option>
                  </select>
                </label>
                <ActionButton
                  className="btn ghost"
                  disabled={!Number.isFinite(result)}
                  onClick={() => void copyEquation(value, fromUnit, result, toUnit)}
                  icon="copy"
                >
                  {copied ? '已複製' : '複製結果'}
                </ActionButton>
                <ActionButton
                  className={`btn ${isFav({ cat, from: fromId, to: toId }) ? 'accent' : 'ghost'}`}
                  onClick={toggleFavorite}
                  icon={isFav({ cat, from: fromId, to: toId }) ? 'check' : 'plus'}
                >
                  {isFav({ cat, from: fromId, to: toId }) ? '已收藏' : '收藏組合'}
                </ActionButton>
              </div>
            </div>
          </section>

          <section className="panel uc-overview">
            <div className="uc-panel-head">
              <h3 className="uc-panel-title">同分類一覽</h3>
              <span className="muted uc-filter-count">{filteredResults.length} 項</span>
            </div>
            <input
              className="field"
              type="search"
              placeholder="搜尋單位…"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              aria-label="搜尋單位"
            />
            <ul className="uc-list">
              {filteredResults.map(({ unit: u, value: n }) => {
                const isFrom = u.id === fromId
                const isTo = u.id === toId
                return (
                  <li
                    key={u.id}
                    className={`uc-list-item${isTo ? ' is-to' : ''}${isFrom ? ' is-from' : ''}`}
                  >
                    <button
                      type="button"
                      className="uc-list-main"
                      onClick={() => {
                        setToDraft(null)
                        if (u.id === fromId) return
                        patch({ to: u.id })
                      }}
                      title={isFrom ? '目前來源單位' : '設為目標單位'}
                    >
                      <span className="uc-list-label">
                        {u.label}
                        <span className="muted"> ({u.short})</span>
                      </span>
                      <strong className="mono uc-list-value">{formatNum(n, precision)}</strong>
                    </button>
                    <div className="uc-list-actions">
                      {!isFrom && (
                        <ActionButton
                          className="btn ghost sm"
                          icon="swap"
                          iconOnly
                          tooltip="設為來源"
                          aria-label={`設 ${u.short} 為來源`}
                          onClick={() => {
                            setDraft(null)
                            setToDraft(null)
                            patch({ from: u.id })
                          }}
                        />
                      )}
                      <ActionButton
                        className="btn ghost sm"
                        icon="copy"
                        iconOnly
                        tooltip="複製"
                        disabled={!Number.isFinite(n)}
                        onClick={() => void copyEquation(value, fromUnit, n, u)}
                      />
                    </div>
                  </li>
                )
              })}
              {!filteredResults.length && <li className="muted">沒有符合的單位</li>}
            </ul>
            <p className="muted uc-hint">點列設為目標；交換圖示改來源。複製會記入最近紀錄</p>
          </section>
        </div>

        <div className="uc-side">
          <section className="panel uc-presets">
            <h3 className="uc-panel-title">常用預設</h3>
            <div className="uc-presets-chips">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel uc-favs">
            <div className="uc-panel-head">
              <h3 className="uc-panel-title">收藏組合</h3>
              {!!favorites.length && (
                <ActionButton
                  className="btn ghost sm"
                  onClick={() => {
                    if (confirm('確定清除全部收藏？')) setFavorites([])
                  }}
                >
                  清除
                </ActionButton>
              )}
            </div>
            {!favorites.length && <p className="muted">點「收藏組合」記住常用轉換</p>}
            <ul className="uc-side-list">
              {favorites.map((f) => {
                const fu = UNITS[f.cat]?.find((u) => u.id === f.from)
                const tu = UNITS[f.cat]?.find((u) => u.id === f.to)
                if (!fu || !tu) return null
                return (
                  <li key={`${f.cat}-${f.from}-${f.to}`} className="uc-side-item">
                    <button
                      type="button"
                      className="uc-side-main"
                      onClick={() => {
                        setError('')
                        setDraft(null)
                        setToDraft(null)
                        setPrefs({ cat: f.cat, from: f.from, to: f.to, value, precision })
                      }}
                    >
                      <span className="tag">{CAT_LABEL[f.cat]}</span>
                      <strong>
                        {fu.short} → {tu.short}
                      </strong>
                    </button>
                    <DeleteButton
                      label="移除收藏"
                      onClick={() =>
                        setFavorites((xs) =>
                          xs.filter((x) => !(x.cat === f.cat && x.from === f.from && x.to === f.to)),
                        )
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="panel uc-history">
            <div className="uc-panel-head">
              <h3 className="uc-panel-title">最近紀錄</h3>
              {!!history.length && (
                <ActionButton
                  className="btn ghost sm"
                  onClick={() => {
                    if (confirm('確定清除最近紀錄？')) setHistory([])
                  }}
                >
                  清除
                </ActionButton>
              )}
            </div>
            {!history.length && <p className="muted">複製結果後會出現在這裡</p>}
            <ul className="uc-side-list">
              {history.map((h) => {
                const fu = UNITS[h.cat]?.find((u) => u.id === h.from)
                const tu = UNITS[h.cat]?.find((u) => u.id === h.to)
                if (!fu || !tu) return null
                return (
                  <li key={h.id} className="uc-side-item">
                    <button
                      type="button"
                      className="uc-side-main"
                      onClick={() => {
                        setError('')
                        setDraft(null)
                        setToDraft(null)
                        setPrefs({
                          cat: h.cat,
                          from: h.from,
                          to: h.to,
                          value: h.value,
                          precision,
                        })
                      }}
                    >
                      <strong className="mono">
                        {formatNum(h.value, 'auto')} {fu.short} → {formatNum(h.result, 'auto')}{' '}
                        {tu.short}
                      </strong>
                      <span className="muted">
                        {new Date(h.at).toLocaleString('zh-TW', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                    <DeleteButton
                      label="刪除紀錄"
                      onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
