import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, downloadText, formatBytes } from '../../lib/utils'

const meta = getProject('base64')!

const TEXT_MAX = 200_000

function utf8ToBase64(str: string) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBytes(b64: string) {
  const cleaned = b64.replace(/\s/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

function bytesToBase64(bytes: Uint8Array) {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function toUrlSafe(b64: string) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromUrlSafe(b64: string) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  return s
}

function looksBinary(bytes: Uint8Array) {
  if (!bytes.length) return false
  let nonPrintable = 0
  const sample = Math.min(bytes.length, 512)
  for (let i = 0; i < sample; i++) {
    const c = bytes[i]!
    if (c === 0) return true
    if (c < 9 || (c > 13 && c < 32) || c === 127) nonPrintable++
  }
  return nonPrintable / sample > 0.15
}

function downloadBytes(filename: string, bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Page() {
  const [plain, setPlain] = useLocalStorage('lab:base64:plain', 'Hello, 世界')
  const [encoded, setEncoded] = useLocalStorage('lab:base64:encoded', '')
  const [urlSafe, setUrlSafe] = useLocalStorage('lab:base64:urlSafe', false)
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [copied, setCopied] = useState<'plain' | 'b64' | 'data' | null>(null)

  function flashCopied(kind: 'plain' | 'b64' | 'data') {
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  function encode() {
    if (!isNonEmpty(plain)) {
      setError('請輸入要編碼的文字')
      return
    }
    try {
      let b64 = utf8ToBase64(plain)
      if (urlSafe) b64 = toUrlSafe(b64)
      setEncoded(limitText(b64, TEXT_MAX))
      setDataUrl(`data:text/plain;charset=utf-8;base64,${urlSafe ? fromUrlSafe(b64) : b64}`)
      setError('')
      setFileInfo('')
    } catch {
      setError('編碼失敗')
    }
  }

  function decode() {
    if (!isNonEmpty(encoded)) {
      setError('請輸入 Base64')
      return
    }
    try {
      const standard = urlSafe ? fromUrlSafe(encoded) : encoded.replace(/\s/g, '')
      const bytes = base64ToBytes(standard)
      if (looksBinary(bytes)) {
        setPlain('')
        setError('')
        setFileInfo(`解碼結果疑似二進位（${formatBytes(bytes.length)}），請用下方下載`)
        return
      }
      setPlain(limitText(bytesToUtf8(bytes), TEXT_MAX))
      setError('')
      setFileInfo('')
    } catch {
      setError('解碼失敗，請確認 Base64 格式')
    }
  }

  function downloadDecoded(as: 'txt' | 'bin') {
    if (!isNonEmpty(encoded)) return
    try {
      const standard = urlSafe ? fromUrlSafe(encoded) : encoded.replace(/\s/g, '')
      const bytes = base64ToBytes(standard)
      if (as === 'bin') {
        downloadBytes('decoded.bin', bytes, 'application/octet-stream')
      } else {
        downloadText('decoded.txt', bytesToUtf8(bytes))
      }
      setError('')
    } catch {
      setError('解碼失敗，無法下載')
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      let b64 = bytesToBase64(new Uint8Array(buf))
      if (urlSafe) b64 = toUrlSafe(b64)
      setEncoded(b64)
      setDataUrl(`data:${file.type || 'application/octet-stream'};base64,${urlSafe ? fromUrlSafe(b64) : b64}`)
      setFileInfo(`${file.name} · ${formatBytes(file.size)} · MIME: ${file.type || 'unknown'}`)
      setError('')
      setPlain('')
    } catch {
      setError('讀取檔案失敗')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="stack">
          <span className="label">純文字（UTF-8）</span>
          <textarea
            className={`field${error && !isNonEmpty(plain) ? ' is-invalid' : ''}`}
            rows={5}
            value={plain}
            maxLength={TEXT_MAX}
            onChange={(e) => setPlain(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(plain).toLocaleString()} / {TEXT_MAX.toLocaleString()}</span>
          </div>
        </label>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
          URL-safe Base64（- _，省略 =）
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={encode} disabled={!isNonEmpty(plain)}>
            編碼 →
          </button>
          <button type="button" className="btn teal" onClick={decode} disabled={!isNonEmpty(encoded)}>
            ← 解碼
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={async () => {
              await copyText(plain)
              flashCopied('plain')
            }}
          >
            {copied === 'plain' ? '已複製文字' : '複製文字'}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!encoded}
            onClick={async () => {
              await copyText(encoded)
              flashCopied('b64')
            }}
          >
            {copied === 'b64' ? '已複製 Base64' : '複製 Base64'}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!dataUrl}
            onClick={async () => {
              await copyText(dataUrl)
              flashCopied('data')
            }}
          >
            {copied === 'data' ? '已複製 Data URL' : '複製 Data URL'}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!encoded}
            onClick={() => downloadDecoded('txt')}
          >
            下載 .txt
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!encoded}
            onClick={() => downloadDecoded('bin')}
          >
            下載 .bin
          </button>
        </div>
        <label className="stack">
          <span className="label">檔案上傳 → Base64</span>
          <input className="field" type="file" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          {fileInfo && (
            <p className="muted" style={{ fontSize: 12 }}>
              {fileInfo}
            </p>
          )}
        </label>
        <label className="stack">
          <span className="label">Base64</span>
          <textarea
            className={`field mono${error && !isNonEmpty(encoded) ? ' is-invalid' : ''}`}
            rows={6}
            value={encoded}
            maxLength={TEXT_MAX}
            onChange={(e) => {
              setEncoded(limitText(e.target.value, TEXT_MAX))
              setDataUrl('')
            }}
          />
          <div className="field-meta">
            <span>{charCount(encoded).toLocaleString()} / {TEXT_MAX.toLocaleString()}</span>
          </div>
        </label>
        {error && <p className="field-error">{error}</p>}
        <p className="muted" style={{ fontSize: 12 }}>
          使用 TextEncoder／TextDecoder 處理 UTF-8；大檔案以分塊轉成 Base64，避免呼叫堆疊溢出。疑似二進位解碼結果請下載 .bin。
        </p>
      </div>
    </ProjectShell>
  )
}
