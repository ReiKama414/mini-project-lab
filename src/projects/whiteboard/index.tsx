import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, limitText, parseNumber, uid } from '../../lib/utils'
import { IconMaximize, IconMinimize } from '../../components/icons'

const meta = getProject('whiteboard')!

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  const bg = '#fffdf8'

  const fitCanvas = useCallback(async (w: number, h: number) => {
    const c = canvasRef.current
    if (!c) return
    const prev = c.toDataURL('image/png')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.max(1, Math.floor(w * dpr))
    c.height = Math.max(1, Math.floor(h * dpr))
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = prev
    })
  }, [])

  const layoutCanvas = useCallback(async () => {
    const board = boardRef.current
    if (!board) return
    const isFs =
      document.fullscreenElement === board || board.classList.contains('wb-board--pseudo-fs')
    if (isFs) {
      const toolbar = board.querySelector('.wb-toolbar') as HTMLElement | null
      const barH = toolbar?.offsetHeight ?? 64
      const pad = 16
      await fitCanvas(Math.max(320, board.clientWidth - pad * 2), Math.max(240, board.clientHeight - barH - pad * 2))
    } else {
      const width = Math.min(900, Math.max(320, board.clientWidth || DEFAULT_W))
      const height = Math.round(width * (DEFAULT_H / DEFAULT_W))
      await fitCanvas(width, height)
    }
  }, [fitCanvas])

  useEffect(() => {
    void layoutCanvas().then(() => {
      // seed history after first paint
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
      if (e.key === 'Escape' && boardRef.current?.classList.contains('wb-board--pseudo-fs')) {
        boardRef.current.classList.remove('wb-board--pseudo-fs')
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
  }, [layoutCanvas])

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

  function posCss(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0]! : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    last.current = posCss(e)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || !last.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = posCss(e)
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = tool === 'eraser' ? bg : color
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    setStrokeCount((n) => n + 1)
    pushHistory()
  }

  function undo() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || history.length < 2) return
    const next = history.slice(0, -1)
    const snap = next[next.length - 1]
    if (!snap) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(snap, 0, 0)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    setHistory(next)
    setStrokeCount((n) => Math.max(0, n - 1))
  }

  function clear() {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, r.width, r.height)
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
    const r = c.getBoundingClientRect()
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, r.width, r.height)
      ctx.drawImage(img, 0, 0, r.width, r.height)
      pushHistory()
    }
    img.src = s.dataUrl
  }

  function drawTemplate(kind: 'grid' | 'dot' | 'lines') {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const w = c.getBoundingClientRect().width
    const h = c.getBoundingClientRect().height
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
      // Fallback: CSS-only expand if Fullscreen API blocked
      setFullscreen((v) => !v)
      el.classList.toggle('wb-board--pseudo-fs')
      requestAnimationFrame(() => void layoutCanvas())
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => void toggleFullscreen()}>
            {fullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
            {fullscreen ? '結束全螢幕' : '全螢幕'}
          </button>
          <button type="button" className="btn sm ghost" onClick={undo} disabled={history.length < 2}>
            復原
          </button>
          <button type="button" className="btn sm ghost" onClick={saveSnapshot}>
            存草稿
          </button>
          <button type="button" className="btn sm teal" onClick={downloadPng}>
            下載 PNG
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        本機單人塗鴉，無多人同步
      </p>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">筆劃 {strokeCount}</span>
        <span className="tag">復原層 {Math.max(0, history.length - 1)}</span>
        <span className="tag">草稿 {snapshots.length}</span>
        <span className="tag">{tool === 'pen' ? '筆' : '擦布'} · {size}px</span>
      </div>

      <div
        ref={boardRef}
        className={`wb-board${fullscreen ? ' wb-board--fs' : ''}`}
      >
        <div className="panel row wb-toolbar" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                setColor(c)
                setTool('pen')
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: color === c && tool === 'pen' ? '2px solid var(--ink)' : '1px solid var(--line)',
                background: c,
                padding: 0,
              }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <label className="label" style={{ margin: 0 }}>
            粗細 {size}
          </label>
          <input
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            value={clamp(size, SIZE_MIN, SIZE_MAX)}
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
          <button type="button" className="btn sm ghost" onClick={() => drawTemplate('grid')}>
            格線
          </button>
          <button type="button" className="btn sm ghost" onClick={() => drawTemplate('dot')}>
            點紙
          </button>
          <button type="button" className="btn sm ghost" onClick={() => drawTemplate('lines')}>
            橫線
          </button>
          <button type="button" className="btn sm danger" onClick={clear}>
            清空
          </button>
          <button type="button" className="btn sm accent" onClick={() => void toggleFullscreen()} style={{ marginLeft: 'auto' }}>
            {fullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
            {fullscreen ? '退出' : '全螢幕'}
          </button>
        </div>

        <canvas
          ref={canvasRef}
          className="panel wb-canvas"
          style={{ touchAction: 'none', cursor: 'crosshair', display: 'block', margin: '0 auto' }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <div className="panel stack" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>本機草稿（最多 8）</h3>
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
          {!filteredSnaps.length && <p className="muted">按「存草稿」可把目前畫布存到本機（體積較大，限 8 份）。</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
