import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('qr-scanner')!

type HistoryItem = { id: string; text: string; type: string; at: number }

type Decoded = {
  type: string
  summary: string
  details: { label: string; value: string }[]
  actions: { label: string; href?: string; copy?: string }[]
}

function decodePayload(raw: string): Decoded {
  const text = raw.trim()
  if (!text) {
    return { type: 'empty', summary: '請貼上 QR 內容', details: [], actions: [] }
  }

  if (/^https?:\/\//i.test(text)) {
    return {
      type: 'url',
      summary: '網址',
      details: [{ label: 'URL', value: text }],
      actions: [
        { label: '開啟', href: text },
        { label: '複製', copy: text },
      ],
    }
  }

  if (/^mailto:/i.test(text)) {
    const email = text.replace(/^mailto:/i, '').split('?')[0] || ''
    return {
      type: 'email',
      summary: '電子郵件',
      details: [{ label: 'Email', value: email }],
      actions: [
        { label: '寄信', href: text },
        { label: '複製', copy: email },
      ],
    }
  }

  if (/^TEL:/i.test(text) || /^\+?[\d\s\-()]{7,}$/.test(text)) {
    const tel = text.replace(/^TEL:/i, '').trim()
    return {
      type: 'tel',
      summary: '電話',
      details: [{ label: '號碼', value: tel }],
      actions: [
        { label: '撥打', href: `tel:${tel.replace(/\s/g, '')}` },
        { label: '複製', copy: tel },
      ],
    }
  }

  if (/^SMS:/i.test(text) || /^SMSTO:/i.test(text)) {
    const body = text.replace(/^(SMS|SMSTO):/i, '')
    return {
      type: 'sms',
      summary: '簡訊',
      details: [{ label: '內容', value: body }],
      actions: [{ label: '複製', copy: body }],
    }
  }

  if (/^WIFI:/i.test(text)) {
    const ssid = text.match(/S:([^;]*)/)?.[1] || ''
    const pass = text.match(/P:([^;]*)/)?.[1] || ''
    const enc = text.match(/T:([^;]*)/)?.[1] || ''
    const hidden = text.match(/H:([^;]*)/)?.[1] || 'false'
    return {
      type: 'wifi',
      summary: 'Wi‑Fi 設定',
      details: [
        { label: 'SSID', value: ssid },
        { label: '加密', value: enc || '—' },
        { label: '密碼', value: pass || '（無）' },
        { label: '隱藏網路', value: hidden },
      ],
      actions: [
        { label: '複製密碼', copy: pass },
        { label: '複製 SSID', copy: ssid },
        { label: '複製原始', copy: text },
      ],
    }
  }

  if (/^BEGIN:VCARD/i.test(text)) {
    const fn = text.match(/FN:(.+)/i)?.[1]?.trim() || ''
    const tel = text.match(/TEL[^:]*:(.+)/i)?.[1]?.trim() || ''
    const email = text.match(/EMAIL[^:]*:(.+)/i)?.[1]?.trim() || ''
    return {
      type: 'vcard',
      summary: '聯絡人 (vCard)',
      details: [
        { label: '姓名', value: fn || '—' },
        { label: '電話', value: tel || '—' },
        { label: 'Email', value: email || '—' },
      ],
      actions: [{ label: '複製原始', copy: text }],
    }
  }

  if (/^geo:/i.test(text)) {
    return {
      type: 'geo',
      summary: '地理位置',
      details: [{ label: '座標', value: text.replace(/^geo:/i, '') }],
      actions: [{ label: '複製', copy: text }],
    }
  }

  return {
    type: 'text',
    summary: '純文字',
    details: [{ label: '內容', value: text }],
    actions: [{ label: '複製', copy: text }],
  }
}

