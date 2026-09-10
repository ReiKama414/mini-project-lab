import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, hexToRgb, limitText, parseNumber, rgbToHex, rgbToHsl } from '../../lib/utils'

const meta = getProject('color-converter')!

const HEX_MAX = 7
const FAV_CAP = 18

function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  l = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function parseHex(hex: string) {
  const h = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null
  return hexToRgb(`#${h}`)
}

function relativeLuminance(r: number, g: number, b: number) {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrastRatio(r: number, g: number, b: number, against: 'white' | 'black') {
  const L1 = relativeLuminance(r, g, b)
  const L2 = against === 'white' ? 1 : 0
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

function shadeHex(hex: string, lightDelta: number) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const nl = clamp(hsl.l + lightDelta, 0, 100)
  const out = hslToRgb(hsl.h, hsl.s, nl)
  return rgbToHex(out.r, out.g, out.b)
}

function rgbToHsv(r: number, g: number, b: number) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(max * 100) }
}

function rgbToCmyk(r: number, g: number, b: number) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const k = 1 - Math.max(rr, gg, bb)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = Math.round(((1 - rr - k) / (1 - k)) * 100)
  const m = Math.round(((1 - gg - k) / (1 - k)) * 100)
  const y = Math.round(((1 - bb - k) / (1 - k)) * 100)
  return { c, m, y, k: Math.round(k * 100) }
}

function wcagLabel(ratio: number) {
  if (ratio >= 7) return 'AAA 內文'
  if (ratio >= 4.5) return 'AA 內文'
  if (ratio >= 3) return '大字 AA'
  return '對比不足'
}

function textOnColor(r: number, g: number, b: number) {
  // 亮底用深字、暗底用淺字（相對亮度門檻約對應 WCAG）
  return relativeLuminance(r, g, b) > 0.179 ? '#111111' : '#ffffff'
}

const PRESET_COLORS = [
  '#2a9d8f',
  '#e76f51',
  '#264653',
  '#e9c46a',
  '#f4a261',
  '#1d3557',
  '#457b9d',
  '#a8dadc',
  '#e63946',
  '#111827',
  '#f8fafc',
  '#7c3aed',
]

