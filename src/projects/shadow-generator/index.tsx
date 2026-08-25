import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('shadow-generator') ?? {
  slug: 'shadow-generator',
  title: '陰影產生器',
  description: '調整 box-shadow 參數。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [x, setX] = useLocalStorage('lab:shadow-generator:x', 0)
  const [y, setY] = useLocalStorage('lab:shadow-generator:y', 8)
  const [blur, setBlur] = useLocalStorage('lab:shadow-generator:blur', 24)
  const [spread, setSpread] = useLocalStorage('lab:shadow-generator:spread', 0)
  const [color, setColor] = useLocalStorage('lab:shadow-generator:color', '#000000')
  const [opacity, setOpacity] = useLocalStorage('lab:shadow-generator:opacity', 0.18)
  const [copied, setCopied] = useState(false)

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

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          單一 box-shadow。多層陰影請自行疊加；預覽底為白底示意。
        </p>
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
        <div style={{ height: 120, borderRadius: 12, background: '#fff', boxShadow: css, border: '1px solid var(--border)' }} />
        <code className="metric mono">{rule}</code>
        <div className="row">
          <button
            type="button"
            className="btn accent"
            onClick={async () => {
              await copyText(rule)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製 CSS'}
          </button>
          <button type="button" className="btn ghost" onClick={() => downloadText('shadow.css', rule, 'text/css')}>
            下載
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
