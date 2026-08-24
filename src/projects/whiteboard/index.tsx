import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'

const meta = getProject('whiteboard')!

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [color, setColor] = useState('#1a2e28')
  const [size, setSize] = useState(3)
  const [history, setHistory] = useState<ImageData[]>([])
  const colorRef = useRef(color)
  const sizeRef = useRef(size)
  colorRef.current = color
  sizeRef.current = size

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * c.width,
        y: ((e.clientY - r.top) / r.height) * c.height,
      }
    }

    const down = (e: PointerEvent) => {
      drawing.current = true
      c.setPointerCapture(e.pointerId)
      setHistory((h) => [...h, ctx.getImageData(0, 0, c.width, c.height)].slice(-30))
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
    }
    const move = (e: PointerEvent) => {
      if (!drawing.current) return
      const p = pos(e)
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = sizeRef.current
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    const up = () => {
      drawing.current = false
    }

    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  function undo() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !history.length) return
    const prev = history[history.length - 1]!
    setHistory((h) => h.slice(0, -1))
    ctx.putImageData(prev, 0, 0)
  }

  function clear() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    setHistory((h) => [...h, ctx.getImageData(0, 0, c.width, c.height)].slice(-30))
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  function download() {
    const c = canvasRef.current
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = 'whiteboard.png'
    a.click()
  }

  const colors = useMemo(() => ['#1a2e28', '#f0734a', '#2a9d8f', '#d6406a', '#3b82a0', '#ffffff'], [])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={undo}>
            復原
          </button>
          <button type="button" className="btn ghost sm" onClick={clear}>
            清除
          </button>
          <button type="button" className="btn accent sm" onClick={download}>
            下載 PNG
          </button>
        </div>
      }
    >
      <div className="panel stack">
        <div className="row">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className="btn sm"
              style={{
                background: c,
                width: 36,
                height: 36,
                border: color === c ? '2px solid var(--ink)' : '1px solid var(--line)',
              }}
              onClick={() => setColor(c)}
            />
          ))}
          <label className="label" style={{ margin: 0 }}>
            粗細 {size}
          </label>
          <input
            className="field"
            type="range"
            min={1}
            max={24}
            value={size}
            onChange={(e) => setSize(+e.target.value)}
            style={{ width: 140 }}
          />
        </div>
        <canvas
          ref={canvasRef}
          width={1000}
          height={560}
          style={{
            width: '100%',
            touchAction: 'none',
            cursor: 'crosshair',
            borderRadius: 12,
            border: '1px solid var(--line)',
            background: '#fff',
          }}
        />
        <p className="muted">本機畫布；可復原、調整筆刷與匯出 PNG。</p>
      </div>
    </ProjectShell>
  )
}
