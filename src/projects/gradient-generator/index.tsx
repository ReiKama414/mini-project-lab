import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'gradient-generator',
  title: 'CSS 漸層產生器',
  description: '視覺化調整並產生 linear-gradient CSS',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('gradient-generator') ?? fallback

const PRESETS = [
  { label: '品牌綠金', c1: '#2a9d8f', c2: '#e9a319', angle: 135 },
  { label: '晨曦', c1: '#ff9a9e', c2: '#fad0c4', angle: 120 },
  { label: '深海', c1: '#0f2027', c2: '#2c5364', angle: 160 },
  { label: '薰衣草', c1: '#a18cd1', c2: '#fbc2eb', angle: 90 },
]

const ANGLE_CHIPS = [0, 45, 90, 135, 180, 270] as const

export default function Page() {
  const [c1, setC1] = useLocalStorage('lab:gradient-generator:c1', '#2a9d8f')
  const [c2, setC2] = useLocalStorage('lab:gradient-generator:c2', '#e9a319')
  const [angle, setAngle] = useLocalStorage('lab:gradient-generator:angle', 135)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const a = clamp(angle, 0, 360)
  const css = `linear-gradient(${a}deg, ${c1}, ${c2})`
  const rule = `background: ${css};`

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
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
            onClick={() => downloadText('gradient.css', rule, 'text/css')}
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
              <span className="tag">{a}°</span>
              <span className="tag mono">{c1}</span>
              <span className="tag mono">{c2}</span>
            </div>
          </div>
          <div className="pw-block">
            <div className="label">預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setC1(p.c1)
                    setC2(p.c2)
                    setAngle(p.angle)
                    setHint(`已套用「${p.label}」`)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">角度快捷</div>
            <div className="pw-chips">
              {ANGLE_CHIPS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn sm ${a === v ? 'accent' : 'ghost'}`}
                  onClick={() => setAngle(v)}
                >
                  {v}°
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
            <div className="stack" style={{ gap: 12 }}>
              <div className="grid-2">
                <label className="stack">
                  <span className="label">顏色 1</span>
                  <div className="row" style={{ gap: 8 }}>
                    <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} />
                    <code className="mono muted">{c1}</code>
                  </div>
                </label>
                <label className="stack">
                  <span className="label">顏色 2</span>
                  <div className="row" style={{ gap: 8 }}>
                    <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} />
                    <code className="mono muted">{c2}</code>
                  </div>
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
                height: 160,
                borderRadius: 12,
                background: css,
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
              <strong>雙色 linear-gradient；多色標或 radial 請手動擴充 CSS</strong>
            </li>
            <li>
              <span className="muted">儲存</span>
              <strong>顏色與角度設定會記住於本機</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Shadow Generator、Color Palette</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
