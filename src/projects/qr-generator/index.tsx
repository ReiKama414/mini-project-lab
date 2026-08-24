import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('qr-generator')!

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Page() {
  const [text, setText] = useLocalStorage('lab:qr-generator:text', 'https://example.com')
  const [size, setSize] = useLocalStorage('lab:qr-generator:size', 220)
  const [fg, setFg] = useLocalStorage('lab:qr-generator:fg', '#1a1a1a')
  const [bg, setBg] = useLocalStorage('lab:qr-generator:bg', '#ffffff')
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  async function downloadSvg() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    downloadBlob('qrcode.svg', new Blob([xml], { type: 'image/svg+xml' }))
  }

  async function downloadPng() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob((blob) => {
        if (blob) downloadBlob('qrcode.png', blob)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  const value = text.trim()

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">內容（文字或 URL）</span>
            <textarea
              className="field"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="stack">
            <span className="label">尺寸：{size}px</span>
            <input
              className="field"
              type="range"
              min={128}
              max={400}
              step={8}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <div className="grid-2">
            <label className="stack">
              <span className="label">前景色</span>
              <div className="row">
                <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }} />
                <input className="field mono" style={{ flex: 1 }} value={fg} onChange={(e) => setFg(e.target.value)} />
              </div>
            </label>
            <label className="stack">
              <span className="label">背景色</span>
              <div className="row">
                <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }} />
                <input className="field mono" style={{ flex: 1 }} value={bg} onChange={(e) => setBg(e.target.value)} />
              </div>
            </label>
          </div>
          <div className="row">
            <button
              className="btn ghost"
              disabled={!value}
              onClick={async () => {
                await copyText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已複製' : '複製文字'}
            </button>
            <button className="btn teal" disabled={!value} onClick={() => void downloadSvg()}>
              下載 SVG
            </button>
            <button className="btn accent" disabled={!value} onClick={() => void downloadPng()}>
              下載 PNG
            </button>
          </div>
        </div>
        <div className="panel stack" style={{ alignItems: 'center', justifyContent: 'center' }}>
          {value ? (
            <div
              ref={wrapRef}
              style={{
                padding: 20,
                background: bg,
                borderRadius: 12,
                border: '1px solid var(--border)',
                display: 'inline-block',
              }}
            >
              <QRCodeSVG value={value} size={size} fgColor={fg} bgColor={bg} level="M" includeMargin={false} />
            </div>
          ) : (
            <p className="muted">請輸入內容以產生 QR Code</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
