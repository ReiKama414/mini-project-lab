import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('whiteboard')!

const PALETTE = ['#1a2e28', '#f0734a', '#2a9d8f', '#e9a319', '#d6406a', '#3b82a0', '#ffffff']

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useLocalStorage('lab:whiteboard:color', '#f0734a')
  const [size, setSize] = useLocalStorage('lab:whiteboard:size', 4)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [history, setHistory] = useState<ImageData[]>([])
  const bg = '#fffdf8'

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0]! : e
    return { x: ((src.clientX - r.left) / r.width) * c.width, y: ((src.clientY - r.top) / r.height) * c.height }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || !last.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
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
    pushHistory()
  }

  function undo() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || history.length < 2) return
    const next = history.slice(0, -1)
    const snap = next[next.length - 1]
    if (!snap) return
    ctx.putImageData(snap, 0, 0)
    setHistory(next)
  }

  function clear() {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
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

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={undo} disabled={history.length < 2}>
            復原
          </button>
          <button type="button" className="btn sm teal" onClick={downloadPng}>
            下載 PNG
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
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
        <input type="range" min={1} max={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <button type="button" className={`btn sm ${tool === 'pen' ? 'accent' : 'ghost'}`} onClick={() => setTool('pen')}>
          筆
        </button>
        <button type="button" className={`btn sm ${tool === 'eraser' ? 'accent' : 'ghost'}`} onClick={() => setTool('eraser')}>
          擦布
        </button>
        <button type="button" className="btn sm danger" onClick={clear}>
          清空
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={480}
        className="panel"
        style={{ width: '100%', touchAction: 'none', cursor: 'crosshair' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    </ProjectShell>
  )
}
