import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { FileDrop } from '../../components/FileDrop'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { loadImageFromFile, downloadCanvas, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { ActionButton } from '../../components/ActionButton'
import { FtMetric, FtMetricGrid, FtRowItem, FtRowList, FtSection, FtToolHero, FtToolRoot } from '../../components/FeatureToolUI'
import { FtAsidePreview, FtCanvasAside, ftImageLocalFaq } from '../../components/FtImageToolUI'

const fallback: ProjectMeta = {
  slug: 'image-collage',
  title: '圖片拼貼',
  description: '多圖拼成網格拼貼並下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('image-collage') ?? fallback

const MAX_FILES = 12

function revokeAll(urls: string[]) {
  for (const u of urls) {
    if (u) URL.revokeObjectURL(u)
  }
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgsRef = useRef<HTMLImageElement[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cols, setCols] = useLocalStorage('lab:image-collage:cols', 2)
  const [gap, setGap] = useLocalStorage('lab:image-collage:gap', 12)
  const [cell, setCell] = useLocalStorage('lab:image-collage:cell', 400)
  const [bg, setBg] = useLocalStorage('lab:image-collage:bg', '#ffffff')
  const [dragOver, setDragOver] = useState<number | null>(null)
  const previewsRef = useRef<string[]>([])
  const dragFrom = useRef<number | null>(null)

  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    return () => {
      revokeAll(previewsRef.current)
    }
  }, [])

  const redraw = useCallback(() => {
    const imgs = imgsRef.current
    const out = canvasRef.current
    if (!imgs.length || !out) return
    const c = clamp(cols, 1, 4)
    const g = clamp(gap, 0, 60)
    const s = clamp(cell, 120, 800)
    const rows = Math.ceil(imgs.length / c)
    out.width = c * s + (c + 1) * g
    out.height = rows * s + (rows + 1) * g
    const ctx = out.getContext('2d')!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, out.width, out.height)
    imgs.forEach((img, i) => {
      const col = i % c
      const row = (i / c) | 0
      const x = g + col * (s + g)
      const y = g + row * (s + g)
      const scale = Math.max(s / img.naturalWidth, s / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      const sx = (dw - s) / 2 / scale
      const sy = (dh - s) / 2 / scale
      ctx.drawImage(img, sx, sy, s / scale, s / scale, x, y, s, s)
    })
  }, [cols, gap, cell, bg])

  useEffect(() => {
    redraw()
  }, [redraw, files])

  async function onFiles(list: File[]) {
    const arr = list.slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.size > IMAGE_MAX_BYTES) {
        setError(`「${f.name}」過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
        return
      }
    }
    setBusy(true)
    try {
      setError('')
      const loaded = await Promise.all(arr.map((f) => loadImageFromFile(f)))
      revokeAll(previewsRef.current)
      imgsRef.current = loaded
      setPreviews(arr.map((f) => URL.createObjectURL(f)))
      setFiles(arr)
    } catch {
      setError('無法讀取部分圖片')
      revokeAll(previewsRef.current)
      imgsRef.current = []
      setPreviews([])
      setFiles([])
    } finally {
      setBusy(false)
    }
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return
    setFiles((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })
    setPreviews((prev) => {
      if (from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item ?? '')
      return next
    })
    const imgs = [...imgsRef.current]
    if (from < imgs.length && to < imgs.length) {
      const [item] = imgs.splice(from, 1)
      imgs.splice(to, 0, item!)
      imgsRef.current = imgs
    }
  }

  function move(i: number, dir: -1 | 1) {
    reorder(i, i + dir)
  }

  function download() {
    if (!canvasRef.current || !files.length) return
    redraw()
    downloadCanvas(canvasRef.current, 'collage.png')
  }

  const totalSize = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files])
  const outDims = useMemo(() => {
    if (!files.length) return { w: 0, h: 0 }
    const c = clamp(cols, 1, 4)
    const g = clamp(gap, 0, 60)
    const s = clamp(cell, 120, 800)
    const rows = Math.ceil(files.length / c)
    return { w: c * s + (c + 1) * g, h: rows * s + (rows + 1) * g }
  }, [files.length, cols, gap, cell])

  return (
    <FeatureLayout
      meta={meta}
      variant="stacked"
      toolbar={
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          multiple
          maxFiles={MAX_FILES}
          disabled={busy}
          label="拖放圖片到此，或點擊選擇（可多選）"
          hint={`單張上限 ${formatBytes(IMAGE_MAX_BYTES)} · 最多 ${MAX_FILES} 張 · 僅本機處理`}
          onFiles={(picked) => void onFiles(picked)}
        />
      }
      actions={
        <ActionButton className="btn sm accent" disabled={!files.length || busy} onClick={download} icon="download">
          下載拼貼
        </ActionButton>
      }
      infoItems={[
        { label: '張數上限', value: `${MAX_FILES} 張` },
        { label: '單檔上限', value: formatBytes(IMAGE_MAX_BYTES) },
        { label: '排版', value: 'cover 裁切 · 可拖曳排序' },
      ]}
      faq={[
        ftPrivacyLocal,
        ftImageLocalFaq(`最多 ${MAX_FILES} 張同時載入；總像素過大可能失敗或極慢。`),
      ]}
      aside={
        <FtAsidePreview
          title="拼貼預覽"
          tag={outDims.w ? <span className="tag mono">{outDims.w}×{outDims.h}</span> : null}
        >
          <FtCanvasAside canvasRef={canvasRef} hasImage={files.length > 0} empty="上傳多張圖片後即時預覽拼貼" />
        </FtAsidePreview>
      }
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🧩"
          title={files.length ? `已選 ${files.length} 張` : '尚未選擇圖片'}
          subtitle={files.length ? `總大小 ${formatBytes(totalSize)} · ${cols} 欄 · 格寬 ${cell}px` : `最多 ${MAX_FILES} 張`}
          meta={outDims.w ? `輸出畫布 ${outDims.w} × ${outDims.h} px` : '調整欄數、格寬與間距'}
          badge={busy ? <span className="tag">讀取中</span> : files.length ? <span className="tag">可下載</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="張數" value={files.length || '—'} />
          <FtMetric label="總大小" value={files.length ? formatBytes(totalSize) : '—'} mono />
          <FtMetric label="輸出寬×高" value={outDims.w ? `${outDims.w} × ${outDims.h}` : '—'} mono />
          <FtMetric label="欄數 / 間距" value={files.length ? `${cols} 欄 · ${gap}px` : '—'} />
        </FtMetricGrid>
        {error && <p className="field-error">{error}</p>}
        {busy && <p className="field-hint">讀取中…</p>}

        {files.length > 0 && (
          <FtSection title="排序" hint="拖曳列項目或使用上移／下移">
            <FtRowList>
              {files.map((f, i) => (
                <FtRowItem key={`${f.name}-${f.size}-${f.lastModified}-${i}`}>
                  <div
                    className="row"
                    draggable={!busy}
                    onDragStart={() => {
                      dragFrom.current = i
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null
                      setDragOver(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(i)
                    }}
                    onDragLeave={() => {
                      setDragOver((cur) => (cur === i ? null : cur))
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from = dragFrom.current
                      setDragOver(null)
                      if (from == null) return
                      reorder(from, i)
                      dragFrom.current = null
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      gap: 8,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      cursor: busy ? 'default' : 'grab',
                      opacity: busy ? 0.7 : 1,
                      padding: 4,
                      borderRadius: 8,
                      border: dragOver === i ? '1px dashed var(--accent, #888)' : '1px solid transparent',
                    }}
                  >
                    {previews[i] ? (
                      <img
                        src={previews[i]}
                        alt={f.name}
                        style={{
                          width: 40,
                          height: 40,
                          objectFit: 'cover',
                          border: '1px solid var(--line)',
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {i + 1}. {f.name}
                    </span>
                    <span className="tag">{formatBytes(f.size)}</span>
                  </div>
                  <div className="row">
                    <ActionButton className="btn sm ghost" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                      上移
                    </ActionButton>
                    <ActionButton className="btn sm ghost" disabled={busy || i === files.length - 1} onClick={() => move(i, 1)}>
                      下移
                    </ActionButton>
                  </div>
                </FtRowItem>
              ))}
            </FtRowList>
          </FtSection>
        )}

        <FtSection title="版面">
          <label className="stack">
            <span className="label">欄數 {cols}</span>
            <input type="range" min={1} max={4} value={cols} onChange={(e) => setCols(clamp(Number(e.target.value), 1, 4))} />
          </label>
          <label className="stack">
            <span className="label">格寬 {cell}px</span>
            <input type="range" min={120} max={800} value={cell} onChange={(e) => setCell(clamp(Number(e.target.value), 120, 800))} />
          </label>
          <label className="stack">
            <span className="label">間距 {gap}px</span>
            <input type="range" min={0} max={60} value={gap} onChange={(e) => setGap(clamp(Number(e.target.value), 0, 60))} />
          </label>
          <label className="stack">
            <span className="label">背景色</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
        </FtSection>

        <ActionButton className="btn accent" disabled={!files.length || busy} onClick={download} icon="download">
          下載 PNG
        </ActionButton>
      </FtToolRoot>
    </FeatureLayout>
  )
}
