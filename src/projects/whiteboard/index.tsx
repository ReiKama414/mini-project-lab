import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('whiteboard')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [color, setColor] = useLocalStorage('lab:whiteboard:color', '#22d3ee')
  const [size, setSize] = useLocalStorage('lab:whiteboard:size', 3)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, c.width, c.height)
  }, [])

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0]! : e
    return { x: ((src.clientX - r.left) / r.width) * c.width, y: ((src.clientY - r.top) / r.height) * c.height }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : color
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <label className="label">粗細 {size}</label>
        <input type="range" min={1} max={24} value={size} onChange={(e) => setSize(Number(e.target.value))} />
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
