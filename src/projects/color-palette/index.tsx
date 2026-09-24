import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, hexToRgb, rgbToHex, rgbToHsl, clamp } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'color-palette',
  title: '色彩色盤',
  description: '由基準色衍生 HSL 明度階色盤與 CSS 變數',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('color-palette') ?? fallback

const BASE_PRESETS = [
  { label: '青綠', hex: '#2a9d8f' },
  { label: '琥珀', hex: '#e9a319' },
  { label: '珊瑚', hex: '#e76f51' },
  { label: '靛藍', hex: '#264653' },
]

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
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

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
  const exportJson = JSON.stringify(
    Object.fromEntries(shades.map((s) => [`shade-${s.l}`, s.hex])),
    null,
    2,
  )

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!shades.length}
            onClick={() => void copyVal(exportCss, 'css')}
            icon="copy"
          >
            {copied === 'css' ? '已複製' : '複製 CSS'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!shades.length}
            onClick={() => downloadText('palette.css', exportCss, 'text/css')}
            icon="download"
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag mono">{base}</span>
              <span className="tag">{shades.length} 色階</span>
            </div>
          </div>
          <div className="pw-block">
            <div className="label">基準色預設</div>
            <div className="pw-chips">
              {BASE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setBase(p.hex)
                    setHint(`已套用「${p.label}」`)
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: p.hex,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {hint && <p className="field-hint">{hint}</p>}
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">基準色</h3>
            </div>
            <label className="stack">
              <span className="label">選擇顏色</span>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="color" value={base} onChange={(e) => setBase(e.target.value)} />
                <code className="mono">{base}</code>
                <ActionButton
                  className="btn sm ghost"
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'base' ? '已複製' : '複製基準色'}
                  onClick={() => void copyVal(base, 'base')}
                />
              </div>
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                gap: 8,
                marginTop: 16,
              }}
            >
              {shades.map(({ hex, l }) => (
                <button
                  key={hex + l}
                  type="button"
                  className="btn ghost"
                  style={{ background: hex, height: 72, borderColor: 'var(--border)' }}
                  onClick={() => void copyVal(hex, hex)}
                  title={`L${l}`}
                >
                  <span
                    style={{
                      color:
                        clamp(hexToRgb(hex).r * 0.3 + hexToRgb(hex).g * 0.6 + hexToRgb(hex).b * 0.1, 0, 255) > 140
                          ? '#111'
                          : '#fff',
                      fontSize: 11,
                    }}
                    className="mono"
                  >
                    {copied === hex ? '已複製' : hex}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">匯出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!shades.length}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'css' ? '已複製' : '複製 CSS'}
                  onClick={() => void copyVal(exportCss, 'css')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!shades.length}
                  icon="download"
                  iconOnly
                  tooltip="下載 CSS"
                  onClick={() => downloadText('palette.css', exportCss, 'text/css')}
                />
              </div>
            </div>
            {shades.length ? (
              <div className="stack" style={{ gap: 12 }}>
                <pre className="xc-pre mono">{exportCss}</pre>
                <ActionButton
                  className="btn sm ghost"
                  onClick={() => {
                    void copyVal(exportJson, 'json')
                  }}
                  icon="copy"
                >
                  {copied === 'json' ? '已複製' : '複製 JSON'}
                </ActionButton>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                選擇有效基準色後產生色階
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>固定色相／飽和度，產生 L10–L90 明度階（HSL）</strong>
            </li>
            <li>
              <span className="muted">用途</span>
              <strong>快速示意色盤；非正式設計系統色票</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Gradient Generator、Shadow Generator</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
