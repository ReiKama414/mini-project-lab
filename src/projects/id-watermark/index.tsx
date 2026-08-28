import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('id-watermark')!

const TEXT_MAX = 80
const FILE_MAX_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp'

type Mode = 'tile' | 'center' | 'diagonal'

const PRESETS = [
  '僅供辦理業務使用',
  '僅供銀行開戶使用',
  '僅供租屋合約使用',
  '僅供本次申請使用',
  '複印無效 · 僅供核對',
]

function todayStamp() {
  return new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(0)
  const [text, setText] = useLocalStorage('lab:id-watermark:text', `僅供辦理業務使用 ${todayStamp()}`)
  const [mode, setMode] = useLocalStorage<Mode>('lab:id-watermark:mode', 'tile')
  const [opacity, setOpacity] = useLocalStorage('lab:id-watermark:opacity', 28)
  const [fontSize, setFontSize] = useLocalStorage('lab:id-watermark:fontSize', 28)
  const [angle, setAngle] = useLocalStorage('lab:id-watermark:angle', -30)
  const [gap, setGap] = useLocalStorage('lab:id-watermark:gap', 160)
  const [color, setColor] = useLocalStorage('lab:id-watermark:color', '#1a2e28')
  const [includeDate, setIncludeDate] = useLocalStorage('lab:id-watermark:includeDate', true)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const watermarkLine = useMemo(() => {
    const base = text.trim()
    if (!base) return ''
    if (!includeDate) return base
    const d = todayStamp()
    return base.includes(d) ? base : `${base} · ${d}`
  }, [text, includeDate])

  const canExport = !!src && isNonEmpty(watermarkLine) && !error

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete || !img.naturalWidth) return

    const w = img.naturalWidth
    const h = img.naturalHeight
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)

    const line = watermarkLine
    if (!line) return

    const size = clamp(fontSize, 12, 120)
    const alpha = clamp(opacity, 5, 80) / 100
    const rot = (clamp(angle, -90, 90) * Math.PI) / 180
    const spacing = clamp(gap, 60, 400)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.font = `600 ${size}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (mode === 'center') {
      ctx.translate(w / 2, h / 2)
      ctx.rotate(rot)
      ctx.fillText(line, 0, 0)
    } else if (mode === 'diagonal') {
      ctx.translate(w / 2, h / 2)
      ctx.rotate(rot)
      ctx.fillText(line, 0, 0)
      ctx.globalAlpha = alpha * 0.55
      ctx.fillText(line, 0, -spacing)
      ctx.fillText(line, 0, spacing)
    } else {
      // tile
      const diag = Math.sqrt(w * w + h * h)
      ctx.translate(w / 2, h / 2)
      ctx.rotate(rot)
      const metrics = ctx.measureText(line)
      const stepX = Math.max(spacing, metrics.width + 40)
      const stepY = spacing
      for (let y = -diag; y < diag; y += stepY) {
        for (let x = -diag; x < diag; x += stepX) {
          ctx.fillText(line, x, y)
        }
      }
    }
    ctx.restore()
  }, [watermarkLine, fontSize, opacity, angle, gap, color, mode])

  useEffect(() => {
    draw()
  }, [draw, src, ready])

  function clearImage() {
    if (src) URL.revokeObjectURL(src)
    setSrc(null)
    imgRef.current = null
    setFileName('')
    setFileInfo('')
    setError('')
    setReady(0)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      canvas.height = 0
    }
  }

  function onFile(file: File | null) {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('請上傳 JPG／PNG／WebP 圖片')
      return
    }
    if (file.size > FILE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX_BYTES)}）`)
      return
    }
    setError('')
    if (src) URL.revokeObjectURL(src)
    const url = URL.createObjectURL(file)
    setSrc(url)
    setFileName(file.name)
    setFileInfo(`${formatBytes(file.size)} · ${file.type || 'image'}`)

    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady((n) => n + 1)
    }
    img.onerror = () => {
      setError('無法讀取圖片')
      if (url) URL.revokeObjectURL(url)
      setSrc(null)
      imgRef.current = null
      setFileName('')
      setFileInfo('')
      setReady(0)
    }
    img.src = url
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas || !canExport) return
    draw()
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const a = document.createElement('a')
        const base = fileName.replace(/\.[^.]+$/, '') || 'id-watermark'
        a.href = URL.createObjectURL(blob)
        a.download = `${base}-watermark.png`
        a.click()
        URL.revokeObjectURL(a.href)
      },
      'image/png',
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={clearImage} disabled={!src}>
            清除圖片
          </button>
          <button type="button" className="btn sm accent" onClick={download} disabled={!canExport}>
            下載 PNG
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        圖片僅在瀏覽器本機處理，不會上傳。浮水印可降低證件被挪作他用的風險，但仍請謹慎分享。
      </p>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <FileDrop
            accept={ACCEPT}
            maxBytes={FILE_MAX_BYTES}
            label="拖放證件圖片到此，或點擊選擇"
            hint={`上限 ${formatBytes(FILE_MAX_BYTES)}`}
            onFiles={(files) => onFile(files[0] ?? null)}
          />
          {(fileName || fileInfo) && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName}
              {fileInfo ? ` · ${fileInfo}` : ''}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <p className="field-hint">支援 JPG／PNG／WebP，單檔上限 {formatBytes(FILE_MAX_BYTES)}</p>

          <div className="field-wrap">
            <label className="label">浮水印文字</label>
            <input
              className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
              placeholder="例如：僅供辦理業務使用"
            />
            <div className="field-meta">
              <span>{!isNonEmpty(text) ? '請輸入浮水印內容' : ' '}</span>
              <span>
                {charCount(text)} / {TEXT_MAX}
              </span>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn sm ghost"
                onClick={() => setText(limitText(p, TEXT_MAX))}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="check">
            <input type="checkbox" checked={includeDate} onChange={() => setIncludeDate(!includeDate)} />
            自動附加今日日期
          </label>

          <div className="label" style={{ marginBottom: 0 }}>
            排列方式
          </div>
          <div className="row">
            {(
              [
                ['tile', '滿版平鋪'],
                ['diagonal', '斜向三行'],
                ['center', '置中單行'],
              ] as [Mode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn sm ${mode === id ? 'accent' : 'ghost'}`}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid-2">
            <label className="stack">
              <span className="label">透明度 {opacity}%</span>
              <input
                type="range"
                min={5}
                max={80}
                value={opacity}
                onChange={(e) => setOpacity(clamp(Number(e.target.value), 5, 80))}
              />
            </label>
            <label className="stack">
              <span className="label">字級 {fontSize}px</span>
              <input
                type="range"
                min={12}
                max={120}
                value={fontSize}
                onChange={(e) => setFontSize(clamp(Number(e.target.value), 12, 120))}
              />
            </label>
            <label className="stack">
              <span className="label">角度 {angle}°</span>
              <input
                type="range"
                min={-90}
                max={90}
                value={angle}
                onChange={(e) => setAngle(clamp(Number(e.target.value), -90, 90))}
              />
            </label>
            <label className="stack">
              <span className="label">間距 {gap}px</span>
              <input
                type="range"
                min={60}
                max={400}
                value={gap}
                disabled={mode === 'center'}
                onChange={(e) => setGap(clamp(Number(e.target.value), 60, 400))}
              />
            </label>
          </div>

          <label className="stack">
            <span className="label">顏色</span>
            <div className="row">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <input
                className="field mono"
                style={{ width: 120 }}
                value={color}
                maxLength={7}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                }}
              />
            </div>
          </label>

          <div className="row">
            <button type="button" className="btn accent" onClick={download} disabled={!canExport}>
              下載浮水印圖片
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setText(`僅供辦理業務使用`)
                setMode('tile')
                setOpacity(28)
                setFontSize(28)
                setAngle(-30)
                setGap(160)
                setColor('#1a2e28')
                setIncludeDate(true)
              }}
            >
              重設設定
            </button>
          </div>
        </div>

        <div className="panel stack">
          <div className="label">預覽</div>
          {src ? (
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 12,
                overflow: 'auto',
                background: 'var(--bg-muted)',
                maxHeight: 560,
              }}
            >
              <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          ) : (
            <div
              className="muted"
              style={{
                minHeight: 280,
                display: 'grid',
                placeItems: 'center',
                border: '1px dashed var(--line)',
                borderRadius: 12,
                padding: 24,
                textAlign: 'center',
              }}
            >
              上傳圖片後會在此顯示浮水印預覽
            </div>
          )}
          {canExport && (
            <p className="field-hint">預覽文字：{watermarkLine}</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
