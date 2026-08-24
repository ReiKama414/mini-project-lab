import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('qr-generator')!

type EcLevel = 'L' | 'M' | 'Q' | 'H'
type HistoryItem = { id: string; text: string; at: number; fg: string; bg: string; size: number; level: EcLevel }

const PRESETS = [
  { label: '範例網址', text: 'https://example.com' },
  { label: 'Wi‑Fi（示範）', text: 'WIFI:T:WPA;S:MyNetwork;P:password123;;' },
  { label: '電話', text: 'tel:+886912345678' },
  { label: 'Email', text: 'mailto:hello@example.com?subject=Hello' },
  { label: '簡訊', text: 'sms:+886912345678?body=你好' },
  { label: '純文字', text: '歡迎使用 QR 產生器' },
]

const THEME_PRESETS = [
  { label: '經典', fg: '#1a1a1a', bg: '#ffffff' },
  { label: '墨綠', fg: '#1a2e28', bg: '#f4faf8' },
  { label: '珊瑚', fg: '#f0734a', bg: '#fff8f4' },
  { label: '反白', fg: '#ffffff', bg: '#1a1a1a' },
]

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
  const [level, setLevel] = useLocalStorage<EcLevel>('lab:qr-generator:level', 'M')
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:qr-generator:history', [])
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const value = text.trim()
  const stats = useMemo(
    () => ({
      chars: value.length,
      bytes: new TextEncoder().encode(value).length,
      historyCount: history.length,
    }),
    [value, history.length],
  )

  const filteredHistory = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => h.text.toLowerCase().includes(q))
  }, [history, filter])

  function saveHistory() {
    if (!value) return
    setHistory((h) =>
      [{ id: uid('qr'), text: value, at: Date.now(), fg, bg, size, level }, ...h.filter((x) => x.text !== value)].slice(0, 24),
    )
  }

  function applyHistory(item: HistoryItem) {
    setText(item.text)
    setFg(item.fg)
    setBg(item.bg)
    setSize(item.size)
    setLevel(item.level)
  }

  async function downloadSvg() {
    const svg = wrapRef.current?.querySelector('svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    downloadBlob('qrcode.svg', new Blob([xml], { type: 'image/svg+xml' }))
    saveHistory()
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
        if (blob) {
          downloadBlob('qrcode.png', blob)
          saveHistory()
        }
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!value} onClick={saveHistory}>
            存入歷史
          </button>
          <button type="button" className="btn sm teal" disabled={!value} onClick={() => void downloadSvg()}>
            SVG
          </button>
          <button type="button" className="btn sm accent" disabled={!value} onClick={() => void downloadPng()}>
            PNG
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">字元 {stats.chars}</span>
        <span className="tag">約 {stats.bytes} bytes</span>
        <span className="tag">歷史 {stats.historyCount}</span>
        <span className="tag">容錯 {level}</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div>
            <div className="label">內容預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => setText(p.text)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

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

          <label className="stack">
            <span className="label">容錯等級</span>
            <select className="field" value={level} onChange={(e) => setLevel(e.target.value as EcLevel)}>
              <option value="L">L · 約 7%</option>
              <option value="M">M · 約 15%</option>
              <option value="Q">Q · 約 25%</option>
              <option value="H">H · 約 30%</option>
            </select>
          </label>

          <div>
            <div className="label">配色預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {THEME_PRESETS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setFg(t.fg)
                    setBg(t.bg)
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <label className="stack">
              <span className="label">前景色</span>
              <div className="row">
                <input
                  type="color"
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }}
                />
                <input className="field mono" style={{ flex: 1 }} value={fg} onChange={(e) => setFg(e.target.value)} />
              </div>
            </label>
            <label className="stack">
              <span className="label">背景色</span>
              <div className="row">
                <input
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }}
                />
                <input className="field mono" style={{ flex: 1 }} value={bg} onChange={(e) => setBg(e.target.value)} />
              </div>
            </label>
          </div>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
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
            <button type="button" className="btn teal" disabled={!value} onClick={() => void downloadSvg()}>
              下載 SVG
            </button>
            <button type="button" className="btn accent" disabled={!value} onClick={() => void downloadPng()}>
              下載 PNG
            </button>
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="panel stack" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
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
                <QRCodeSVG value={value} size={size} fgColor={fg} bgColor={bg} level={level} includeMargin={false} />
              </div>
            ) : (
              <p className="muted">請輸入內容以產生 QR Code</p>
            )}
          </div>

          <div className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>歷史（{filteredHistory.length}）</h3>
              <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
                清除歷史
              </button>
            </div>
            <input
              className="field"
              placeholder="篩選歷史內容…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <ul className="list">
              {filteredHistory.slice(0, 10).map((h) => (
                <li key={h.id} className="list-item stack">
                  <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {h.text}
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <span className="muted mono" style={{ fontSize: 11 }}>
                      {new Date(h.at).toLocaleString('zh-TW')} · {h.size}px · {h.level}
                    </span>
                    <button type="button" className="btn sm ghost" onClick={() => applyHistory(h)}>
                      套用
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => void copyText(h.text)}>
                      複製
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    >
                      刪
                    </button>
                  </div>
                </li>
              ))}
              {!filteredHistory.length && <p className="muted">下載或按「存入歷史」後會出現在此（本機）。</p>}
            </ul>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
