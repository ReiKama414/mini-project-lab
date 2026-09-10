import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, hexToRgb, limitText, rgbToHex, rgbToHsl } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { DeleteButton } from '../../components/DeleteButton'

const meta = getProject('hex-rgb-hsl')!

const HEX_MAX = 7
const RGB_TEXT_MAX = 48
const HSL_TEXT_MAX = 48
const RECENT_MAX = 16

const PRESETS = [
  '#e9a319',
  '#2a9d8f',
  '#e76f51',
  '#264653',
  '#457b9d',
  '#e63946',
  '#7c3aed',
  '#111827',
  '#f8fafc',
  '#16a34a',
]

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
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

function textOnColor(r: number, g: number, b: number) {
  return relativeLuminance(r, g, b) > 0.179 ? '#111111' : '#ffffff'
}

function shadeHex(hex: string, lightDelta: number) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const out = hslToRgb(hsl.h, hsl.s, clamp(hsl.l + lightDelta, 0, 100))
  return rgbToHex(out.r, out.g, out.b)
}

function parseRgbCss(text: string): { r: number; g: number; b: number } | null {
  const css = text.match(/rgba?\(\s*([\d.]+)\s*[,/\s]\s*([\d.]+)\s*[,/\s]\s*([\d.]+)/i)
  const plain = text.match(/^\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*$/)
  const m = css || plain
  if (!m) return null
  return {
    r: clamp(Math.round(Number(m[1])), 0, 255),
    g: clamp(Math.round(Number(m[2])), 0, 255),
    b: clamp(Math.round(Number(m[3])), 0, 255),
  }
}

function parseHslCss(text: string): { h: number; s: number; l: number } | null {
  const css = text.match(/hsla?\(\s*([\d.]+)\s*[,/\s]\s*([\d.]+)%?\s*[,/\s]\s*([\d.]+)%?/i)
  const plain = text.match(/^\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*$/)
  const m = css || plain
  if (!m) return null
  return {
    h: clamp(Math.round(Number(m[1])), 0, 360),
    s: clamp(Math.round(Number(m[2])), 0, 100),
    l: clamp(Math.round(Number(m[3])), 0, 100),
  }
}

function wcagLabel(ratio: number) {
  if (ratio >= 7) return 'AAA 內文'
  if (ratio >= 4.5) return 'AA 內文'
  if (ratio >= 3) return '大字 AA'
  return '對比不足'
}

function hueName(h: number) {
  const names = [
    [15, '紅'],
    [45, '橙'],
    [70, '黃'],
    [160, '綠'],
    [200, '青'],
    [260, '藍'],
    [300, '紫'],
    [330, '洋紅'],
    [360, '紅'],
  ] as const
  for (const [max, name] of names) {
    if (h <= max) return name
  }
  return '紅'
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

export default function Page() {
  const [hex, setHex] = useLocalStorage('lab:hex-rgb-hsl:hex', '#e9a319')
  const [recent, setRecent] = useLocalStorage<string[]>('lab:hex-rgb-hsl:recent', [])
  const [r, setR] = useState(233)
  const [g, setG] = useState(163)
  const [b, setB] = useState(25)
  const [h, setH] = useState(40)
  const [s, setS] = useState(84)
  const [l, setL] = useState(51)
  const [hexInput, setHexInput] = useState('#e9a319')
  const [rgbInput, setRgbInput] = useState('233, 163, 25')
  const [hslInput, setHslInput] = useState('40, 84%, 51%')
  const [hexError, setHexError] = useState('')
  const [rgbError, setRgbError] = useState('')
  const [hslError, setHslError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const rgb = parseHex(hex)
    if (!rgb) return
    applyRgb(rgb.r, rgb.g, rgb.b, false)
  }, [])

  function pushRecent(hx: string) {
    setRecent((xs) => [hx, ...xs.filter((x) => x !== hx)].slice(0, RECENT_MAX))
  }

  function applyRgb(nr: number, ng: number, nb: number, trackRecent = true) {
    setR(nr)
    setG(ng)
    setB(nb)
    const hx = rgbToHex(nr, ng, nb)
    setHex(hx)
    setHexInput(hx)
    const hsl = rgbToHsl(nr, ng, nb)
    setH(hsl.h)
    setS(hsl.s)
    setL(hsl.l)
    setRgbInput(`${nr}, ${ng}, ${nb}`)
    setHslInput(`${hsl.h}, ${hsl.s}%, ${hsl.l}%`)
    setHexError('')
    setRgbError('')
    setHslError('')
    if (trackRecent) pushRecent(hx)
  }

  function fromHex(v: string) {
    const next = limitText(v, HEX_MAX)
    setHexInput(next)
    const rgb = parseHex(next)
    if (!rgb) {
      setHexError('請輸入有效 HEX（#RGB 或 #RRGGBB）')
      return
    }
    applyRgb(rgb.r, rgb.g, rgb.b)
  }

  function fromRgbText(v: string) {
    const next = limitText(v, RGB_TEXT_MAX)
    setRgbInput(next)
    const parsed = parseRgbCss(next)
    if (!parsed) {
      setRgbError('格式需為 r, g, b 或 rgb(...)')
      return
    }
    applyRgb(parsed.r, parsed.g, parsed.b)
  }

  function fromHslText(v: string) {
    const next = limitText(v, HSL_TEXT_MAX)
    setHslInput(next)
    const parsed = parseHslCss(next)
    if (!parsed) {
      setHslError('格式需為 h, s%, l% 或 hsl(...)')
      return
    }
    const rgb = hslToRgb(parsed.h, parsed.s, parsed.l)
    applyRgb(rgb.r, rgb.g, rgb.b)
  }

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const preview = rgbToHex(r, g, b)
  const textColor = useMemo(() => textOnColor(r, g, b), [r, g, b])
  const lum = useMemo(() => relativeLuminance(r, g, b), [r, g, b])
  const cWhite = useMemo(() => contrastRatio(r, g, b, 'white'), [r, g, b])
  const cBlack = useMemo(() => contrastRatio(r, g, b, 'black'), [r, g, b])
  const hsv = useMemo(() => rgbToHsv(r, g, b), [r, g, b])
  const shades = useMemo(
    () => [-36, -24, -12, 0, 12, 24, 36].map((d) => ({ d, hex: shadeHex(preview, d) })),
    [preview],
  )

  const rgbCss = `rgb(${r}, ${g}, ${b})`
  const rgbModern = `rgb(${r} ${g} ${b})`
  const hslCss = `hsl(${h}, ${s}%, ${l}%)`
  const hslModern = `hsl(${h} ${s}% ${l}%)`
  const hsvCss = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`

  const harmony = useMemo(() => {
    const mk = (hh: number, label: string) => {
      const rgb = hslToRgb(((hh % 360) + 360) % 360, s, l)
      return { label, hex: rgbToHex(rgb.r, rgb.g, rgb.b) }
    }
    return [
      mk(h, '目前'),
      mk(h + 180, '互補'),
      mk(h + 30, '類似 +30°'),
      mk(h - 30, '類似 −30°'),
      mk(h + 120, '三等分 +120°'),
      mk(h - 120, '三等分 −120°'),
    ]
  }, [h, s, l])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row hrh-shell-actions">
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(preview, 'hex')} icon="copy">
            {copied === 'hex' ? '已複製' : '複製 HEX'}
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(rgbCss, 'rgb')} icon="copy">
            {copied === 'rgb' ? '已複製' : '複製 RGB'}
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(hslCss, 'hsl')} icon="copy">
            {copied === 'hsl' ? '已複製' : '複製 HSL'}
          </ActionButton>
        </div>
      }
    >
      <div className="hrh-calc">
        <div className="pw-stats">
          <span className="metric mono">{preview}</span>
          <span className="tag">{hueName(h)}</span>
          <span className="tag">H {h}°</span>
          <span className="tag">S {s}%</span>
          <span className="tag">L {l}%</span>
          <span className="tag">最近 {recent.length}</span>
        </div>

        <div className="hrh-main">
          <section className="panel hrh-settings">
            <h3 className="pw-panel-title">色碼轉換</h3>

            <div className="hrh-picker">
              <div className="label">色票選擇器</div>
              <label className="hrh-picker-stage">
                <span className="hrh-picker-fill" style={{ background: preview }} aria-hidden />
                <input
                  type="color"
                  className="hrh-picker-input"
                  value={preview}
                  onChange={(e) => fromHex(e.target.value)}
                  aria-label="開啟系統色票選擇器"
                />
                <span className="hrh-picker-meta" style={{ color: textColor }}>
                  <span className="hrh-picker-hex mono">{preview}</span>
                  <span className="hrh-picker-hint">點擊調整顏色</span>
                </span>
              </label>
            </div>

            <div className="pw-block">
              <div className="label">快捷色</div>
              <div className="hrh-presets">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`hrh-preset${preview.toLowerCase() === c.toLowerCase() ? ' is-active' : ''}`}
                    style={{ background: c }}
                    title={c}
                    aria-label={`套用 ${c}`}
                    onClick={() => fromHex(c)}
                  />
                ))}
              </div>
            </div>

            <label className="stack">
              <span className="label">HEX</span>
              <div className="row">
                <input
                  className={`field mono${hexError ? ' is-invalid' : ''}`}
                  style={{ flex: 1 }}
                  value={hexInput}
                  maxLength={HEX_MAX}
                  onChange={(e) => fromHex(e.target.value)}
                  spellCheck={false}
                />
                <ActionButton
                  className="btn ghost sm"
                  onClick={() => void copyVal(preview, 'hex')}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'hex' ? '已複製' : '複製'}
                />
              </div>
              <div className="field-meta">
                <span>
                  {hexInput.length} / {HEX_MAX}
                </span>
              </div>
              {hexError && <p className="field-error">{hexError}</p>}
            </label>

            <label className="stack">
              <span className="label">RGB（r, g, b 或 rgb(...)）</span>
              <div className="row">
                <input
                  className={`field mono${rgbError ? ' is-invalid' : ''}`}
                  style={{ flex: 1 }}
                  value={rgbInput}
                  maxLength={RGB_TEXT_MAX}
                  onChange={(e) => fromRgbText(e.target.value)}
                  placeholder="rgb(233, 163, 25)"
                  spellCheck={false}
                />
                <ActionButton
                  className="btn ghost sm"
                  onClick={() => void copyVal(rgbCss, 'rgb')}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'rgb' ? '已複製' : '複製'}
                />
              </div>
              <div className="field-meta">
                <span>
                  {rgbInput.length} / {RGB_TEXT_MAX}
                </span>
              </div>
              {rgbError && <p className="field-error">{rgbError}</p>}
            </label>

            <label className="stack">
              <span className="label">HSL（h, s%, l% 或 hsl(...)）</span>
              <div className="row">
                <input
                  className={`field mono${hslError ? ' is-invalid' : ''}`}
                  style={{ flex: 1 }}
                  value={hslInput}
                  maxLength={HSL_TEXT_MAX}
                  onChange={(e) => fromHslText(e.target.value)}
                  placeholder="hsl(40, 84%, 51%)"
                  spellCheck={false}
                />
                <ActionButton
                  className="btn ghost sm"
                  onClick={() => void copyVal(hslCss, 'hsl')}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'hsl' ? '已複製' : '複製'}
                />
              </div>
              <div className="field-meta">
                <span>
                  {hslInput.length} / {HSL_TEXT_MAX}
                </span>
              </div>
              {hslError && <p className="field-error">{hslError}</p>}
            </label>

            <div className="pw-block">
              <div className="label">RGB 滑桿</div>
              <div className="hrh-sliders">
                {(
                  [
                    ['R', r, 255, `linear-gradient(90deg, #000, rgb(255,${g},${b}))`, (v: number) => applyRgb(v, g, b)],
                    ['G', g, 255, `linear-gradient(90deg, #000, rgb(${r},255,${b}))`, (v: number) => applyRgb(r, v, b)],
                    ['B', b, 255, `linear-gradient(90deg, #000, rgb(${r},${g},255))`, (v: number) => applyRgb(r, g, v)],
                  ] as const
                ).map(([label, val, max, track, set]) => (
                  <label key={label} className="hrh-slider">
                    <span className="hrh-slider-label">
                      <span>{label}</span>
                      <strong className="mono">{val}</strong>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={max}
                      value={val}
                      style={{ background: track }}
                      onChange={(e) => set(Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="pw-block">
              <div className="label">HSL 滑桿</div>
              <div className="hrh-sliders">
                {(() => {
                  const sat0 = hslToRgb(h, 0, l)
                  const sat100 = hslToRgb(h, 100, l)
                  const mid = hslToRgb(h, s, 50)
                  const rows: Array<{
                    label: string
                    val: number
                    max: number
                    unit: string
                    track: string
                    set: (v: number) => void
                  }> = [
                    {
                      label: 'H',
                      val: h,
                      max: 360,
                      unit: '°',
                      track: 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                      set: (v) => {
                        const rgb = hslToRgb(v, s, l)
                        applyRgb(rgb.r, rgb.g, rgb.b)
                      },
                    },
                    {
                      label: 'S',
                      val: s,
                      max: 100,
                      unit: '%',
                      track: `linear-gradient(90deg, ${rgbToHex(sat0.r, sat0.g, sat0.b)}, ${rgbToHex(sat100.r, sat100.g, sat100.b)})`,
                      set: (v) => {
                        const rgb = hslToRgb(h, v, l)
                        applyRgb(rgb.r, rgb.g, rgb.b)
                      },
                    },
                    {
                      label: 'L',
                      val: l,
                      max: 100,
                      unit: '%',
                      track: `linear-gradient(90deg, #000, ${rgbToHex(mid.r, mid.g, mid.b)}, #fff)`,
                      set: (v) => {
                        const rgb = hslToRgb(h, s, v)
                        applyRgb(rgb.r, rgb.g, rgb.b)
                      },
                    },
                  ]
                  return rows.map((row) => (
                    <label key={row.label} className="hrh-slider">
                      <span className="hrh-slider-label">
                        <span>{row.label}</span>
                        <strong className="mono">
                          {row.val}
                          {row.unit}
                        </strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={row.max}
                        value={row.val}
                        style={{ background: row.track }}
                        onChange={(e) => row.set(Number(e.target.value))}
                      />
                    </label>
                  ))
                })()}
              </div>
            </div>

            <div className="hrh-formats">
              {(
                [
                  ['HEX', preview],
                  ['RGB', rgbCss],
                  ['RGB 現代', rgbModern],
                  ['HSL', hslCss],
                  ['HSL 現代', hslModern],
                  ['HSV', hsvCss],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="hrh-format-row">
                  <span className="muted">{label}</span>
                  <code className="mono">{val}</code>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyVal(val, label)}
                    icon="copy"
                    iconOnly
                    tooltip={copied === label ? '已複製' : '複製'}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="hrh-side">
            <section className="panel hrh-contrast">
              <h3 className="pw-panel-title">對比與色階</h3>

              <div className="hrh-contrast-grid">
                <div className="hrh-contrast-card" style={{ background: '#fff', color: preview }}>
                  <div className="muted">對白</div>
                  <strong className="mono">{cWhite.toFixed(2)}:1</strong>
                  <span>{wcagLabel(cWhite)}</span>
                </div>
                <div className="hrh-contrast-card" style={{ background: '#111', color: preview }}>
                  <div className="muted" style={{ color: '#bbb' }}>
                    對黑
                  </div>
                  <strong className="mono">{cBlack.toFixed(2)}:1</strong>
                  <span style={{ color: '#ddd' }}>{wcagLabel(cBlack)}</span>
                </div>
              </div>

              <div className="hrh-sample" style={{ background: preview, color: textColor }}>
                建議文字色 {textColor}
              </div>

              <div className="label">亮度色階</div>
              <div className="hrh-shade-bar">
                {shades.map((item) => (
                  <button
                    key={item.d}
                    type="button"
                    title={item.hex}
                    aria-label={`色階 ${item.d >= 0 ? '+' : ''}${item.d}%：${item.hex}`}
                    onClick={() => fromHex(item.hex)}
                    className={`hrh-shade${item.d === 0 ? ' is-current' : ''}`}
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

              <div className="label">色相和諧</div>
              <div className="hrh-harmony">
                {harmony.map((item) => {
                  const c = parseHex(item.hex)
                  const fg = c ? textOnColor(c.r, c.g, c.b) : '#111'
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="hrh-harmony-swatch"
                      style={{ background: item.hex, color: fg }}
                      onClick={() => fromHex(item.hex)}
                      title={`${item.label} ${item.hex}`}
                    >
                      <span>{item.label}</span>
                      <span className="mono">{item.hex}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="panel hrh-recent">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">最近使用</h3>
                <span className="tag">
                  {recent.length}/{RECENT_MAX}
                </span>
              </div>
              {!recent.length && (
                <p className="muted" style={{ margin: 0 }}>
                  變更顏色後會自動記錄於此（本機）
                </p>
              )}
              <ul className="hrh-recent-list">
                {recent.map((hx) => {
                  const c = parseHex(hx)
                  const fg = c ? textOnColor(c.r, c.g, c.b) : '#111'
                  return (
                    <li key={hx} className="hrh-recent-item">
                      <button
                        type="button"
                        className="hrh-recent-swatch"
                        style={{ background: hx, color: fg }}
                        onClick={() => fromHex(hx)}
                        title={`套用 ${hx}`}
                      >
                        {hx}
                      </button>
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(hx, `recent-${hx}`)}
                        icon="copy"
                        iconOnly
                        tooltip="複製"
                      />
                      <DeleteButton
                        onClick={() => setRecent((xs) => xs.filter((x) => x !== hx))}
                        label="移除"
                      />
                    </li>
                  )
                })}
              </ul>
              {!!recent.length && (
                <ActionButton
                  className="btn sm ghost"
                  onClick={() => {
                    if (confirm('確定清空最近使用？')) setRecent([])
                  }}
                >
                  清空最近
                </ActionButton>
              )}
            </section>
          </div>
        </div>

        <section className="panel hrh-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">色相名稱</span>
              <strong>
                {hueName(h)}（{h}°）
              </strong>
            </li>
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
              <strong className="mono">{hsvCss}</strong>
            </li>
            <li>
              <span className="muted">現代 CSS RGB</span>
              <strong className="mono">{rgbModern}</strong>
            </li>
            <li>
              <span className="muted">現代 CSS HSL</span>
              <strong className="mono">{hslModern}</strong>
            </li>
          </ul>
          <p className="muted pw-hint">
            可貼上 <code>rgb(...)</code>／<code>hsl(...)</code> 或逗號分隔值；色階以 HSL 亮度偏移，和諧色以色相旋轉產生。對比依 WCAG 相對亮度計算。
          </p>
        </section>
      </div>
    </ProjectShell>
  )
}
