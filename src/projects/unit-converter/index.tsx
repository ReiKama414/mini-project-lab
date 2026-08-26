import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber } from '../../lib/utils'

const meta = getProject('unit-converter')!

const VALUE_MIN = -1e15
const VALUE_MAX = 1e15

type Category = 'length' | 'weight' | 'temp' | 'volume' | 'data'

type Unit = {
  id: string
  label: string
  toBase: (n: number) => number
  fromBase: (n: number) => number
}

const UNITS: Record<Category, Unit[]> = {
  length: [
    { id: 'm', label: '公尺 (m)', toBase: (n) => n, fromBase: (n) => n },
    { id: 'km', label: '公里 (km)', toBase: (n) => n * 1000, fromBase: (n) => n / 1000 },
    { id: 'cm', label: '公分 (cm)', toBase: (n) => n / 100, fromBase: (n) => n * 100 },
    { id: 'mm', label: '毫米 (mm)', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'mi', label: '英里 (mi)', toBase: (n) => n * 1609.344, fromBase: (n) => n / 1609.344 },
    { id: 'yd', label: '碼 (yd)', toBase: (n) => n * 0.9144, fromBase: (n) => n / 0.9144 },
    { id: 'ft', label: '英尺 (ft)', toBase: (n) => n * 0.3048, fromBase: (n) => n / 0.3048 },
    { id: 'in', label: '英寸 (in)', toBase: (n) => n * 0.0254, fromBase: (n) => n / 0.0254 },
  ],
  weight: [
    { id: 'kg', label: '公斤 (kg)', toBase: (n) => n, fromBase: (n) => n },
    { id: 'g', label: '公克 (g)', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'mg', label: '毫克 (mg)', toBase: (n) => n / 1e6, fromBase: (n) => n * 1e6 },
    { id: 'lb', label: '磅 (lb)', toBase: (n) => n * 0.45359237, fromBase: (n) => n / 0.45359237 },
    { id: 'oz', label: '盎司 (oz)', toBase: (n) => n * 0.0283495231, fromBase: (n) => n / 0.0283495231 },
    { id: 'st', label: '英石 (st)', toBase: (n) => n * 6.35029318, fromBase: (n) => n / 6.35029318 },
  ],
  temp: [
    { id: 'c', label: '攝氏 (°C)', toBase: (n) => n, fromBase: (n) => n },
    { id: 'f', label: '華氏 (°F)', toBase: (n) => ((n - 32) * 5) / 9, fromBase: (n) => (n * 9) / 5 + 32 },
    { id: 'k', label: '克氏 (K)', toBase: (n) => n - 273.15, fromBase: (n) => n + 273.15 },
  ],
  volume: [
    { id: 'l', label: '公升 (L)', toBase: (n) => n, fromBase: (n) => n },
    { id: 'ml', label: '毫升 (mL)', toBase: (n) => n / 1000, fromBase: (n) => n * 1000 },
    { id: 'gal', label: '美制加侖', toBase: (n) => n * 3.785411784, fromBase: (n) => n / 3.785411784 },
    { id: 'cup', label: '美制杯', toBase: (n) => n * 0.2365882365, fromBase: (n) => n / 0.2365882365 },
    { id: 'tbsp', label: '湯匙', toBase: (n) => n * 0.0147867648, fromBase: (n) => n / 0.0147867648 },
  ],
  data: [
    { id: 'b', label: 'Byte', toBase: (n) => n, fromBase: (n) => n },
    { id: 'kb', label: 'KB (10³)', toBase: (n) => n * 1e3, fromBase: (n) => n / 1e3 },
    { id: 'mb', label: 'MB (10⁶)', toBase: (n) => n * 1e6, fromBase: (n) => n / 1e6 },
    { id: 'gb', label: 'GB (10⁹)', toBase: (n) => n * 1e9, fromBase: (n) => n / 1e9 },
    { id: 'kib', label: 'KiB (2¹⁰)', toBase: (n) => n * 1024, fromBase: (n) => n / 1024 },
    { id: 'mib', label: 'MiB (2²⁰)', toBase: (n) => n * 1024 ** 2, fromBase: (n) => n / 1024 ** 2 },
    { id: 'gib', label: 'GiB (2³⁰)', toBase: (n) => n * 1024 ** 3, fromBase: (n) => n / 1024 ** 3 },
  ],
}

