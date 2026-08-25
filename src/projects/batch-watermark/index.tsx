import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { loadImageFromFile, canvasFromImage, downloadBlob, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import JSZip from 'jszip'

const fallback: ProjectMeta = { slug: 'batch-watermark', title: '批次浮水印', description: '為多張圖片一次加上浮水印並打包下載。', tier: 'feature', effort: '1～3 天', tags: ['utility'] }
const meta = getProject('batch-watermark') ?? fallback

const TEXT_MAX = 80
const MAX_FILES = 30

function applyWatermark(canvas: HTMLCanvasElement, text: string, opacity: number, size: number, angle: number, color: string) {
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
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useLocalStorage('lab:batch-watermark:text', '僅供核對使用')
  const [opacity, setOpacity] = useLocalStorage('lab:batch-watermark:opacity', 28)
  const [fontSize, setFontSize] = useLocalStorage('lab:batch-watermark:size', 28)
  const [angle, setAngle] = useLocalStorage('lab:batch-watermark:angle', -30)
  const [color, setColor] = useLocalStorage('lab:batch-watermark:color', '#1a2e28')

  function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
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

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn sm accent" disabled={!files.length || !isNonEmpty(text) || busy} onClick={() => void processZip()}>{busy ? '處理中…' : '下載 ZIP'}</button>}>
      <p className="muted" style={{ marginBottom: 12 }}>一次最多 {MAX_FILES} 張，全部在瀏覽器本機處理。</p>
      <div className="panel stack">
        <label className="stack"><span className="label">選擇多張圖片</span><input className="field" type="file" accept={IMAGE_ACCEPT} multiple onChange={(e) => onFiles(e.target.files)} /></label>
        {files.length > 0 && <p className="muted" style={{ margin: 0 }}>已選 {files.length} 張 · {formatBytes(files.reduce((n, f) => n + f.size, 0))}</p>}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">浮水印文字</label>
          <input className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`} value={text} maxLength={TEXT_MAX} onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))} />
          <div className="field-meta"><span>{!isNonEmpty(text) ? '請輸入文字' : ' '}</span><span>{charCount(text)} / {TEXT_MAX}</span></div>
        </div>
        <div className="grid-2">
          <label className="stack"><span className="label">透明度 {opacity}%</span><input type="range" min={5} max={80} value={opacity} onChange={(e) => setOpacity(clamp(Number(e.target.value), 5, 80))} /></label>
          <label className="stack"><span className="label">字級 {fontSize}px</span><input type="range" min={12} max={120} value={fontSize} onChange={(e) => setFontSize(clamp(Number(e.target.value), 12, 120))} /></label>
          <label className="stack"><span className="label">角度 {angle}°</span><input type="range" min={-90} max={90} value={angle} onChange={(e) => setAngle(clamp(Number(e.target.value), -90, 90))} /></label>
          <label className="stack"><span className="label">顏色</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        <ul className="stack" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {files.map((f) => <li key={f.name + f.size}>{f.name} · {formatBytes(f.size)}</li>)}
        </ul>
        <button type="button" className="btn accent" disabled={!files.length || !isNonEmpty(text) || busy} onClick={() => void processZip()}>{busy ? '處理中…' : '套用並下載 ZIP'}</button>
      </div>
    </ProjectShell>
  )
}
