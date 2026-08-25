import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadCanvas } from '../../lib/imageCanvas'
import { charCount, clamp, limitText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'favicon-generator',
  title: 'Favicon 產生器',
  description: '以文字與色塊產生 favicon PNG。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('favicon-generator') ?? fallback

const PRESETS = [16, 32, 48, 64, 128, 256]

export default function Page() {
  const [text, setText] = useLocalStorage('lab:favicon-generator:text', 'M')
  const [bg, setBg] = useLocalStorage('lab:favicon-generator:bg', '#2a9d8f')
  const [fg, setFg] = useLocalStorage('lab:favicon-generator:fg', '#ffffff')
  const [size, setSize] = useLocalStorage('lab:favicon-generator:size', 64)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const s = clamp(size, 16, 256)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = s
    c.height = s
    const ctx = c.getContext('2d')!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.floor(s * 0.55)}px system-ui,sans-serif`
    ctx.fillText((text || '?').slice(0, 2), s / 2, s / 2 + s * 0.03)
  }, [text, bg, fg, s])

  function download() {
    if (!canvasRef.current) return
    downloadCanvas(canvasRef.current, `favicon-${s}.png`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" onClick={download}>
          下載 PNG
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        僅產生單一尺寸 PNG，不含 .ico 多尺寸封裝。字型依裝置系統字體。
      </p>
      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span className="label">文字（最多 2 字）</span>
            <input className="field" value={text} maxLength={2} onChange={(e) => setText(limitText(e.target.value, 2))} />
            <div className="field-meta">
              <span>{charCount(text)} / 2</span>
            </div>
          </label>
          <label className="stack">
            <span className="label">尺寸</span>
            <input
              className="field"
              type="number"
              min={16}
              max={256}
              value={s}
              onChange={(e) => setSize(clamp(parseNumber(e.target.value, 64), 16, 256))}
            />
          </label>
          <label className="stack">
            <span className="label">背景</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
          <label className="stack">
            <span className="label">文字色</span>
            <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((n) => (
            <button key={n} type="button" className={`btn sm ${s === n ? 'accent' : 'ghost'}`} onClick={() => setSize(n)}>
              {n}px
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} style={{ width: s, height: s, borderRadius: 8, border: '1px solid var(--line)' }} />
        <button type="button" className="btn accent" onClick={download}>
          下載 PNG
        </button>
      </div>
    </ProjectShell>
  )
}
