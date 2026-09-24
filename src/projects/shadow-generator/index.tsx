import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'shadow-generator',
  title: 'CSS 陰影產生器',
  description: '視覺化調整並產生 box-shadow CSS',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('shadow-generator') ?? fallback

type ShadowVals = { x: number; y: number; blur: number; spread: number; color: string; opacity: number }

const PRESETS: { label: string; values: ShadowVals }[] = [
  { label: '柔和卡片', values: { x: 0, y: 8, blur: 24, spread: 0, color: '#000000', opacity: 0.18 } },
  { label: '浮起', values: { x: 0, y: 12, blur: 32, spread: -4, color: '#000000', opacity: 0.22 } },
  { label: '銳利', values: { x: 4, y: 4, blur: 0, spread: 0, color: '#000000', opacity: 0.35 } },
  { label: '內陰影感', values: { x: 0, y: 2, blur: 8, spread: 0, color: '#1a2e28', opacity: 0.28 } },
]

export default function Page() {
  const [x, setX] = useLocalStorage('lab:shadow-generator:x', 0)
  const [y, setY] = useLocalStorage('lab:shadow-generator:y', 8)
  const [blur, setBlur] = useLocalStorage('lab:shadow-generator:blur', 24)
  const [spread, setSpread] = useLocalStorage('lab:shadow-generator:spread', 0)
  const [color, setColor] = useLocalStorage('lab:shadow-generator:color', '#000000')
  const [opacity, setOpacity] = useLocalStorage('lab:shadow-generator:opacity', 0.18)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const o = clamp(opacity, 0, 1)
  const rgba = (() => {
    const n = parseInt(color.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r}, ${g}, ${b}, ${o})`
  })()
  const css = `${x}px ${y}px ${blur}px ${spread}px ${rgba}`
  const rule = `box-shadow: ${css};`

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setX(p.values.x)
    setY(p.values.y)
    setBlur(p.values.blur)
    setSpread(p.values.spread)
    setColor(p.values.color)
    setOpacity(p.values.opacity)
    setHint(`已套用「${p.label}」`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(rule, 'css')} icon="copy">
            {copied === 'css' ? '已複製' : '複製 CSS'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            onClick={() => downloadText('shadow.css', rule, 'text/css')}
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
              <span className="tag">
                {x}/{y} blur {blur}
              </span>
              <span className="tag">α {o.toFixed(2)}</span>
            </div>
          </div>
          <div className="pw-block">
            <div className="label">預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
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
              <h3 className="pw-panel-title">參數</h3>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {(
                [
                  ['X', x, setX, -50, 50],
                  ['Y', y, setY, -50, 50],
                  ['Blur', blur, setBlur, 0, 80],
                  ['Spread', spread, setSpread, -20, 40],
                ] as const
              ).map(([label, val, set, min, max]) => (
                <label key={label} className="stack">
                  <span className="label">
                    {label}：{val}px
                  </span>
                  <input
                    className="field"
                    type="range"
                    min={min}
                    max={max}
                    value={val}
                    onChange={(e) => set(clamp(parseNumber(e.target.value, 0), min, max))}
                  />
                </label>
              ))}
              <div className="grid-2">
                <label className="stack">
                  <span className="label">顏色</span>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                </label>
                <label className="stack">
                  <span className="label">透明度：{o.toFixed(2)}</span>
                  <input
                    className="field"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={o}
                    onChange={(e) => setOpacity(clamp(parseNumber(e.target.value, 0.18), 0, 1))}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">預覽／CSS</h3>
              <ActionButton
                className="btn sm ghost"
                icon="copy"
                iconOnly
                tooltip={copied === 'css' ? '已複製' : '複製'}
                onClick={() => void copyVal(rule, 'css')}
              />
            </div>
            <div
              style={{
                height: 120,
                borderRadius: 12,
                background: '#fff',
                boxShadow: css,
                border: '1px solid var(--border)',
                marginBottom: 12,
              }}
            />
            <pre className="xc-pre mono">{rule}</pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">類型</span>
              <strong>單一 box-shadow；多層陰影請自行疊加</strong>
            </li>
            <li>
              <span className="muted">預覽</span>
              <strong>白底示意，實際效果依背景色而異</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Gradient Generator、Color Palette</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
