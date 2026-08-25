import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'
import { svgToSafeObjectUrl } from '../../lib/sanitize'

const meta: ProjectMeta = getProject('svg-generator') ?? {
  slug: 'svg-generator',
  title: 'SVG 形狀產生器',
  description: '產生簡易 SVG 形狀。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [shape, setShape] = useLocalStorage<'rect' | 'circle' | 'line'>('lab:svg-generator:shape', 'rect')
  const [fill, setFill] = useLocalStorage('lab:svg-generator:fill', '#2a9d8f')
  const [stroke, setStroke] = useLocalStorage('lab:svg-generator:stroke', '#1a2e28')
  const [size, setSize] = useLocalStorage('lab:svg-generator:size', 120)
  const [copied, setCopied] = useState(false)
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
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(['rect', 'circle', 'line'] as const).map((sh) => (
            <button key={sh} type="button" className={`btn sm ${shape === sh ? 'accent' : 'ghost'}`} onClick={() => setShape(sh)}>{sh}</button>
          ))}
        </div>
        <div className="grid-2">
          <label className="stack"><span className="label">填色</span><input type="color" value={fill} onChange={(e) => setFill(e.target.value)} /></label>
          <label className="stack"><span className="label">描邊</span><input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} /></label>
        </div>
        <label className="stack"><span className="label">尺寸：{s}</span><input className="field" type="range" min={40} max={320} value={s} onChange={(e) => setSize(clamp(parseNumber(e.target.value, 120), 40, 320))} /></label>
        {previewUrl ? <img src={previewUrl} alt="SVG 預覽" width={s} height={s} /> : null}
        <div className="row">
          <button type="button" className="btn accent" onClick={async () => { await copyText(svg); setCopied(true) }}>{copied ? '已複製' : '複製 SVG'}</button>
          <button type="button" className="btn ghost" onClick={() => downloadText('shape.svg', svg, 'image/svg+xml')}>下載</button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>{svg}</pre>
      </div>
    </ProjectShell>
  )
}
