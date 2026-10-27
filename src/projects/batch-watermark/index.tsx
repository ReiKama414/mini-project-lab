import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'
import { FtMetric, FtMetricGrid, FtSection, FtToolHero, FtToolRoot } from '../../components/FeatureToolUI'
import { FtAsidePreview, FtCanvasAside, ftImageLocalFaq } from '../../components/FtImageToolUI'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import {
  loadImageFromFile,
  canvasFromImage,
  downloadBlob,
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
} from '../../lib/imageCanvas'
import JSZip from 'jszip'

const fallback: ProjectMeta = {
  slug: 'batch-watermark',
  title: '批次浮水印',
  description: '為多張圖片一次加上浮水印並打包下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('batch-watermark') ?? fallback

const TEXT_MAX = 80
const MAX_FILES = 30

const TEXT_PRESETS = ['© 我的品牌', '僅供預覽', 'Draft', '內部使用']

function applyWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  opacity: number,
  size: number,
  angle: number,
  color: string,
) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.save()
  ctx.globalAlpha = clamp(opacity, 5, 80) / 100
  ctx.fillStyle = color
  ctx.font = `600 ${clamp(size, 12, 120)}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(w / 2, h / 2)
  ctx.rotate((clamp(angle, -90, 90) * Math.PI) / 180)
  const gap = Math.max(120, size * 5)
  const diag = Math.sqrt(w * w + h * h)
  for (let y = -diag; y < diag; y += gap) {
    for (let x = -diag; x < diag; x += gap) ctx.fillText(text, x, y)
  }
  ctx.restore()
}

export default function Page() {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const [previewDims, setPreviewDims] = useState({ w: 0, h: 0 })
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useLocalStorage('lab:batch-watermark:text', '僅供核對使用')
  const [opacity, setOpacity] = useLocalStorage('lab:batch-watermark:opacity', 28)
  const [fontSize, setFontSize] = useLocalStorage('lab:batch-watermark:size', 28)
  const [angle, setAngle] = useLocalStorage('lab:batch-watermark:angle', -30)
  const [color, setColor] = useLocalStorage('lab:batch-watermark:color', '#1a2e28')

  useEffect(() => {
    let cancelled = false
    async function draw() {
      const out = previewRef.current
      if (!out || !files[0] || !isNonEmpty(text)) {
        if (out) {
          out.width = 0
          out.height = 0
        }
        setPreviewDims({ w: 0, h: 0 })
        return
      }
      try {
        const img = await loadImageFromFile(files[0]!)
        if (cancelled) return
        const maxSide = 640
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        const { canvas } = canvasFromImage(
          img,
          Math.round(img.naturalWidth * scale),
          Math.round(img.naturalHeight * scale),
        )
        applyWatermark(
          canvas,
          limitText(text.trim(), TEXT_MAX),
          opacity,
          Math.max(12, fontSize * scale),
          angle,
          color,
        )
        out.width = canvas.width
        out.height = canvas.height
        setPreviewDims({ w: canvas.width, h: canvas.height })
        out.getContext('2d')!.drawImage(canvas, 0, 0)
      } catch {
        /* preview optional */
      }
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [files, text, opacity, fontSize, angle, color])

  function onFiles(list: File[]) {
    const arr = list.slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(`「${f.name}」超過 ${formatBytes(IMAGE_MAX_BYTES)}`)
        return
      }
    }
    setError('')
    setFiles(arr)
  }

  async function processZip() {
    if (!files.length || !isNonEmpty(text)) return
    setBusy(true)
    setError('')
    try {
      const zip = new JSZip()
      const line = limitText(text.trim(), TEXT_MAX)
      for (const file of files) {
        const img = await loadImageFromFile(file)
        const { canvas } = canvasFromImage(img)
        applyWatermark(canvas, line, opacity, fontSize, angle, color)
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) zip.file(`${file.name.replace(/\.[^.]+$/, '')}-wm.png`, blob)
      }
      const out = await zip.generateAsync({ type: 'blob' })
      downloadBlob(out, 'batch-watermark.zip')
    } catch {
      setError('處理失敗，請重試')
    } finally {
      setBusy(false)
    }
  }

  const totalSize = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files])
  const canRun = files.length > 0 && isNonEmpty(text) && !busy
  const showPreview = Boolean(files[0] && isNonEmpty(text))

  return (
    <FeatureLayout
      meta={meta}
      variant="stacked"
      toolbar={
        <>
          <FileDrop
            accept={IMAGE_ACCEPT}
            multiple
            maxFiles={MAX_FILES}
            maxBytes={IMAGE_MAX_BYTES}
            disabled={busy}
            label="拖放多張圖片到此，或點擊選擇"
            hint={`最多 ${MAX_FILES} 張 · 單張 ${formatBytes(IMAGE_MAX_BYTES)} · 僅本機處理`}
            onFiles={onFiles}
          />
          <div className="ft-samples">
            <span className="muted">文字範例：</span>
            {TEXT_PRESETS.map((p) => (
              <button key={p} type="button" className="btn sm ghost" onClick={() => setText(limitText(p, TEXT_MAX))}>
                {p}
              </button>
            ))}
          </div>
        </>
      }
      actions={
        <ActionButton
          className="btn sm accent"
          disabled={!canRun}
          onClick={() => void processZip()}
          icon="download"
        >
          {busy ? '處理中…' : '下載 ZIP'}
        </ActionButton>
      }
      infoItems={[
        { label: '批次上限', value: `${MAX_FILES} 張` },
        { label: '單檔上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '預覽', value: '以第一張即時預覽' },
      ]}
      faq={[
        ftPrivacyLocal,
        ftImageLocalFaq(`ZIP 打包在瀏覽器完成；單張 ≤ ${formatBytes(IMAGE_MAX_BYTES)}，總量過大可能記憶體不足。`),
      ]}
      aside={
        <FtAsidePreview
          title="即時預覽（第一張）"
          tag={showPreview && previewDims.w ? <span className="tag mono">{previewDims.w}×{previewDims.h}</span> : null}
        >
          <FtCanvasAside
            canvasRef={previewRef}
            hasImage={showPreview}
            empty="選圖並輸入浮水印文字後預覽"
          />
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtToolHero
          emoji="💧"
          title={files.length ? `已選 ${files.length} 張` : '尚未選擇圖片'}
          subtitle={
            files.length
              ? `總大小 ${formatBytes(totalSize)}${files[0] ? ` · 預覽：${files[0].name}` : ''}`
              : `最多 ${MAX_FILES} 張 · 單張 ${formatBytes(IMAGE_MAX_BYTES)}`
          }
          meta={isNonEmpty(text) ? `浮水印：${limitText(text.trim(), TEXT_MAX)}` : '請輸入浮水印文字'}
          badge={busy ? <span className="tag">處理中</span> : canRun ? <span className="tag">可打包</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="張數" value={files.length || '—'} />
          <FtMetric label="總大小" value={files.length ? formatBytes(totalSize) : '—'} mono />
          <FtMetric label="預覽尺寸" value={previewDims.w ? `${previewDims.w} × ${previewDims.h}` : '—'} mono />
          <FtMetric label="輸出" value="PNG · ZIP" />
        </FtMetricGrid>
        {error && <p className="field-error">{error}</p>}

        <FtSection title="浮水印文字">
          <div className="field-wrap">
            <label className="label">文字內容</label>
            <input
              className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
            />
            <div className="field-meta">
              <span>{!isNonEmpty(text) ? '請輸入文字' : ' '}</span>
              <span>
                {charCount(text)} / {TEXT_MAX}
              </span>
            </div>
          </div>
        </FtSection>

        <FtSection title="樣式">
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
              <span className="label">顏色</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>
        </FtSection>

        {files.length > 0 && (
          <FtSection title="檔案列表" hint="依此順序打包">
            <ul className="ft-ui-list">
              {files.map((f) => (
                <li key={f.name + f.size} className="ft-ui-list-item">
                  <span className="mono" style={{ fontSize: 13, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                    {f.name}
                  </span>
                  <span className="tag">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          </FtSection>
        )}

        <ActionButton className="btn accent" disabled={!canRun} onClick={() => void processZip()} icon="download">
          {busy ? '處理中…' : '套用並下載 ZIP'}
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
