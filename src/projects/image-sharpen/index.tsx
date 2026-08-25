import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadCanvas, clampByte, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'

const fallback: ProjectMeta = {
  slug: 'image-sharpen',
  title: '圖片銳化',
  description: '簡易銳化濾鏡效果。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-sharpen') ?? fallback

function sharpenCanvas(src: HTMLCanvasElement, out: HTMLCanvasElement, amount: number) {
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const a = clamp(amount, 0, 100) / 100
  if (a <= 0) return
  const w = src.width
  const h = src.height
  const img = ctx.getImageData(0, 0, w, h)
  const srcData = new Uint8ClampedArray(img.data)
  const d = img.data
  const k = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0
      let g = 0
      let b = 0
      let ki = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4
          const kv = k[ki++]!
          r += srcData[i]! * kv
          g += srcData[i + 1]! * kv
          b += srcData[i + 2]! * kv
        }
      }
      const i = (y * w + x) * 4
      d[i] = clampByte(r)
      d[i + 1] = clampByte(g)
      d[i + 2] = clampByte(b)
    }
  }
  ctx.putImageData(img, 0, 0)
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const srcRef = useRef<HTMLCanvasElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [amount, setAmount] = useLocalStorage('lab:image-sharpen:amount', 40)

  const redraw = useCallback(() => {
    if (!srcRef.current || !canvasRef.current) return
    setBusy(true)
    requestAnimationFrame(() => {
      try {
        if (srcRef.current && canvasRef.current) sharpenCanvas(srcRef.current, canvasRef.current, amount)
      } finally {
        setBusy(false)
      }
    })
  }, [amount])

  useEffect(() => {
    if (hasImage) redraw()
  }, [redraw, hasImage])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    try {
      setError('')
      srcRef.current = canvasFromImage(await loadImageFromFile(file)).canvas
      setFileName(file.name)
      setFileSize(file.size)
      setHasImage(true)
    } catch {
      setError('無法讀取圖片')
      setHasImage(false)
    }
  }

  function download() {
    if (!canvasRef.current || !hasImage || busy) return
    downloadCanvas(canvasRef.current, `${fileName.replace(/\.[^.]+$/, '') || 'image'}-sharpen.png`)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!hasImage || busy} onClick={download}>
          下載 PNG
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        簡易 3×3 卷積銳化，非專業 Unsharp Mask；大圖處理會變慢。僅本機處理，不會上傳。
      </p>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <label className="stack">
            <span className="label">上傳圖片</span>
            <input className="field" type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          </label>
          {fileName && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {fileName} · {formatBytes(fileSize)}
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          <label className="stack">
            <span className="label">銳化強度 {amount}</span>
            <input type="range" min={0} max={100} value={amount} disabled={busy} onChange={(e) => setAmount(clamp(Number(e.target.value), 0, 100))} />
          </label>
          {busy && <p className="field-hint">處理中…</p>}
          <button type="button" className="btn accent" disabled={!hasImage || busy} onClick={download}>
            下載
          </button>
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          {hasImage ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'auto', maxHeight: 560 }}>
              <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>
          ) : (
            <div className="muted" style={{ minHeight: 240, display: 'grid', placeItems: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>
              上傳後預覽
            </div>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}