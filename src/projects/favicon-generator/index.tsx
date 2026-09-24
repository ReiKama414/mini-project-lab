import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadCanvas, loadImageFromFile, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { charCount, clamp, formatBytes, limitText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'favicon-generator',
  title: 'Favicon 產生器',
  description: '文字色塊或圖片產生多尺寸 favicon PNG',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['design', 'image'],
}
const meta = getProject('favicon-generator') ?? fallback

const PRESETS = [16, 32, 48, 64, 128, 256]

const SAMPLES = [
  { label: 'M 青', text: 'M', bg: '#2a9d8f', fg: '#ffffff' },
  { label: 'A 深藍', text: 'A', bg: '#1d3557', fg: '#f1faee' },
  { label: '字 橘', text: '字', bg: '#e76f51', fg: '#ffffff' },
]

type FitMode = 'cover' | 'contain'

export default function Page() {
  const [text, setText] = useLocalStorage('lab:favicon-generator:text', 'M')
  const [bg, setBg] = useLocalStorage('lab:favicon-generator:bg', '#2a9d8f')
  const [fg, setFg] = useLocalStorage('lab:favicon-generator:fg', '#ffffff')
  const [size, setSize] = useLocalStorage('lab:favicon-generator:size', 64)
  const [fit, setFit] = useLocalStorage<FitMode>('lab:favicon-generator:fit', 'cover')
  const [showText, setShowText] = useLocalStorage('lab:favicon-generator:showText', true)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imgName, setImgName] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const s = clamp(size, 16, 256)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = s
    c.height = s
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, s, s)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, s, s)

    if (image) {
      const iw = image.naturalWidth || image.width
      const ih = image.naturalHeight || image.height
      const scale = fit === 'cover' ? Math.max(s / iw, s / ih) : Math.min(s / iw, s / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = (s - dw) / 2
      const dy = (s - dh) / 2
      ctx.drawImage(image, dx, dy, dw, dh)
    }

    if (showText || !image) {
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold ${Math.floor(s * 0.55)}px system-ui,sans-serif`
      ctx.fillText((text || '?').slice(0, 2), s / 2, s / 2 + s * 0.03)
    }
  }, [text, bg, fg, s, image, fit, showText])

  function download() {
    if (!canvasRef.current) return
    downloadCanvas(canvasRef.current, `favicon-${s}.png`)
  }

  async function onImage(file: File | null) {
    if (!file) return
    setError('')
    try {
      const img = await loadImageFromFile(file)
      setImage(img)
      setImgName(file.name)
      setHint(`已載入「${file.name}」`)
    } catch {
      setError('無法讀取圖片')
      setImage(null)
      setImgName('')
    }
  }

  function clearImage() {
    setImage(null)
    setImgName('')
    setError('')
    setHint('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm accent" onClick={download} icon="download">
            下載 PNG
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">{s}×{s}</span>
              {imgName && <span className="tag">{imgName}</span>}
              {error && <span className="tag xc-tag-warn">圖片失敗</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">範例色塊</div>
            <div className="pw-chips">
              {SAMPLES.map((s0) => (
                <button
                  key={s0.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setText(s0.text)
                    setBg(s0.bg)
                    setFg(s0.fg)
                    setHint(`已套用「${s0.label}」`)
                  }}
                >
                  {s0.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">尺寸</div>
            <div className="pw-chips">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${s === n ? 'accent' : 'ghost'}`}
                  onClick={() => setSize(n)}
                >
                  {n}px
                </button>
              ))}
            </div>
          </div>
          {image && (
            <div className="row xc-options">
              <label className="xc-check">
                <input type="radio" checked={fit === 'cover'} onChange={() => setFit('cover')} />
                填滿（cover）
              </label>
              <label className="xc-check">
                <input type="radio" checked={fit === 'contain'} onChange={() => setFit('contain')} />
                完整放入（contain）
              </label>
              <label className="xc-check">
                <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
                疊加文字
              </label>
            </div>
          )}
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">設定</h3>
              {image && (
                <ActionButton className="btn sm ghost" icon="trash" onClick={clearImage}>
                  清除圖片
                </ActionButton>
              )}
            </div>
            {error && <p className="field-error">{error}</p>}
            {hint && !error && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept={IMAGE_ACCEPT}
              maxBytes={IMAGE_MAX_BYTES}
              label="拖放底圖（可選）"
              hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
              onFiles={(files) => void onImage(files[0] ?? null)}
            />
            <div className="grid-2" style={{ marginTop: 12 }}>
              <label className="stack">
                <span className="label">文字（最多 2 字）</span>
                <input
                  className="field"
                  value={text}
                  maxLength={2}
                  onChange={(e) => {
                    setText(limitText(e.target.value, 2))
                    setHint('')
                  }}
                />
                <div className="field-meta">
                  <span>{charCount(text)} / 2</span>
                </div>
              </label>
              <label className="stack">
                <span className="label">自訂尺寸</span>
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
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">預覽</h3>
              <ActionButton className="btn sm ghost" icon="download" iconOnly tooltip="下載" onClick={download} />
            </div>
            <canvas
              ref={canvasRef}
              style={{ width: s, height: s, borderRadius: 8, border: '1px solid var(--line)', imageRendering: 'pixelated' }}
            />
            <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>
              單一尺寸 PNG；需 .ico 多尺寸請另用封裝工具
            </p>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">輸出</span>
              <strong>Canvas 匯出單一尺寸 PNG（16–256），不含 .ico 多尺寸封裝</strong>
            </li>
            <li>
              <span className="muted">底圖</span>
              <strong>可選上傳圖片；cover／contain 與是否疊字可調</strong>
            </li>
            <li>
              <span className="muted">字型</span>
              <strong>依裝置系統字體；圖片不上傳、不持久化</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Web Manifest、Meta Tags</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
