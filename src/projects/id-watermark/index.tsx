import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import { FtSection, FtToolRoot } from '../../components/FeatureToolUI'
import {
  FtAsidePreview,
  FtCanvasAside,
  FtImageHero,
  FtImageMetrics,
  ftImageLocalFaq,
} from '../../components/FtImageToolUI'
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const meta = getProject('id-watermark')!

const TEXT_MAX = 80
const FILE_MAX_BYTES = IMAGE_MAX_BYTES
const ACCEPT = IMAGE_ACCEPT

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
  const [fileSize, setFileSize] = useState(0)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)
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
    setFileSize(0)
    setImgW(0)
    setImgH(0)
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
    setFileSize(file.size)

    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgW(img.naturalWidth)
      setImgH(img.naturalHeight)
      setReady((n) => n + 1)
    }
    img.onerror = () => {
      setError('無法讀取圖片')
      if (url) URL.revokeObjectURL(url)
      setSrc(null)
      imgRef.current = null
      setFileName('')
      setFileSize(0)
      setImgW(0)
      setImgH(0)
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

  const imageMeta = useMemo(
    () => ({ fileName, fileSize, width: imgW, height: imgH }),
    [fileName, fileSize, imgW, imgH],
  )

  return (
    <FeatureLayout
      meta={meta}
      variant="stacked"
      toolbar={
        <FileDrop
          accept={ACCEPT}
          maxBytes={FILE_MAX_BYTES}
          label="拖放證件圖片到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX_BYTES)} · 僅本機處理`}
          onFiles={(files) => onFile(files[0] ?? null)}
        />
      }
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" onClick={clearImage} disabled={!src}>
            清除圖片
          </ActionButton>
          <ActionButton className="btn sm accent" onClick={download} disabled={!canExport} icon="download">
            下載 PNG
          </ActionButton>
        </div>
      }
      infoItems={[
        { label: '處理方式', value: 'Canvas 本機繪製' },
        { label: '單檔上限', value: formatBytes(FILE_MAX_BYTES) },
        { label: '格式', value: 'JPG／PNG／WebP → PNG 下載' },
      ]}
      faq={[
        ftPrivacyLocal,
        ftImageLocalFaq(`單檔 ≤ ${formatBytes(FILE_MAX_BYTES)}；輸出為 PNG。證件影像請謹慎分享。`),
        {
          title: '用途提醒',
          body: '浮水印可降低證件被挪作他用的風險，但仍請謹慎分享影像。',
        },
      ]}
      aside={
        <FtAsidePreview
          title="浮水印預覽"
          tag={canExport ? <span className="tag mono">{imgW}×{imgH}</span> : null}
        >
          <FtCanvasAside canvasRef={canvasRef} hasImage={Boolean(src)} empty="上傳後即時預覽浮水印" />
          {canExport && <p className="field-hint ft-ui-section-hint">預覽文字：{watermarkLine}</p>}
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtImageHero
          emoji="🪪"
          meta={imageMeta}
          emptyTitle="尚未上傳證件圖"
          emptySubtitle="於上方拖放 JPG／PNG／WebP"
          metaLine={canExport ? `模式：${mode === 'tile' ? '滿版平鋪' : mode === 'diagonal' ? '斜向三行' : '置中單行'}` : undefined}
          badge={canExport ? <span className="tag">可下載</span> : null}
        />
        <FtImageMetrics meta={imageMeta} />
        {error && <p className="field-error">{error}</p>}

        <FtSection title="浮水印文字" hint="支援常用證件用途範本">
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

          <div className="ft-samples">
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
        </FtSection>

        <FtSection title="排列與樣式">
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
        </FtSection>

        <div className="row">
          <ActionButton className="btn accent" onClick={download} disabled={!canExport} icon="download">
            下載浮水印圖片
          </ActionButton>
          <ActionButton
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
          </ActionButton>
        </div>
      </FtToolRoot>
    </FeatureLayout>
  )
}