export default function Page() {
  const [payload, setPayload] = useLocalStorage(
    'lab:qr-scanner:payload',
    'https://example.com/welcome',
  )
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:qr-scanner:history', [])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadNote, setUploadNote] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const decoded = decodePayload(payload)

  function remember(text: string) {
    const d = decodePayload(text)
    if (d.type === 'empty') return
    setHistory([
      { id: uid('qr'), text, type: d.summary, at: Date.now() },
      ...history.filter((h) => h.text !== text),
    ].slice(0, 30))
  }

  function applyPayload(text: string) {
    setPayload(text)
    remember(text)
  }

  function onFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadNote('請上傳圖片檔')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setUploadNote(
      '已將圖片繪製到畫布。相機即時掃描與影像解碼需額外函式庫（如 jsQR）；此處可改為手動貼上解碼結果。',
    )

    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const maxW = 360
      const scale = Math.min(1, maxW / img.width)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = url
  }

  const samples = [
    'https://github.com',
    'WIFI:T:WPA;S:CafeWiFi;P:hello123;H:false;;',
    'mailto:hello@lab.dev',
    'TEL:+886912345678',
    'BEGIN:VCARD\nVERSION:3.0\nFN:Lab User\nTEL:+886900000000\nEMAIL:lab@example.com\nEND:VCARD',
    'geo:25.0330,121.5654',
  ]

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <p className="muted">
            相機掃描需額外解碼函式庫，此示範以手動貼上 / 範例為主；可上傳圖片預覽畫布內容。
          </p>

          <label className="stack">
            <span className="label">上傳 QR 圖片（預覽）</span>
            <input
              className="field"
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
          </label>
          {uploadNote && <p className="muted">{uploadNote}</p>}
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              borderRadius: 8,
              display: previewUrl ? 'block' : 'none',
              background: '#111',
            }}
          />

          <label className="stack">
            <span className="label">QR Payload</span>
            <textarea
              className="field mono"
              rows={6}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="例如 https://… 或 WIFI:T:WPA;S:MyNet;P:secret;;"
            />
          </label>
          <div className="row">
            <button className="btn accent" onClick={() => remember(payload)}>
              解析並加入歷史
            </button>
            <button className="btn ghost" onClick={() => copyText(payload)}>
              複製原始
            </button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {samples.map((s, i) => (
              <button key={i} className="btn sm ghost" onClick={() => applyPayload(s)}>
                範例 {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="panel stack">
          <div className="metric">
            <div className="tag">{decoded.summary}</div>
            <span className="muted" style={{ fontSize: 12 }}>
              類型：{decoded.type}
            </span>
            <ul className="list" style={{ marginTop: 12 }}>
              {decoded.details.map((d) => (
                <li key={d.label} className="list-item">
                  <div className="stack" style={{ flex: 1, gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {d.label}
                    </span>
                    <span className="mono" style={{ wordBreak: 'break-all' }}>
                      {d.value}
                    </span>
                  </div>
                  <button className="btn sm ghost" onClick={() => copyText(d.value)}>
                    複製
                  </button>
                </li>
              ))}
            </ul>
            {decoded.actions.length > 0 && (
              <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                {decoded.actions.map((a) =>
                  a.href ? (
                    <a key={a.label} className="btn sm teal" href={a.href} target="_blank" rel="noreferrer">
                      {a.label}
                    </a>
                  ) : (
                    <button
                      key={a.label}
                      className="btn sm ghost"
                      onClick={() => a.copy && copyText(a.copy)}
                    >
                      {a.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="row">
            <span className="label">歷史紀錄</span>
            <button
              className="btn sm ghost"
              style={{ marginLeft: 'auto' }}
              onClick={() => setHistory([])}
              disabled={!history.length}
            >
              清空
            </button>
          </div>
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="list-item">
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <div className="row">
                    <span className="tag">{h.type}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(h.at).toLocaleString('zh-TW')}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                    {h.text.slice(0, 120)}
                    {h.text.length > 120 ? '…' : ''}
                  </span>
                </div>
                <button className="btn sm accent" onClick={() => setPayload(h.text)}>
                  載入
                </button>
                <button className="btn sm ghost" onClick={() => copyText(h.text)}>
                  複製
                </button>
              </li>
            ))}
            {!history.length && <p className="muted">尚無歷史</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
