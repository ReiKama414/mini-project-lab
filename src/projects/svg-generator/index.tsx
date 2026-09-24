import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'
import { svgToSafeObjectUrl } from '../../lib/sanitize'

const fallback: ProjectMeta = {
  slug: 'svg-generator',
  title: 'SVG 形狀產生器',
  description: '產生簡易矩形／圓形／線段 SVG',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('svg-generator') ?? fallback

const SHAPE_LABELS = { rect: '矩形', circle: '圓形', line: '線段' } as const
type Shape = keyof typeof SHAPE_LABELS

const PRESETS: { label: string; shape: Shape; fill: string; stroke: string; size: number }[] = [
  { label: '品牌方塊', shape: 'rect', fill: '#2a9d8f', stroke: '#1a2e28', size: 120 },
  { label: '徽章圓', shape: 'circle', fill: '#e9a319', stroke: '#5c3d0a', size: 140 },
  { label: '分隔線', shape: 'line', fill: '#2a9d8f', stroke: '#2a9d8f', size: 200 },
]

export default function Page() {
  const [shape, setShape] = useLocalStorage<Shape>('lab:svg-generator:shape', 'rect')
  const [fill, setFill] = useLocalStorage('lab:svg-generator:fill', '#2a9d8f')
  const [stroke, setStroke] = useLocalStorage('lab:svg-generator:stroke', '#1a2e28')
  const [size, setSize] = useLocalStorage('lab:svg-generator:size', 120)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const s = clamp(size, 40, 320)

  const svg = useMemo(() => {
    const body =
      shape === 'circle'
        ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 4}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
        : shape === 'line'
          ? `<line x1="12" y1="${s / 2}" x2="${s - 12}" y2="${s / 2}" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>`
          : `<rect x="8" y="8" width="${s - 16}" height="${s - 16}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${body}</svg>`
  }, [shape, fill, stroke, s])

  const previewUrl = useMemo(() => svgToSafeObjectUrl(svg), [svg])
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

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
          <ActionButton className="btn sm ghost" onClick={() => void copyVal(svg, 'svg')} icon="copy">
            {copied === 'svg' ? '已複製' : '複製 SVG'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            onClick={() => downloadText('shape.svg', svg, 'image/svg+xml')}
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
              <span className="tag">{SHAPE_LABELS[shape]}</span>
              <span className="tag">{s}px</span>
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
                    setShape(p.shape)
                    setFill(p.fill)
                    setStroke(p.stroke)
                    setSize(p.size)
                    setHint(`已套用「${p.label}」`)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">形狀</div>
            <div className="pw-chips">
              {(Object.keys(SHAPE_LABELS) as Shape[]).map((sh) => (
                <button
                  key={sh}
                  type="button"
                  className={`btn sm ${shape === sh ? 'accent' : 'ghost'}`}
                  onClick={() => setShape(sh)}
                >
                  {SHAPE_LABELS[sh]}
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
                  <span className="label">填色</span>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
                    <code className="mono muted">{fill}</code>
                  </div>
                </label>
                <label className="stack">
                  <span className="label">描邊</span>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} />
                    <code className="mono muted">{stroke}</code>
                  </div>
                </label>
              </div>
              <label className="stack">
                <span className="label">尺寸：{s}px</span>
                <input
                  className="field"
                  type="range"
                  min={40}
                  max={320}
                  value={s}
                  onChange={(e) => setSize(clamp(parseNumber(e.target.value, 120), 40, 320))}
                />
              </label>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">預覽／原始碼</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'svg' ? '已複製' : '複製'}
                  onClick={() => void copyVal(svg, 'svg')}
                />
                <ActionButton
                  className="btn sm ghost"
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('shape.svg', svg, 'image/svg+xml')}
                />
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 160,
                marginBottom: 12,
                border: '1px dashed var(--border)',
                borderRadius: 12,
                background: 'var(--panel-2, transparent)',
              }}
            >
              {previewUrl ? <img src={previewUrl} alt="SVG 預覽" width={s} height={s} /> : null}
            </div>
            <pre className="xc-pre mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              {svg}
            </pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">形狀</span>
              <strong>矩形（圓角）、圓形、水平線段三種簡易圖形</strong>
            </li>
            <li>
              <span className="muted">安全</span>
              <strong>預覽以沙箱 object URL 顯示，不上傳</strong>
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
