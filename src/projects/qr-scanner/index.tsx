import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('qr-scanner')!

const PAYLOAD_MAX = 4000

type HistoryItem = { id: string; text: string; type: string; at: number }

type Decoded = {
  type: string
  summary: string
  details: { label: string; value: string }[]
  actions: { label: string; href?: string; copy?: string }[]
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>
}

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => BarcodeDetectorLike

function getBarcodeDetector(): BarcodeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
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

async function tryBarcodeDetector(source: ImageBitmapSource): Promise<string | null> {
  const Ctor = getBarcodeDetector()
  if (!Ctor) return null
  try {
    const detector = new Ctor({ formats: ['qr_code'] })
    const codes = await detector.detect(source)
    const value = codes[0]?.rawValue?.trim()
    return value || null
  } catch {
    return null
  }
}

function decodeWithJsQR(imageData: ImageData): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })
  const value = code?.data?.trim()
  return value || null
}

export default function Page() {
  const [payload, setPayload] = useLocalStorage(
    'lab:qr-scanner:payload',
    'https://example.com/welcome',
  )
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:qr-scanner:history', [])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraSupported] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  )
  const [barcodeFast] = useState(() => !!getBarcodeDetector())

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanRafRef = useRef<number | null>(null)
  const lastScanRef = useRef('')
  const previewUrlRef = useRef<string | null>(null)
  const applyPayloadRef = useRef<(text: string) => void>(() => {})

  const decoded = decodePayload(payload)

  const remember = useCallback(
    (text: string) => {
      const d = decodePayload(text)
      if (d.type === 'empty') return
      setHistory((prev) =>
        [
          { id: uid('qr'), text, type: d.summary, at: Date.now() },
          ...prev.filter((h) => h.text !== text),
        ].slice(0, 30),
      )
    },
    [setHistory],
  )

  const applyPayload = useCallback(
    (text: string) => {
      const clipped = limitText(text, PAYLOAD_MAX)
      setPayload(clipped)
      remember(clipped)
    },
    [remember, setPayload],
  )

  applyPayloadRef.current = applyPayload

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
    const fromBd = await tryBarcodeDetector(canvas)
    if (fromBd) return fromBd
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return decodeWithJsQR(imageData)
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('請上傳圖片檔')
      setStatus('')
      return
    }

    setBusy(true)
    setError('')
    setStatus('正在解碼圖片…')

    revokePreview()
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewUrl(url)

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('圖片載入失敗'))
        el.src = url
      })

      const canvas = canvasRef.current
      if (!canvas) throw new Error('畫布尚未就緒')

      const maxW = 720
      const scale = Math.min(1, maxW / img.width)
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('無法取得畫布內容')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      let text = await tryBarcodeDetector(img)
      if (!text) text = await decodeCanvas(canvas)

      if (text) {
        applyPayload(text)
        setStatus(barcodeFast && getBarcodeDetector() ? '解碼成功' : '解碼成功（jsQR）')
        setError('')
      } else {
        setStatus('')
        setError('未偵測到 QR Code，請換一張更清晰的圖片或改為手動貼上內容')
      }
    } catch (err) {
      setStatus('')
      setError(err instanceof Error ? err.message : '解碼失敗')
    } finally {
      setBusy(false)
    }
  }

  const stopCamera = useCallback(() => {
    if (scanRafRef.current != null) {
      cancelAnimationFrame(scanRafRef.current)
      scanRafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }, [])

  function tickScan() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      scanRafRef.current = requestAnimationFrame(tickScan)
      return
    }

    const w = video.videoWidth
    const h = video.videoHeight
    if (w > 0 && h > 0) {
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const text = decodeWithJsQR(imageData)
        if (text && text !== lastScanRef.current) {
          lastScanRef.current = text
          applyPayloadRef.current(text)
          setStatus('相機掃描成功')
          setError('')
        }
      }
    }

    scanRafRef.current = requestAnimationFrame(tickScan)
  }

  async function startCamera() {
    if (!cameraSupported) {
      setError('此瀏覽器不支援相機')
      return
    }
    setBusy(true)
    setError('')
    setStatus('正在開啟相機…')
    lastScanRef.current = ''
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('預覽元件尚未就緒')
      video.srcObject = stream
      await video.play()
      setCameraOn(true)
      setPreviewUrl(null)
      setStatus('相機掃描中…將 QR 對準畫面')
      if (scanRafRef.current != null) cancelAnimationFrame(scanRafRef.current)
      scanRafRef.current = requestAnimationFrame(tickScan)
    } catch {
      stopCamera()
      setStatus('')
      setError('無法開啟相機，請允許權限或以圖片上傳代替')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => () => {
    stopCamera()
    revokePreview()
  }, [stopCamera])

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
            上傳含 QR 的圖片即可自動解碼；支援相機即時掃描
            {barcodeFast ? '（BarcodeDetector 加速）' : '（jsQR）'}。也可手動貼上內容。
          </p>

          <label className="stack">
            <span className="label">上傳 QR 圖片</span>
            <input
              className="field"
              type="file"
              accept="image/*"
              disabled={busy || cameraOn}
              onChange={(e) => {
                void onFile(e.target.files?.[0] || null)
                e.target.value = ''
              }}
            />
          </label>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {cameraSupported && !cameraOn && (
              <button className="btn accent" type="button" disabled={busy} onClick={() => void startCamera()}>
                開啟相機掃描
              </button>
            )}
            {cameraOn && (
              <button className="btn ghost" type="button" onClick={stopCamera}>
                關閉相機
              </button>
            )}
          </div>

          {busy && <p className="muted">處理中…</p>}
          {status && !error && <p className="muted">{status}</p>}
          {error && <p className="field-error">{error}</p>}

          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              maxWidth: '100%',
              borderRadius: 8,
              display: cameraOn ? 'block' : 'none',
              background: '#111',
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              borderRadius: 8,
              display: previewUrl && !cameraOn ? 'block' : 'none',
              background: '#111',
            }}
          />

          <label className="stack">
            <span className="label">QR Payload</span>
            <textarea
              className={`field mono${!isNonEmpty(payload) ? ' is-invalid' : ''}`}
              rows={6}
              value={payload}
              maxLength={PAYLOAD_MAX}
              onChange={(e) => setPayload(limitText(e.target.value, PAYLOAD_MAX))}
              placeholder="例如 https://… 或 WIFI:T:WPA;S:MyNet;P:secret;;"
            />
            <div className="field-meta">
              <span className={!isNonEmpty(payload) ? 'warn' : undefined}>
                {!isNonEmpty(payload) ? '請貼上 QR 內容' : ' '}
              </span>
              <span>
                {charCount(payload)} / {PAYLOAD_MAX}
              </span>
            </div>
          </label>
          <div className="row">
            <button className="btn accent" onClick={() => remember(payload)} disabled={!isNonEmpty(payload)}>
              解析並加入歷史
            </button>
            <button className="btn ghost" onClick={() => copyText(payload)} disabled={!isNonEmpty(payload)}>
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