const CAT_LABEL: Record<Category, string> = {
  length: '長度',
  weight: '重量',
  temp: '溫度',
  volume: '容量',
  data: '資料量',
}

type Prefs = { cat: Category; from: string; to: string; value: number }

export default function Page() {
  const [prefs, setPrefs] = useLocalStorage<Prefs>('lab:unit-converter', {
    cat: 'length',
    from: 'm',
    to: 'km',
    value: 1,
  })
  const cat = (UNITS[prefs.cat] ? prefs.cat : 'length') as Category
  const units = UNITS[cat]
  const from = units.some((u) => u.id === prefs.from) ? prefs.from : units[0]!.id
  const to = units.some((u) => u.id === prefs.to) ? prefs.to : units[1]!.id
  const value = Number.isFinite(prefs.value) ? prefs.value : 1
  const [error, setError] = useState('')

  const result = useMemo(() => {
    if (error || !Number.isFinite(value)) return NaN
    const a = units.find((u) => u.id === from)
    const b = units.find((u) => u.id === to)
    if (!a || !b) return 0
    let base = a.toBase(value)
    if (cat === 'temp' && from === 'k' && value < 0) return NaN
    if (cat === 'temp') base = Math.max(base, -273.15)
    return b.fromBase(base)
  }, [units, from, to, value, error, cat])

  const allResults = useMemo(() => {
    if (error || !Number.isFinite(value) || !Number.isFinite(result)) return []
    const a = units.find((u) => u.id === from)
    if (!a) return []
    let base = a.toBase(value)
    if (cat === 'temp') base = Math.max(base, -273.15)
    return units.map((u) => ({ id: u.id, label: u.label, value: u.fromBase(base) }))
  }, [units, from, value, error, result, cat])

  function changeCat(c: Category) {
    setPrefs({ cat: c, from: UNITS[c][0]!.id, to: UNITS[c][1]!.id, value })
  }

  function onValueChange(raw: string) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setError('請輸入有效數字')
      return
    }
    if (cat === 'temp' && from === 'k' && n < 0) {
      setError('克氏溫度不可為負')
      return
    }
    setError('')
    setPrefs({ cat, from, to, value: clamp(n, VALUE_MIN, VALUE_MAX) })
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(CAT_LABEL) as Category[]).map((id) => (
              <button
                key={id}
                className={`btn sm ${cat === id ? 'accent' : 'ghost'}`}
                onClick={() => changeCat(id)}
              >
                {CAT_LABEL[id]}
              </button>
            ))}
          </div>
          <label className="stack">
            <span className="label">數值</span>
            <input
              className={`field${error ? ' is-invalid' : ''}`}
              type="number"
              min={VALUE_MIN}
              max={VALUE_MAX}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
            />
            {error && <p className="field-error">{error}</p>}
            <p className="field-hint">範圍約 ±1e15</p>
          </label>
          <div className="grid-2">
            <label className="stack">
              <span className="label">從</span>
              <select
                className="field"
                value={from}
                onChange={(e) => setPrefs({ cat, from: e.target.value, to, value })}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span className="label">到</span>
              <select
                className="field"
                value={to}
                onChange={(e) => setPrefs({ cat, from, to: e.target.value, value })}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="btn ghost sm"
            onClick={() => setPrefs({ cat, from: to, to: from, value })}
          >
            ⇄ 交換單位
          </button>
          <div className="metric" style={{ fontSize: 28 }}>
            {Number.isFinite(result)
              ? result.toLocaleString(undefined, { maximumFractionDigits: 8 })
              : '—'}
          </div>
          <button
            className="btn ghost"
            disabled={!Number.isFinite(result)}
            onClick={() =>
              void copyText(
                `${value} ${from} = ${result.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${to}`,
              )
            }
          >
            複製結果
          </button>
        </div>
        <div className="panel stack">
          <h3>同分類一覽</h3>
          <ul className="list">
            {allResults.map((r) => (
              <li key={r.id} className="list-item">
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ flex: 1, justifyContent: 'flex-start' }}
                  onClick={() => setPrefs({ cat, from, to: r.id, value })}
                  title="設為目標單位"
                >
                  {r.label}
                </button>
                <strong className="mono">
                  {r.value.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </strong>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() =>
                    void copyText(
                      `${value} ${from} = ${r.value.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${r.id}`,
                    )
                  }
                >
                  複製
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
