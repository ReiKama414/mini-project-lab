import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, hexToRgb, rgbToHex, rgbToHsl } from '../../lib/utils'

const meta = getProject('color-converter')!

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

export default function Page() {
  const [hex, setHex] = useLocalStorage('lab:color-converter:hex', '#2a9d8f')
  const [r, setR] = useState(42)
  const [g, setG] = useState(157)
  const [b, setB] = useState(143)
  const [h, setH] = useState(172)
  const [s, setS] = useState(58)
  const [l, setL] = useState(39)

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
  const cWhite = useMemo(() => contrastRatio(r, g, b, 'white'), [r, g, b])
  const cBlack = useMemo(() => contrastRatio(r, g, b, 'black'), [r, g, b])
  const shades = useMemo(
    () => [-40, -25, -12, 0, 12, 25, 40].map((d) => ({ d, hex: shadeHex(hexNorm, d) })),
    [hexNorm],
  )

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <label className="stack" style={{ flex: 1 }}>
              <span className="label">色票選擇器</span>
              <input
                type="color"
                value={valid ? hexNorm : '#000000'}
                onChange={(e) => fromHex(e.target.value)}
                style={{ width: '100%', height: 48, border: 'none', cursor: 'pointer' }}
              />
            </label>
            <label className="stack" style={{ flex: 1 }}>
              <span className="label">HEX</span>
              <div className="row">
                <input className="field mono" style={{ flex: 1 }} value={hex} onChange={(e) => fromHex(e.target.value)} />
                <button className="btn sm ghost" onClick={() => void copyText(hexNorm)}>
                  複製
                </button>
              </div>
            </label>
          </div>
          <div
            style={{
              height: 88,
              borderRadius: 12,
              background: valid ? hexNorm : '#ccc',
              border: '1px solid var(--border)',
            }}
          />
          <div className="grid-3">
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
                  onChange={(e) => set(clamp(Number(e.target.value), 0, 255))}
                />
              </label>
            ))}
          </div>
          <div className="grid-3">
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
                  onChange={(e) => set(clamp(Number(e.target.value), 0, max))}
                />
              </label>
            ))}
          </div>
          <div className="stack">
            {(
              [
                ['HEX', hexNorm],
                ['RGB', rgbStr],
                ['HSL', hslStr],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="row list-item" style={{ padding: '6px 0' }}>
                <span className="muted" style={{ width: 40 }}>
                  {label}
                </span>
                <code className="mono" style={{ flex: 1 }}>
                  {val}
                </code>
                <button className="btn sm ghost" onClick={() => void copyText(val)}>
                  複製
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <h3>對比與色階</h3>
          <div className="grid-2">
            <div className="metric">
              <div className="muted">對白對比</div>
              <div className="mono" style={{ fontSize: 22 }}>
                {cWhite.toFixed(2)}:1
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                {cWhite >= 4.5 ? '達 AA 內文' : cWhite >= 3 ? '達大字 AA' : '對比不足'}
              </p>
            </div>
            <div className="metric">
              <div className="muted">對黑對比</div>
              <div className="mono" style={{ fontSize: 22 }}>
                {cBlack.toFixed(2)}:1
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                {cBlack >= 4.5 ? '達 AA 內文' : cBlack >= 3 ? '達大字 AA' : '對比不足'}
              </p>
            </div>
          </div>
          <div
            className="row"
            style={{
              gap: 0,
              height: 56,
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            {shades.map((s) => (
              <button
                key={s.d}
                title={s.hex}
                onClick={() => fromHex(s.hex)}
                style={{
                  flex: 1,
                  height: '100%',
                  background: s.hex,
                  border: 'none',
                  cursor: 'pointer',
                  outline: s.d === 0 ? '2px solid var(--accent)' : undefined,
                  outlineOffset: -2,
                }}
              />
            ))}
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {shades.map((s) => (
              <button key={s.d} className="btn sm ghost" onClick={() => void copyText(s.hex)}>
                {s.hex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
