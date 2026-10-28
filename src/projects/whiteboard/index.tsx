import { PortfolioLayout } from '../../components/PortfolioLayout'
import { FileDrop } from '../../components/FileDrop'
import { FtSection } from '../../components/FeatureToolUI'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { loadImageFromFile, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { charCount, clamp, formatBytes, limitText, parseNumber, uid } from '../../lib/utils'
import { IconMaximize, IconMinimize } from '../../components/icons'
import { ActionButton } from '../../components/ActionButton'

const FILTER_MAX = 40
const LABEL_MAX = 40
const SIZE_MIN = 1
const SIZE_MAX = 32

const PALETTE = ['#1a2e28', '#f0734a', '#2a9d8f', '#e9a319', '#d6406a', '#3b82a0', '#ffffff']

const SIZE_PRESETS = [
  { label: '細', size: 2 },
  { label: '中', size: 6 },
  { label: '粗', size: 14 },
  { label: '特粗', size: 28 },
]

const DEFAULT_W = 900
const DEFAULT_H = 480

type Snapshot = { id: string; at: number; label: string; dataUrl: string }

export default function Page() {
  const boardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logicalSize = useRef({ w: DEFAULT_W, h: DEFAULT_H })
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useLocalStorage('lab:whiteboard:color', '#f0734a')
  const [size, setSize] = useLocalStorage('lab:whiteboard:size', 4)
  const [tool, setTool] = useLocalStorage<'pen' | 'eraser'>('lab:whiteboard:tool', 'pen')
  const [snapshots, setSnapshots] = useLocalStorage<Snapshot[]>('lab:whiteboard:snaps', [])
  const [history, setHistory] = useState<ImageData[]>([])
  const [strokeCount, setStrokeCount] = useState(0)
  const [snapFilter, setSnapFilter] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [bgError, setBgError] = useState('')
  const bg = '#fffdf8'

  const fitCanvas = useCallback(async (w: number, h: number) => {
    const c = canvasRef.current
    if (!c) return
    const lw = Math.max(1, Math.floor(w))
    const lh = Math.max(1, Math.floor(h))
    logicalSize.current = { w: lw, h: lh }
    const prev = c.width > 0 && c.height > 0 ? c.toDataURL('image/png') : ''
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.max(1, Math.floor(lw * dpr))
    c.height = Math.max(1, Math.floor(lh * dpr))
    c.style.width = `${lw}px`
    c.style.height = `${lh}px`
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, lw, lh)
    if (!prev) return
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, lw, lh)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = prev
    })
  }, [])

  const layoutCanvas = useCallback(async () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const w = Math.max(280, wrap.clientWidth)
    const h = Math.max(220, wrap.clientHeight)
    await fitCanvas(w, h)
  }, [fitCanvas])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      void layoutCanvas()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [layoutCanvas])

  const runUndo = useCallback(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    setHistory((h) => {
      if (h.length < 2 || !c || !ctx) return h
      const next = h.slice(0, -1)
      const snap = next[next.length - 1]
      if (!snap) return h
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.putImageData(snap, 0, 0)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      setStrokeCount((n) => Math.max(0, n - 1))
      return next
    })
  }, [])

  const undoSteps = Math.max(0, history.length - 1)

  useEffect(() => {
    function onFs() {
      const board = boardRef.current
      const on = !!board && document.fullscreenElement === board
      if (on) board.classList.remove('wb-board--pseudo-fs')
      setFullscreen(on || !!board?.classList.contains('wb-board--pseudo-fs'))
      void layoutCanvas()
    }
    function onResize() {
      void layoutCanvas()
    }
    function onKey(e: KeyboardEvent) {
      const board = boardRef.current
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        runUndo()
        return
      }
      if (e.key !== 'Escape' || !board) return
      if (document.fullscreenElement === board) {
        void document.exitFullscreen()
        return
      }
      if (board.classList.contains('wb-board--pseudo-fs')) {
        board.classList.remove('wb-board--pseudo-fs')
        setFullscreen(false)
        void layoutCanvas()
      }
    }
    document.addEventListener('fullscreenchange', onFs)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [layoutCanvas, runUndo])

  useEffect(() => {
    void layoutCanvas().then(() => {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      try {
        setHistory([ctx.getImageData(0, 0, c.width, c.height)])
      } catch {
        /* ignore */
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredSnaps = useMemo(() => {
    const q = snapFilter.trim().toLowerCase()
    if (!q) return snapshots
    return snapshots.filter((s) => s.label.toLowerCase().includes(q))
  }, [snapshots, snapFilter])

  function pushHistory() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    try {
      const snap = ctx.getImageData(0, 0, c.width, c.height)
      setHistory((h) => [...h.slice(-24), snap])
    } catch {
      /* ignore */
    }
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const { w: lw, h: lh } = logicalSize.current
    if (r.width < 1 || r.height < 1) return { x: 0, y: 0 }
    const x = ((e.clientX - r.left) / r.width) * lw
    const y = ((e.clientY - r.top) / r.height) * lh
    return { x: clamp(x, 0, lw), y: clamp(y, 0, lh) }
  }

  function startPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pointerPos(e)
  }

  function movePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pointerPos(e)
    const pressure = e.pressure > 0 ? e.pressure : 1
    const width = tool === 'eraser' ? size * 1.35 : size * (0.4 + 0.6 * pressure)
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = tool === 'eraser' ? bg : color
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  function endPointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    drawing.current = false
    last.current = null
    setStrokeCount((n) => n + 1)
    pushHistory()
  }

  function clear() {
    if (!window.confirm('清空畫布？仍可「復原」回到上一狀態。')) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const { w, h } = logicalSize.current
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    setStrokeCount(0)
    pushHistory()
  }

  function downloadPng() {
    const c = canvasRef.current
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `whiteboard-${Date.now()}.png`
    a.click()
  }

  function saveSnapshot() {
    const c = canvasRef.current
    if (!c) return
    const label = limitText(`草稿 ${snapshots.length + 1}`, LABEL_MAX)
    const dataUrl = c.toDataURL('image/png')
    setSnapshots((xs) => [{ id: uid('wb'), at: Date.now(), label, dataUrl }, ...xs].slice(0, 8))
  }

  function loadSnapshot(s: Snapshot) {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { w, h } = logicalSize.current
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      pushHistory()
    }
    img.src = s.dataUrl
  }

  async function importBackground(file: File | null) {
    if (!file) return
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    setBgError('')
    try {
      const img = await loadImageFromFile(file)
      const { w, h } = logicalSize.current
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      const scale = Math.min(w / iw, h / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = (w - dw) / 2
      const dy = (h - dh) / 2
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, dx, dy, dw, dh)
      pushHistory()
    } catch {
      setBgError('無法讀取背景圖')
    }
  }

  function drawTemplate(kind: 'grid' | 'dot' | 'lines') {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { w, h } = logicalSize.current
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#e5e0d6'
    ctx.lineWidth = 1
    if (kind === 'grid') {
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
    } else if (kind === 'dot') {
      ctx.fillStyle = '#d5cfc3'
      for (let x = 20; x < w; x += 28) {
        for (let y = 20; y < h; y += 28) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else {
      for (let y = 48; y < h; y += 36) {
        ctx.beginPath()
        ctx.moveTo(24, y)
        ctx.lineTo(w - 24, y)
        ctx.stroke()
      }
    }
    setStrokeCount(0)
    pushHistory()
  }

  async function toggleFullscreen() {
    const el = boardRef.current
    if (!el) return
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      const el = boardRef.current
      if (!el) return
      const next = !el.classList.contains('wb-board--pseudo-fs')
      el.classList.toggle('wb-board--pseudo-fs', next)
      setFullscreen(next)
      requestAnimationFrame(() => void layoutCanvas())
    }
  }

  return (
    <PortfolioLayout
      slug="whiteboard"
      heroSubtitle="Canvas 塗鴉、模板、PNG 與本機草稿；操作說明見頁底「更多資訊」"
      footerHint="快捷：Ctrl+Z（⌘Z）復原 · Esc 退出全螢幕 · 工具列過長可橫向捲動"
      extraInfo={[{ label: '復原（本頁）', value: `${undoSteps} 步可用` }]}
      metrics={[
        { label: '筆劃', value: strokeCount },
        { label: '復原', value: `${undoSteps} 步` },
        { label: '草稿', value: `${snapshots.length} / 8` },
        { label: '工具', value: tool === 'pen' ? '筆' : '擦布' },
        { label: '粗細', value: `${size}px` },
      ]}
      actions={
        <div className="row">
          <button type="button" className="btn sm accent" onClick={() => void toggleFullscreen()}>
            {fullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
            {fullscreen ? '結束全螢幕' : '全螢幕繪圖'}
          </button>
          <button type="button" className="btn sm ghost" onClick={runUndo} disabled={undoSteps < 1}>
            復原
          </button>
          <button type="button" className="btn sm ghost" onClick={saveSnapshot}>
            存草稿
          </button>
          <ActionButton className="btn sm teal" onClick={downloadPng}>
            下載 PNG
          </ActionButton>
        </div>
      }
    >
      <FtSection title="畫布" hint="單指／滑鼠拖曳繪圖；全螢幕時隱藏草稿與背景匯入。">
      <div
        ref={boardRef}
        className={`wb-board${fullscreen ? ' wb-board--fs' : ''}`}
      >
        <div className="panel wb-toolbar" style={{ marginBottom: 8 }}>
          <div className="wb-toolbar-row">
            <span className="wb-toolbar-label">顏色</span>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`筆色 ${c}`}
                onClick={() => {
                  setColor(c)
                  setTool('pen')
                }}
                className="wb-swatch"
                style={{
                  border: color === c && tool === 'pen' ? '2px solid var(--ink)' : '1px solid var(--line)',
                  background: c,
                }}
              />
            ))}
            <input type="color" value={color} aria-label="自訂筆色" onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="wb-toolbar-row">
            <span className="wb-toolbar-label">筆刷</span>
            <label className="label wb-toolbar-size-label">
              粗細 {size}
            </label>
            <input
              type="range"
              min={SIZE_MIN}
              max={SIZE_MAX}
              value={clamp(size, SIZE_MIN, SIZE_MAX)}
              aria-label="筆刷粗細"
              onChange={(e) => setSize(clamp(parseNumber(e.target.value, 4), SIZE_MIN, SIZE_MAX))}
            />
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`btn sm ${size === p.size ? 'accent' : 'ghost'}`}
                onClick={() => setSize(p.size)}
              >
                {p.label}
              </button>
            ))}
            <button type="button" className={`btn sm ${tool === 'pen' ? 'accent' : 'ghost'}`} onClick={() => setTool('pen')}>
              筆
            </button>
            <button
              type="button"
              className={`btn sm ${tool === 'eraser' ? 'accent' : 'ghost'}`}
              onClick={() => setTool('eraser')}
            >
              擦布
            </button>
          </div>
          <div className="wb-toolbar-row">
            <span className="wb-toolbar-label">模板</span>
            <button type="button" className="btn sm ghost" onClick={() => drawTemplate('grid')}>
              格線
            </button>
            <button type="button" className="btn sm ghost" onClick={() => drawTemplate('dot')}>
              點紙
            </button>
            <button type="button" className="btn sm ghost" onClick={() => drawTemplate('lines')}>
              橫線
            </button>
          </div>
          <div className="wb-toolbar-row">
            <span className="wb-toolbar-label">操作</span>
            <ActionButton className="btn sm danger" onClick={clear}>
              清空
            </ActionButton>
            <button type="button" className="btn sm accent wb-fs-btn" onClick={() => void toggleFullscreen()}>
              {fullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
              {fullscreen ? '退出' : '全螢幕'}
            </button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="wb-canvas-wrap panel"
          style={fullscreen ? undefined : { aspectRatio: `${DEFAULT_W} / ${DEFAULT_H}` }}
        >
          <canvas
            ref={canvasRef}
            className="wb-canvas"
            aria-label="塗鴉畫布"
            style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            onPointerDown={startPointer}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
          />
        </div>

        <div className="wb-status muted" aria-live="polite">
          <span
            className="wb-swatch wb-swatch--inline"
            style={{ background: tool === 'eraser' ? bg : color, border: '1px solid var(--line)' }}
            aria-hidden
          />
          <span>
            {tool === 'pen' ? '筆' : '擦布'} · {size}px · 復原 {undoSteps} 步
            {fullscreen ? ' · 全螢幕' : ''}
          </span>
        </div>

        {!fullscreen && (
          <div className="stack wb-bg-import">
            <span className="label">匯入背景圖</span>
            <FileDrop
              accept={IMAGE_ACCEPT}
              maxBytes={IMAGE_MAX_BYTES}
              label="拖放背景圖片到此，或點擊選擇"
              hint={`以 contain 繪入 · 上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
              onFiles={(files) => void importBackground(files[0] ?? null)}
            />
            {bgError && <p className="field-error">{bgError}</p>}
          </div>
        )}
      </div>
      </FtSection>

      {!fullscreen && (
      <FtSection title="草稿" hint="存於瀏覽器本機，最多 8 份；載入會依目前畫布尺寸縮放。">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="label" style={{ margin: 0 }}>
            已存 {snapshots.length} / 8
          </span>
          <button type="button" className="btn sm ghost" disabled={!snapshots.length} onClick={() => setSnapshots([])}>
            清空草稿
          </button>
        </div>
        <input
          className="field"
          placeholder="篩選草稿名稱…"
          value={snapFilter}
          maxLength={FILTER_MAX}
          onChange={(e) => setSnapFilter(limitText(e.target.value, FILTER_MAX))}
        />
        <div className="field-meta">
          <span className="field-hint">篩選</span>
          <span>
            {charCount(snapFilter)} / {FILTER_MAX}
          </span>
        </div>
        <ul className="list">
          {filteredSnaps.map((s) => (
            <li key={s.id} className="list-item" style={{ alignItems: 'center', gap: 12 }}>
              <img
                src={s.dataUrl}
                alt=""
                style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
              />
              <div style={{ flex: 1 }}>
                <strong>{s.label}</strong>
                <div className="muted mono" style={{ fontSize: 11 }}>
                  {new Date(s.at).toLocaleString('zh-TW')}
                </div>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => loadSnapshot(s)}>
                載入
              </button>
              <button
                type="button"
                className="btn sm danger"
                onClick={() => setSnapshots((xs) => xs.filter((x) => x.id !== s.id))}
              >
                刪
              </button>
            </li>
          ))}
          {!filteredSnaps.length && <p className="muted">按 Hero「存草稿」或上方工具列可儲存目前畫面（PNG 資料，限 8 份）</p>}
        </ul>
      </div>
      </FtSection>
      )}
    </PortfolioLayout>
  )
}
