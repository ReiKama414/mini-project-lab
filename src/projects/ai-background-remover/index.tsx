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
const fallback: ProjectMeta = { slug: 'ai-background-remover', title: '啟發式去背', description: '以近白／綠幕或四角洪水填色去除背景', tier: 'feature', effort: '1～3 天', tags: ['image'] }
const meta = getProject('ai-background-remover') ?? fallback

type Mode = 'white' | 'green' | 'flood'

function removeBg(canvas: HTMLCanvasElement, mode: Mode, tolerance: number) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const w = canvas.width
  const h = canvas.height
  const tol = clamp(tolerance, 5, 120)

  if (mode === 'white') {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i]! > 255 - tol && d[i + 1]! > 255 - tol && d[i + 2]! > 255 - tol) d[i + 3] = 0
    }
  } else if (mode === 'green') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!
      if (g > r + 30 && g > b + 30 && g > 80) d[i + 3] = 0
    }
  } else {
    // Flood from four corners using each corner's own seed color
    const visited = new Uint8Array(w * h)
    const queue: number[] = []
    const seedIdx = [0, w - 1, (h - 1) * w, h * w - 1]
    const nearSeed = (i: number, sr: number, sg: number, sb: number) =>
      Math.abs(d[i]! - sr) <= tol && Math.abs(d[i + 1]! - sg) <= tol && Math.abs(d[i + 2]! - sb) <= tol

    for (const s of seedIdx) {
      if (s < 0 || s >= w * h) continue
      const sr = d[s * 4]!
      const sg = d[s * 4 + 1]!
      const sb = d[s * 4 + 2]!
      queue.length = 0
      if (!visited[s]) {
        visited[s] = 1
        queue.push(s)
      }
      while (queue.length) {
        const p = queue.pop()!
        const i = p * 4
        if (!nearSeed(i, sr, sg, sb)) continue
        d[i + 3] = 0
        const x = p % w
        const y = (p / w) | 0
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (visited[ni]) continue
          visited[ni] = 1
          queue.push(ni)
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [mode, setMode] = useLocalStorage<Mode>('lab:ai-bg:mode', 'white')
  const [tolerance, setTolerance] = useLocalStorage('lab:ai-bg:tol', 32)

  const redraw = useCallback(() => {
    const src = srcRef.current
    const out = canvasRef.current
    if (!src || !out) return
    out.width = src.width
    out.height = src.height
    out.getContext('2d')!.drawImage(src, 0, 0)
    removeBg(out, mode, tolerance)
  }, [mode, tolerance])

  useEffect(() => { redraw() }, [redraw])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) { setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`); return }
    try {
      setError('')
      const { canvas } = canvasFromImage(await loadImageFromFile(file))
      srcRef.current = canvas
      setFileName(file.name)
      setFileSize(file.size)
      setImgW(canvas.width)
      setImgH(canvas.height)
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

  const modeLabel = mode === 'white' ? '近白背景' : mode === 'green' ? '綠幕' : '四角洪水'

  function download() {
    if (!canvasRef.current || !hasImage) return
    redraw()
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-nobg.png`)
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
          hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)} · 啟發式去背（非雲端 AI）`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
      }
      actions={
        <ActionButton className="btn sm accent" disabled={!hasImage} onClick={download} icon="download">
          下載 PNG
        </ActionButton>
      }
      infoItems={[
        { label: '單檔上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '演算法', value: '近白／綠幕／四角洪水（非 AI 模型）' },
        { label: '輸出', value: '透明 PNG' },
      ]}
      faq={[
        ftPrivacyLocal,
        ftImageLocalFaq(`像素級運算在瀏覽器執行；複雜背景或高解析度可能效果不佳。`),
      ]}
      aside={
        <FtAsidePreview title="透明背景預覽" tag={hasImage ? <span className="tag">PNG</span> : null}>
          <FtCanvasAside canvasRef={canvasRef} hasImage={hasImage} empty="上傳後即時去背預覽" checkerboard />
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtImageHero
          emoji="✂️"
          meta={imageMeta}
          metaLine={hasImage ? `${modeLabel} · 容差 ${tolerance}` : '選擇模式與容差後右側即時預覽'}
        />
        <FtImageMetrics meta={imageMeta} extra={[{ label: '模式', value: hasImage ? modeLabel : '—' }]} />
        {error && <p className="field-error">{error}</p>}
        <FtSection title="去背模式">
          <div className="row">
            {([['white', '近白背景'], ['green', '綠幕'], ['flood', '四角洪水']] as [Mode, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`btn sm ${mode === id ? 'accent' : 'ghost'}`} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>
          <label className="stack">
            <span className="label">容差 {tolerance}</span>
            <input type="range" min={5} max={120} value={tolerance} onChange={(e) => setTolerance(clamp(Number(e.target.value), 5, 120))} />
          </label>
        </FtSection>
        <ActionButton className="btn accent" disabled={!hasImage} onClick={download} icon="download">
          下載透明 PNG
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
