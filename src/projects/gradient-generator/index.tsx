import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('gradient-generator') ?? {
  slug: 'gradient-generator',
  title: '漸層產生器',
  description: '產生 CSS linear-gradient。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [c1, setC1] = useLocalStorage('lab:gradient-generator:c1', '#2a9d8f')
  const [c2, setC2] = useLocalStorage('lab:gradient-generator:c2', '#e9a319')
  const [angle, setAngle] = useLocalStorage('lab:gradient-generator:angle', 135)
  const [copied, setCopied] = useState(false)
  const a = clamp(angle, 0, 360)
  const css = `linear-gradient(${a}deg, ${c1}, ${c2})`
  const rule = `background: ${css};`

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          雙色 linear-gradient。設定會記住；若需多色標或 radial，請手動擴充 CSS。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">顏色 1</span>
            <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} />
          </label>
          <label className="stack">
            <span className="label">顏色 2</span>
            <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} />
          </label>
        </div>
        <label className="stack">
          <span className="label">角度：{a}°</span>
          <input
            className="field"
            type="range"
            min={0}
            max={360}
            value={a}
            onChange={(e) => setAngle(clamp(parseNumber(e.target.value, 135), 0, 360))}
          />
        </label>
        <div style={{ height: 160, borderRadius: 12, background: css, border: '1px solid var(--border)' }} />
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
          <button type="button" className="btn ghost" onClick={() => downloadText('gradient.css', rule, 'text/css')}>
            下載
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