export default function Page() {
  const [hex, setHex] = useLocalStorage('lab:color-converter:hex', '#2a9d8f')
  const [favorites, setFavorites] = useLocalStorage<string[]>('lab:color-converter:favorites', [])
  const [r, setR] = useState(42)
  const [g, setG] = useState(157)
  const [b, setB] = useState(143)
  const [h, setH] = useState(172)
  const [s, setS] = useState(58)
  const [l, setL] = useState(39)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const rgb = parseHex(hex)
    if (!rgb) return
    setR(rgb.r)
    setG(rgb.g)
    setB(rgb.b)
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
    setH(hsl.h)
    setS(hsl.s)
    setL(hsl.l)
  }, [])

  function syncFromRgb(nr: number, ng: number, nb: number) {
    setR(nr)
    setG(ng)
    setB(nb)
    const hx = rgbToHex(nr, ng, nb)
    setHex(hx)
    const hsl = rgbToHsl(nr, ng, nb)
    setH(hsl.h)
    setS(hsl.s)
    setL(hsl.l)
  }

  function fromHex(v: string) {
    setHex(v)
    const rgb = parseHex(v)
    if (!rgb) return
    syncFromRgb(rgb.r, rgb.g, rgb.b)
  }

  function fromHsl(nh: number, ns: number, nl: number) {
    setH(nh)
    setS(ns)
    setL(nl)
    const rgb = hslToRgb(nh, ns, nl)
    syncFromRgb(rgb.r, rgb.g, rgb.b)
  }

  const valid = !!parseHex(hex)
  const hexNorm = valid ? rgbToHex(r, g, b) : hex
  const rgbStr = `rgb(${r}, ${g}, ${b})`
  const hslStr = `hsl(${h}, ${s}%, ${l}%)`
  const hsv = useMemo(() => rgbToHsv(r, g, b), [r, g, b])
  const cmyk = useMemo(() => rgbToCmyk(r, g, b), [r, g, b])
  const hsvStr = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`
  const cmykStr = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`
  const lum = useMemo(() => relativeLuminance(r, g, b), [r, g, b])
  const cWhite = useMemo(() => contrastRatio(r, g, b, 'white'), [r, g, b])
  const cBlack = useMemo(() => contrastRatio(r, g, b, 'black'), [r, g, b])
  const textColor = useMemo(() => textOnColor(r, g, b), [r, g, b])
  const shades = useMemo(
    () => [-40, -25, -12, 0, 12, 25, 40].map((d) => ({ d, hex: shadeHex(hexNorm, d) })),
    [hexNorm],
  )

  function toggleFavorite() {
    if (!valid) return
    setFavorites((xs) => {
      const next = xs.includes(hexNorm) ? xs.filter((x) => x !== hexNorm) : [hexNorm, ...xs]
      return next.slice(0, FAV_CAP)
    })
  }

  function removeFavorite(fav: string) {
    setFavorites((xs) => xs.filter((x) => x !== fav))
  }

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const isFav = valid && favorites.includes(hexNorm)

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row cc-shell-actions">
          <ActionButton className={`btn sm ${isFav ? 'teal' : 'ghost'}`} disabled={!valid} onClick={toggleFavorite}>
            {isFav ? '已收藏' : '加入收藏'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!valid}
            onClick={() => void copyVal(hexNorm, 'hex')}
            icon="copy"
          >
            {copied === 'hex' ? '已複製' : '複製 HEX'}
          </ActionButton>
        </div>
      }
    >
      <div className="cc-calc">
        <div className="pw-stats">
          <span className="metric mono">{valid ? hexNorm : '—'}</span>
          <span className="tag">{valid ? rgbStr : '無效 HEX'}</span>
          <span className="tag">收藏 {favorites.length}/{FAV_CAP}</span>
        </div>

        <div className="cc-main">
          <section className="panel cc-settings">
            <h3 className="pw-panel-title">色碼轉換</h3>

            <div className="cc-picker">
              <div className="label">色票選擇器</div>
              <label className="cc-picker-stage">
                <span
                  className="cc-picker-fill"
                  style={{ background: valid ? hexNorm : '#d1d5db' }}
                  aria-hidden
                />
                <input
                  type="color"
                  className="cc-picker-input"
                  value={valid ? hexNorm : '#000000'}
                  onChange={(e) => fromHex(e.target.value)}
                  aria-label="開啟系統色票選擇器"
                />
                <span className="cc-picker-meta" style={{ color: textColor }}>
                  <span className="cc-picker-hex mono">{valid ? hexNorm : '無效顏色'}</span>
                  <span className="cc-picker-hint">點擊調整顏色</span>
                </span>
              </label>
              <div className="cc-hex-row">
                <label className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span className="label">HEX</span>
                  <div className="row">
                    <input
                      className={`field mono${!valid ? ' is-invalid' : ''}`}
                      style={{ flex: 1 }}
                      value={hex}
                      maxLength={HEX_MAX}
                      onChange={(e) => fromHex(limitText(e.target.value, HEX_MAX))}
                    />
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => void copyVal(hexNorm, 'hex')}
                      disabled={!valid}
                      icon="copy"
                      iconOnly
                      tooltip="複製"
                    />
                  </div>
                  {!valid && <p className="field-error">請輸入有效 HEX（#RGB 或 #RRGGBB）</p>}
                </label>
              </div>
            </div>

            <div className="pw-block">
              <div className="label">快捷色</div>
              <div className="cc-presets">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cc-preset${hexNorm.toLowerCase() === c.toLowerCase() ? ' is-active' : ''}`}
                    style={{ background: c }}
                    title={c}
                    aria-label={`套用 ${c}`}
                    onClick={() => fromHex(c)}
                  />
                ))}
              </div>
            </div>

            <div className="cc-fields-3">
              {(
                [
                  ['R', r, (v: number) => syncFromRgb(v, g, b)],
                  ['G', g, (v: number) => syncFromRgb(r, v, b)],
                  ['B', b, (v: number) => syncFromRgb(r, g, v)],
                ] as const
              ).map(([label, val, set]) => (
                <label key={label} className="stack">
                  <span className="label">{label}</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={255}
                    value={val}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      set(clamp(n, 0, 255))
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="cc-fields-3">
              {(
                [
                  ['H°', h, 360, (v: number) => fromHsl(v, s, l)],
                  ['S%', s, 100, (v: number) => fromHsl(h, v, l)],
                  ['L%', l, 100, (v: number) => fromHsl(h, s, v)],
                ] as const
              ).map(([label, val, max, set]) => (
                <label key={label} className="stack">
                  <span className="label">{label}</span>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={max}
                    value={val}
                    onChange={(e) => {
                      const n = parseNumber(e.target.value)
                      if (!Number.isFinite(n)) return
                      set(clamp(n, 0, max))
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="pw-actions">
              <ActionButton className={`btn ${isFav ? 'teal' : 'ghost'}`} disabled={!valid} onClick={toggleFavorite}>
                {isFav ? '已收藏' : '加入收藏'}
              </ActionButton>
            </div>

            <div className="cc-formats">
              {(
                [
                  ['HEX', hexNorm],
                  ['RGB', rgbStr],
                  ['HSL', hslStr],
                  ['HSV', hsvStr],
                  ['CMYK', cmykStr],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="cc-format-row">
                  <span className="muted">{label}</span>
                  <code className="mono">{val}</code>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!valid}
                    onClick={() => void copyVal(val, label)}
                    icon="copy"
                    iconOnly
                    tooltip={copied === label ? '已複製' : '複製'}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="cc-side">
            <section className="panel cc-contrast">
              <h3 className="pw-panel-title">對比與色階</h3>

              <div className="cc-contrast-grid">
                <div className="cc-contrast-card" style={{ background: '#fff', color: valid ? hexNorm : '#999' }}>
                  <div className="muted">對白</div>
                  <strong className="mono">{cWhite.toFixed(2)}:1</strong>
                  <span>{wcagLabel(cWhite)}</span>
                </div>
                <div className="cc-contrast-card" style={{ background: '#111', color: valid ? hexNorm : '#888' }}>
                  <div className="muted" style={{ color: '#bbb' }}>
                    對黑
                  </div>
                  <strong className="mono">{cBlack.toFixed(2)}:1</strong>
                  <span style={{ color: '#ddd' }}>{wcagLabel(cBlack)}</span>
                </div>
              </div>

              <div
                className="cc-sample"
                style={{ background: valid ? hexNorm : '#ccc', color: textColor }}
              >
                建議文字色 {textColor}
              </div>

              <div className="label">亮度色階</div>
              <div className="cc-shade-bar">
                {shades.map((item) => (
                  <button
                    key={item.d}
                    type="button"
                    title={item.hex}
                    aria-label={`色階 ${item.d >= 0 ? '+' : ''}${item.d}%：${item.hex}`}
                    onClick={() => fromHex(item.hex)}
                    className={`cc-shade${item.d === 0 ? ' is-current' : ''}`}
                    style={{ background: item.hex }}
                  />
                ))}
              </div>
              <div className="pw-chips">
                {shades.map((item) => (
                  <button
                    key={item.d}
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void copyVal(item.hex, `shade-${item.d}`)}
                  >
                    {item.d === 0 ? '目前' : `${item.d > 0 ? '+' : ''}${item.d}`}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel cc-favorites">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">收藏色票</h3>
                <span className="tag">
                  {favorites.length}/{FAV_CAP}
                </span>
              </div>
              {!favorites.length && (
                <p className="muted" style={{ margin: 0 }}>
                  點「加入收藏」把目前顏色存到本機
                </p>
              )}
              <ul className="cc-fav-list">
                {favorites.map((fav) => {
                  const c = parseHex(fav)
                  const fg = c ? textOnColor(c.r, c.g, c.b) : '#111'
                  return (
                    <li key={fav} className="cc-fav-item">
                      <button
                        type="button"
                        className="cc-fav-swatch"
                        style={{ background: fav, color: fg }}
                        onClick={() => fromHex(fav)}
                        title={`套用 ${fav}`}
                      >
                        {fav}
                      </button>
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(fav, `fav-${fav}`)}
                        icon="copy"
                        iconOnly
                        tooltip="複製"
                      />
                      <DeleteButton onClick={() => removeFavorite(fav)} label="移除收藏" />
                    </li>
                  )
                })}
              </ul>
              {!!favorites.length && (
                <ActionButton
                  className="btn sm ghost"
                  onClick={() => {
                    if (confirm('確定清空全部收藏？')) setFavorites([])
                  }}
                >
                  清空收藏
                </ActionButton>
              )}
            </section>
          </div>
        </div>

        <section className="panel cc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">相對亮度</span>
              <strong className="mono">{lum.toFixed(4)}</strong>
            </li>
            <li>
              <span className="muted">建議文字色</span>
              <strong className="mono">{textColor}</strong>
            </li>
            <li>
              <span className="muted">對白 WCAG</span>
              <strong>
                {cWhite.toFixed(2)}:1 · {wcagLabel(cWhite)}
              </strong>
            </li>
            <li>
              <span className="muted">對黑 WCAG</span>
              <strong>
                {cBlack.toFixed(2)}:1 · {wcagLabel(cBlack)}
              </strong>
            </li>
            <li>
              <span className="muted">HSV</span>
              <strong className="mono">{hsvStr}</strong>
            </li>
            <li>
              <span className="muted">CMYK</span>
              <strong className="mono">{cmykStr}</strong>
            </li>
          </ul>
          <p className="muted pw-hint">
            對比依 WCAG 相對亮度計算；色階以 HSL 亮度偏移產生，點色塊可套用。
          </p>
        </section>
      </div>
    </ProjectShell>
  )
}
