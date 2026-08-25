import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, rgb } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-sign',
  title: 'PDF 簽名',
  description: '在指定頁加上手寫簽名與姓名（支援中文）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-sign') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const NAME_MAX = 60

function isPadBlank(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! < 250 || data[i + 1]! < 250 || data[i + 2]! < 250) return false
  }
  return true
}

async function nameToPng(text: string, width = 420, height = 48) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#222'
  ctx.font = 'italic 22px "Noto Sans TC", "Microsoft JhengHei", sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - 8, height / 2)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('姓名影像失敗')
  return new Uint8Array(await blob.arrayBuffer())
}

export default function Page() {
  const padRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useLocalStorage('lab:pdf-sign:name', '')
  const [pageNum, setPageNum] = useLocalStorage('lab:pdf-sign:page', 1)
  const [pageCount, setPageCount] = useState(0)

  function clearPad() {
    const c = padRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  function ensurePad() {
    const c = padRef.current
    if (!c) return
    if (c.width !== 480 || c.height !== 160) {
      c.width = 480
      c.height = 160
      clearPad()
    }
  }

  useEffect(() => {
    ensurePad()
  }, [])

  function posFromClient(clientX: number, clientY: number) {
    const c = padRef.current!
    const r = c.getBoundingClientRect()
    return { x: ((clientX - r.left) / r.width) * c.width, y: ((clientY - r.top) / r.height) * c.height }
  }

  function startDraw(clientX: number, clientY: number) {
    ensurePad()
    drawing.current = true
    const p = posFromClient(clientX, clientY)
    const ctx = padRef.current!.getContext('2d')!
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function moveDraw(clientX: number, clientY: number) {
    if (!drawing.current) return
    const p = posFromClient(clientX, clientY)
    const ctx = padRef.current!.getContext('2d')!
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function endDraw() {
    drawing.current = false
  }

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const count = doc.getPageCount()
      setPageCount(count)
      setPageNum(count)
      setFile(f)
      requestAnimationFrame(() => {
        ensurePad()
        clearPad()
      })
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
      setFile(null)
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    if (!file) return
    const pad = padRef.current
    const hasInk = pad ? !isPadBlank(pad) : false
    if (!hasInk && !isNonEmpty(name)) {
      setError('請手寫簽名或填寫姓名')
      return
    }
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const idx = clamp(pageNum, 1, doc.getPageCount()) - 1
      const page = doc.getPage(idx)
      const { width } = page.getSize()
      let y = 36

      if (hasInk && pad) {
        const png = await new Promise<Blob | null>((res) => pad.toBlob(res, 'image/png'))
        if (png) {
          const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()))
          const w = 180
          const h = (img.height / img.width) * w
          page.drawImage(img, { x: width - w - 36, y, width: w, height: h })
          y += h + 8
        }
      }

      if (isNonEmpty(name)) {
        const bytes = await nameToPng(limitText(name.trim(), NAME_MAX))
        const img = await doc.embedPng(bytes)
        const w = 160
        const h = (img.height / img.width) * w
        page.drawImage(img, { x: width - w - 36, y: Math.max(16, y - 4), width: w, height: h })
      }

      page.drawRectangle({
        x: width - 220,
        y: 20,
        width: 180,
        height: 1,
        color: rgb(0.6, 0.6, 0.6),
      })

      downloadBlob(new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }), `${file.name.replace(/\.pdf$/i, '')}-signed.pdf`)
    } catch {
      setError('簽名失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        手寫簽名以影像嵌入；姓名以中文字型畫成圖片後嵌入（避免 Helvetica 無法顯示中文）。單檔上限{' '}
        {formatBytes(PDF_MAX)}；空白簽名板不會寫入。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">上傳 PDF</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <label className="stack">
          <span className="label">簽署頁碼（1–{pageCount || '—'}）</span>
          <input
            className="field"
            type="number"
            min={1}
            max={Math.max(1, pageCount)}
            value={pageNum || 1}
            onChange={(e) => setPageNum(clamp(Number(e.target.value) || 1, 1, Math.max(1, pageCount)))}
          />
        </label>
        <div className="field-wrap">
          <label className="label">簽署人姓名</label>
          <input className="field" value={name} maxLength={NAME_MAX} onChange={(e) => setName(limitText(e.target.value, NAME_MAX))} />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(name)} / {NAME_MAX}
            </span>
          </div>
        </div>
        <div className="label">簽名板</div>
        <canvas
          ref={padRef}
          style={{
            width: '100%',
            maxWidth: 480,
            height: 160,
            border: '1px solid var(--line)',
            borderRadius: 12,
            touchAction: 'none',
            cursor: 'crosshair',
            background: '#fff',
          }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            startDraw(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => moveDraw(e.clientX, e.clientY)}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
        />
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={clearPad}>
            清除簽名
          </button>
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
            {busy ? '處理中…' : '套用並下載'}
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
