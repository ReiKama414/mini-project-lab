import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, hexToRgb, rgbToHex, rgbToHsl, clamp } from '../../lib/utils'

const meta: ProjectMeta = getProject('color-palette') ?? {
  slug: 'color-palette',
  title: '色彩色盤',
  description: '由基準色產生色階色盤。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0,
    g = 0,
    b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export default function Page() {
  const [base, setBase] = useLocalStorage('lab:color-palette:base', '#2a9d8f')
  const [copied, setCopied] = useState('')

  const shades = useMemo(() => {
    try {
      const { r, g, b } = hexToRgb(base)
      const { h, s } = rgbToHsl(r, g, b)
      return [10, 20, 30, 40, 50, 60, 70, 80, 90].map((l) => {
        const rgb = hslToRgb(h, s, l)
        return { l, hex: rgbToHex(rgb.r, rgb.g, rgb.b) }
      })
    } catch {
      return []
    }
  }, [base])

  const cssVars = shades.map((s) => `  --shade-${s.l}: ${s.hex};`).join('\n')
  const exportCss = `:root {\n${cssVars}\n}\n`

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          依基準色色相／飽和度產生明度階（HSL）。近似示意，非正式設計系統色票。
        </p>
        <label className="stack">
          <span className="label">基準色</span>
          <input type="color" value={base} onChange={(e) => setBase(e.target.value)} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
          {shades.map(({ hex, l }) => (
            <button
              key={hex + l}
              type="button"
              className="btn ghost"
              style={{ background: hex, height: 72, borderColor: 'var(--border)' }}
              onClick={async () => {
                await copyText(hex)
                setCopied(hex)
              }}
            >
              <span
                style={{
                  color:
                    clamp(hexToRgb(hex).r * 0.3 + hexToRgb(hex).g * 0.6 + hexToRgb(hex).b * 0.1, 0, 255) > 140
                      ? '#111'
                      : '#fff',
                  fontSize: 12,
                }}
                className="mono"
              >
                {copied === hex ? '已複製' : hex}
              </span>
            </button>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={!shades.length}
            onClick={async () => {
              await copyText(exportCss)
              setCopied('all')
            }}
          >
            {copied === 'all' ? '已複製' : '複製 CSS 變數'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!shades.length}
            onClick={() => downloadText('palette.css', exportCss, 'text/css')}
          >
            下載
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
