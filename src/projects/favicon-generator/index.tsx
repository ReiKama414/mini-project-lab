import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadCanvas, loadImageFromFile, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { charCount, clamp, formatBytes, limitText, parseNumber } from '../../lib/utils'

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
      const scale =
        fit === 'cover' ? Math.max(s / iw, s / ih) : Math.min(s / iw, s / ih)
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
        僅產生單一尺寸 PNG，不含 .ico 多尺寸封裝。可選上傳圖片當底圖；字型依裝置系統字體。圖片不上傳、不持久化。
      </p>
      <div className="panel stack">
        <div className="stack">
          <span className="label">選用圖片（可選）</span>
          <FileDrop
            accept={IMAGE_ACCEPT}
            maxBytes={IMAGE_MAX_BYTES}
            label="拖放圖片到此，或點擊選擇"
            hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
            onFiles={(files) => void onImage(files[0] ?? null)}
          />
          {imgName && (
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="field-hint">{imgName}</span>
              <button type="button" className="btn sm ghost" onClick={clearImage}>
                清除圖片
              </button>
            </div>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
        {image && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="radio" checked={fit === 'cover'} onChange={() => setFit('cover')} />
              填滿（cover）
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="radio" checked={fit === 'contain'} onChange={() => setFit('contain')} />
              完整放入（contain）
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
              疊加文字
            </label>
          </div>
        )}
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
