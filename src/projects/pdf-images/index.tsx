import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import * as pdfjs from 'pdfjs-dist'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-images',
  title: 'PDF 內嵌圖片擷取',
  description: '擷取 PDF 中的內嵌圖片並打包。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-images') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 40
const FEW_EMBEDDED = 2

type Mode = 'embedded' | 'render'
type ImgItem = { url: string; name: string; blob: Blob }

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [images, setImages] = useState<ImgItem[]>([])
  const [mode, setMode] = useState<Mode>('embedded')
  const [showRenderOffer, setShowRenderOffer] = useState(false)
  const [pageCount, setPageCount] = useState(0)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const runId = useRef(0)
  const imagesRef = useRef<ImgItem[]>([])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    return () => {
      runId.current += 1
      imagesRef.current.forEach((im) => URL.revokeObjectURL(im.url))
    }
  }, [])

  function clearImages() {
    imagesRef.current.forEach((im) => URL.revokeObjectURL(im.url))
    setImages([])
  }

  function abortBusy() {
    runId.current += 1
    setBusy(false)
    setProgress('')
  }

  async function extractEmbedded(data: Uint8Array, id: number): Promise<ImgItem[]> {
    const pdf = await pdfjs.getDocument({ data }).promise
    if (id !== runId.current) return []
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
    }
    setPageCount(pdf.numPages)
    const found: ImgItem[] = []
    let n = 0
    for (let p = 1; p <= pdf.numPages; p++) {
      if (id !== runId.current) return []
      setProgress(`第 ${p}/${pdf.numPages} 頁`)
      const page = await pdf.getPage(p)
      const ops = await page.getOperatorList()
      const { OPS } = pdfjs
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (id !== runId.current) return []
        if (ops.fnArray[i] !== OPS.paintImageXObject && ops.fnArray[i] !== OPS.paintInlineImageXObject) continue
        const name = ops.argsArray[i]?.[0]
        if (typeof name !== 'string') continue
        try {
          const obj = await page.objs.get(name)
          if (!obj || !obj.width || !obj.height) continue
          const canvas = document.createElement('canvas')
          canvas.width = obj.width
          canvas.height = obj.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          if (obj.data) {
            const imgData = ctx.createImageData(obj.width, obj.height)
            const src = obj.data as Uint8ClampedArray
            if (src.length === obj.width * obj.height * 4) {
              imgData.data.set(src)
            } else if (src.length === obj.width * obj.height * 3) {
              for (let j = 0, k = 0; j < src.length; j += 3, k += 4) {
                imgData.data[k] = src[j]!
                imgData.data[k + 1] = src[j + 1]!
                imgData.data[k + 2] = src[j + 2]!
                imgData.data[k + 3] = 255
              }
            } else if (src.length === obj.width * obj.height) {
              for (let j = 0, k = 0; j < src.length; j++, k += 4) {
                const v = src[j]!
                imgData.data[k] = v
                imgData.data[k + 1] = v
                imgData.data[k + 2] = v
                imgData.data[k + 3] = 255
              }
            } else continue
            ctx.putImageData(imgData, 0, 0)
          } else if (obj.bitmap) {
            ctx.drawImage(obj.bitmap, 0, 0)
          } else continue
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
          if (!blob) continue
          n++
          found.push({ url: URL.createObjectURL(blob), name: `p${p}-img${n}.png`, blob })
        } catch {
          /* skip bad image object */
        }
      }
    }
    return found
  }

  async function renderPages(data: Uint8Array, id: number): Promise<ImgItem[]> {
    const pdf = await pdfjs.getDocument({ data }).promise
    if (id !== runId.current) return []
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
    }
    setPageCount(pdf.numPages)
    const found: ImgItem[] = []
    for (let p = 1; p <= pdf.numPages; p++) {
      if (id !== runId.current) return []
      setProgress(`第 ${p}/${pdf.numPages} 頁`)
      const page = await pdf.getPage(p)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvasContext: ctx, viewport }).promise
      if (id !== runId.current) return []
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) continue
      found.push({
        url: URL.createObjectURL(blob),
        name: `page-${String(p).padStart(3, '0')}.png`,
        blob,
      })
    }
    return found
  }

  async function processFile(f: File, nextMode: Mode) {
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    const id = ++runId.current
    setBusy(true)
    setError('')
    setProgress('')
    setShowRenderOffer(false)
    clearImages()
    setMode(nextMode)
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      if (id !== runId.current) return
      const found = nextMode === 'embedded' ? await extractEmbedded(data, id) : await renderPages(data, id)
      if (id !== runId.current) {
        found.forEach((im) => URL.revokeObjectURL(im.url))
        return
      }
      setImages(found)
      setFile(f)
      setFileName(f.name)
      if (nextMode === 'embedded') {
        if (!found.length) {
          setError('未找到可擷取的內嵌圖片（可能為向量／字型繪製）')
          setShowRenderOffer(true)
        } else if (found.length <= FEW_EMBEDDED) {
          setError(`僅找到 ${found.length} 張內嵌圖，若不足可改用頁面渲染`)
          setShowRenderOffer(true)
        } else {
          setError('')
        }
      } else if (!found.length) {
        setError('頁面渲染未產生任何圖片')
      } else {
        setError('')
      }
    } catch (e) {
      if (id !== runId.current) return
      setError(e instanceof Error ? e.message : '擷取失敗，請確認檔案為有效 PDF')
      setFile(null)
      setFileName('')
      setPageCount(0)
    } finally {
      if (id === runId.current) {
        setBusy(false)
        setProgress('')
      }
    }
  }

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    await processFile(f, 'embedded')
  }

  async function switchToRender() {
    if (!file) return
    await processFile(file, 'render')
  }

  async function downloadZip() {
    if (!images.length || busy) return
    setBusy(true)
    setError('')
    try {
      const zip = new JSZip()
      for (const im of images) zip.file(im.name, im.blob)
      const base = fileName.replace(/\.pdf$/i, '') || 'pdf-images'
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}-images.zip`)
    } catch {
      setError('打包 ZIP 失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!images.length || busy} onClick={() => void downloadZip()}>
          下載 ZIP
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機擷取內嵌點陣圖；若找不到或數量偏少，可改用「頁面渲染擷圖」。單檔上限 {formatBytes(PDF_MAX)}，最多{' '}
        {MAX_PAGES} 頁。
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
        {fileName && (
          <p className="muted" style={{ margin: 0 }}>
            {fileName}
            {pageCount ? ` · ${pageCount} 頁` : ''}
            {` · ${mode === 'embedded' ? '內嵌擷取' : '頁面渲染'} · 找到 ${images.length} 張`}
            {busy && progress ? ` · ${progress}` : busy ? ' · 處理中…' : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {showRenderOffer && !busy && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn accent" disabled={!file} onClick={() => void switchToRender()}>
              頁面渲染擷圖
            </button>
            <span className="field-hint" style={{ margin: 0 }}>
              將每一頁以 pdf.js 渲染成 PNG（非內嵌圖）
            </span>
          </div>
        )}
        {busy && (
          <div className="row">
            <button type="button" className="btn sm ghost" onClick={abortBusy}>
              取消
            </button>
            <span className="muted">{progress || '處理中…'}</span>
          </div>
        )}
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {images.map((im) => (
            <a key={im.url} href={im.url} download={im.name} title={im.name}>
              <img
                src={im.url}
                alt={im.name}
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'contain',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  background: '#fff',
                }}
              />
            </a>
          ))}
        </div>
        <button type="button" className="btn accent" disabled={!images.length || busy} onClick={() => void downloadZip()}>
          {busy ? progress || '處理中…' : '打包下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
