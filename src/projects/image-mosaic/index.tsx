import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { ActionButton } from '../../components/ActionButton'
import { FtSection, FtToolRoot } from '../../components/FeatureToolUI'
import {
  FtAsidePreview,
  FtCanvasAside,
  FtImageHero,
  FtImageMetrics,
  ftImageLocalFaq,
} from '../../components/FtImageToolUI'

const fallback: ProjectMeta = {
  slug: 'image-mosaic',
  title: '馬賽克遮蔽',
  description: '在圖片上塗抹馬賽克區塊',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-mosaic') ?? fallback

type Stroke = { points: { x: number; y: number }[]; brush: number }

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [block, setBlock] = useLocalStorage('lab:image-mosaic:block', 16)
  const [brush, setBrush] = useLocalStorage('lab:image-mosaic:brush', 48)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const drawing = useRef(false)
  const strokeIdx = useRef(-1)
  const lastAdd = useRef(0)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const size = clamp(block, 4, 64)
    const cover = new Set<string>()
    for (const stroke of strokes) {
      const b = clamp(stroke.brush, 8, 200)
      for (const p of stroke.points) {
        const x0 = Math.max(0, Math.floor(p.x - b / 2))
        const y0 = Math.max(0, Math.floor(p.y - b / 2))
        const x1 = Math.min(src.width, Math.ceil(p.x + b / 2))
        const y1 = Math.min(src.height, Math.ceil(p.y + b / 2))
        for (let y = y0; y < y1; y += size) {
          for (let x = x0; x < x1; x += size) {
            const key = `${x},${y}`
            if (cover.has(key)) continue
            cover.add(key)
            const sw = Math.min(size, x1 - x)
            const sh = Math.min(size, y1 - y)
            const sample = ctx.getImageData(x, y, 1, 1).data
            ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`
            ctx.fillRect(x, y, sw, sh)
          }
        }
      }
    }
  }, [strokes, block])

  useEffect(() => {
    redraw()
  }, [redraw])

  function canvasPos(clientX: number, clientY: number) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * c.width,
      y: ((clientY - rect.top) / rect.height) * c.height,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasImage) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = canvasPos(e.clientX, e.clientY)
    const stroke: Stroke = { points: [p], brush: clamp(brush, 8, 200) }
    setStrokes((prev) => {
      strokeIdx.current = prev.length
      return [...prev, stroke]
    })
    lastAdd.current = performance.now()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || strokeIdx.current < 0) return
    const now = performance.now()
    if (now - lastAdd.current < 28) return
    lastAdd.current = now
    const p = canvasPos(e.clientX, e.clientY)
    const idx = strokeIdx.current
    setStrokes((prev) => {
      const next = prev.slice()
      const cur = next[idx]
      if (!cur) return prev
      next[idx] = { ...cur, points: [...cur.points, p] }
      return next
    })
  }

  function onPointerUp() {
    drawing.current = false
    strokeIdx.current = -1
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      const { canvas } = canvasFromImage(await loadImageFromFile(file))
      srcRef.current = canvas
      setFileName(file.name)
      setFileSize(file.size)
      setImgW(canvas.width)
      setImgH(canvas.height)
      setStrokes([])
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
      setFileSize(0)
      setImgW(0)
      setImgH(0)
    }
  }

  const imageMeta = useMemo(
    () => ({ fileName, fileSize, width: imgW, height: imgH }),
    [fileName, fileSize, imgW, imgH],
  )

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-mosaic.png`)
  }

  return (
    <FeatureLayout
      meta={meta}
      variant="stacked"
      toolbar={
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          label="拖放圖片到此，或點擊選擇"
          hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)} · 僅本機處理`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
      }
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
            復原
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!strokes.length} onClick={() => setStrokes([])}>
            清除筆劃
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!hasImage} onClick={download} icon="download">
            下載 PNG
          </ActionButton>
        </div>
      }
      infoItems={[
        { label: '單檔上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '操作', value: '拖曳塗抹馬賽克（支援觸控）' },
        { label: '輸出', value: 'PNG' },
      ]}
      faq={[ftPrivacyLocal, ftImageLocalFaq()]}
      aside={
        <FtAsidePreview
          title="塗抹預覽"
          tag={hasImage ? <span className="tag">{strokes.length} 筆劃</span> : null}
        >
          <FtCanvasAside
            canvasRef={canvasRef}
            hasImage={hasImage}
            empty="上傳後在畫布上塗抹馬賽克"
            canvasStyle={{ cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtImageHero
          emoji="▦"
          meta={imageMeta}
          metaLine={hasImage ? `${strokes.length} 筆馬賽克筆劃 · 筆刷 ${brush}px · 格 ${block}px` : undefined}
        />
        <FtImageMetrics meta={imageMeta} extra={[{ label: '筆劃', value: strokes.length }]} />
        {error && <p className="field-error">{error}</p>}
        <FtSection title="筆刷設定" hint="在右側預覽區拖曳塗抹">
          <label className="stack">
            <span className="label">筆刷 {brush}px</span>
            <input type="range" min={8} max={200} value={brush} onChange={(e) => setBrush(clamp(Number(e.target.value), 8, 200))} />
          </label>
          <label className="stack">
            <span className="label">馬賽克格 {block}px</span>
            <input type="range" min={4} max={64} value={block} onChange={(e) => setBlock(clamp(Number(e.target.value), 4, 64))} />
          </label>
        </FtSection>
        <ActionButton className="btn accent" disabled={!hasImage} onClick={download} icon="download">
          下載 PNG
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
