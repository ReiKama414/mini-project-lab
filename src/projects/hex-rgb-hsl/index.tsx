import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, hexToRgb, rgbToHex, rgbToHsl } from '../../lib/utils'

const meta = getProject('hex-rgb-hsl')!

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

function shadeHex(hex: string, lightDelta: number) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const out = hslToRgb(hsl.h, hsl.s, clamp(hsl.l + lightDelta, 0, 100))
  return rgbToHex(out.r, out.g, out.b)
}

export default function Page() {
  const [hex, setHex] = useLocalStorage('lab:hex-rgb-hsl:hex', '#e9a319')
  const [r, setR] = useState(233)
  const [g, setG] = useState(163)
  const [b, setB] = useState(25)
  const [h, setH] = useState(40)
  const [s, setS] = useState(84)
  const [l, setL] = useState(51)
  const [hexInput, setHexInput] = useState('#e9a319')
  const [rgbInput, setRgbInput] = useState('233, 163, 25')
  const [hslInput, setHslInput] = useState('40, 84%, 51%')

  useEffect(() => {
    const rgb = parseHex(hex)
    if (!rgb) return
    applyRgb(rgb.r, rgb.g, rgb.b)
  }, [])

  function applyRgb(nr: number, ng: number, nb: number) {
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
  }

  function fromHex(v: string) {
    setHexInput(v)
    const rgb = parseHex(v)
    if (!rgb) return
    applyRgb(rgb.r, rgb.g, rgb.b)
  }

  function fromRgbText(v: string) {
    setRgbInput(v)
    const m = v.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (!m) return
    applyRgb(clamp(+m[1]!, 0, 255), clamp(+m[2]!, 0, 255), clamp(+m[3]!, 0, 255))
  }

  function fromHslText(v: string) {
    setHslInput(v)
    const m = v.match(/(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/)
    if (!m) return
    const nh = clamp(+m[1]!, 0, 360)
    const ns = clamp(+m[2]!, 0, 100)
    const nl = clamp(+m[3]!, 0, 100)
    const rgb = hslToRgb(nh, ns, nl)
    applyRgb(rgb.r, rgb.g, rgb.b)
  }

  const preview = rgbToHex(r, g, b)
  const cWhite = useMemo(() => contrastRatio(r, g, b, 'white'), [r, g, b])
  const cBlack = useMemo(() => contrastRatio(r, g, b, 'black'), [r, g, b])
  const shades = useMemo(
    () => [-36, -24, -12, 0, 12, 24, 36].map((d) => shadeHex(preview, d)),
    [preview],
  )

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <input
              type="color"
              value={preview}
              onChange={(e) => fromHex(e.target.value)}
              style={{ width: 64, height: 64, border: 'none', cursor: 'pointer', borderRadius: 8 }}
            />
            <div
              style={{
                flex: 1,
                height: 64,
                borderRadius: 12,
                background: preview,
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <label className="stack">
            <span className="label">HEX</span>
            <div className="row">
              <input className="field mono" style={{ flex: 1 }} value={hexInput} onChange={(e) => fromHex(e.target.value)} />
              <button className="btn ghost sm" onClick={() => void copyText(preview)}>
                複製
              </button>
            </div>
          </label>
          <label className="stack">
            <span className="label">RGB（r, g, b）</span>
            <div className="row">
              <input className="field mono" style={{ flex: 1 }} value={rgbInput} onChange={(e) => fromRgbText(e.target.value)} />
              <button className="btn ghost sm" onClick={() => void copyText(`rgb(${r}, ${g}, ${b})`)}>
                複製
              </button>
            </div>
          </label>
          <label className="stack">
            <span className="label">HSL（h, s%, l%）</span>
            <div className="row">
              <input className="field mono" style={{ flex: 1 }} value={hslInput} onChange={(e) => fromHslText(e.target.value)} />
              <button className="btn ghost sm" onClick={() => void copyText(`hsl(${h}, ${s}%, ${l}%)`)}>
                複製
              </button>
            </div>
          </label>
          <div className="grid-3">
            {(
              [
                ['R', r, 255, (v: number) => applyRgb(v, g, b)],
                ['G', g, 255, (v: number) => applyRgb(r, v, b)],
                ['B', b, 255, (v: number) => applyRgb(r, g, v)],
              ] as const
            ).map(([label, val, max, set]) => (
              <label key={label} className="stack">
                <span className="label">
                  {label}：{val}
                </span>
                <input
                  className="field"
                  type="range"
                  min={0}
                  max={max}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <div className="grid-3">
            {(
              [
                ['H', h, 360, (v: number) => {
                  const rgb = hslToRgb(v, s, l)
                  applyRgb(rgb.r, rgb.g, rgb.b)
                }],
                ['S', s, 100, (v: number) => {
                  const rgb = hslToRgb(h, v, l)
                  applyRgb(rgb.r, rgb.g, rgb.b)
                }],
                ['L', l, 100, (v: number) => {
                  const rgb = hslToRgb(h, s, v)
                  applyRgb(rgb.r, rgb.g, rgb.b)
                }],
              ] as const
            ).map(([label, val, max, set]) => (
              <label key={label} className="stack">
                <span className="label">
                  {label}：{val}
                  {label === 'H' ? '°' : '%'}
                </span>
                <input
                  className="field"
                  type="range"
                  min={0}
                  max={max}
                  value={val}
                  onChange={(e) => set(Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <h3>對比度（WCAG）</h3>
          <div className="grid-2">
            <div
              className="metric"
              style={{ background: '#fff', color: preview, border: '1px solid var(--border)' }}
            >
              白底文字
              <div className="mono">{cWhite.toFixed(2)}:1</div>
            </div>
            <div className="metric" style={{ background: '#111', color: preview }}>
              黑底文字
              <div className="mono">{cBlack.toFixed(2)}:1</div>
            </div>
          </div>
          <h3>色階</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {shades.map((hx) => (
              <button
                key={hx}
                className="btn sm ghost"
                style={{
                  background: hx,
                  color: (() => {
                    const c = hexToRgb(hx)
                    return contrastRatio(c.r, c.g, c.b, 'white') > 3 ? '#111' : '#fff'
                  })(),
                  minWidth: 88,
                }}
                onClick={() => {
                  fromHex(hx)
                  void copyText(hx)
                }}
              >
                {hx}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            點色階可套用並複製 HEX。上次顏色：{hex}
          </p>
        </div>
      </div>
    </ProjectShell>
  )
}
