import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, formatBytes } from '../../lib/utils'

const meta = getProject('base64')!

function utf8ToBase64(str: string) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToUtf8(b64: string) {
  const cleaned = b64.replace(/\s/g, '')
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
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

export default function Page() {
  const [plain, setPlain] = useLocalStorage('lab:base64:plain', 'Hello, 世界')
  const [encoded, setEncoded] = useLocalStorage('lab:base64:encoded', '')
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [copied, setCopied] = useState<'plain' | 'b64' | 'data' | null>(null)

  function encode() {
    try {
      const b64 = utf8ToBase64(plain)
      setEncoded(b64)
      setDataUrl(`data:text/plain;charset=utf-8;base64,${b64}`)
      setError('')
      setFileInfo('')
    } catch {
      setError('編碼失敗')
    }
  }

  function decode() {
    try {
      setPlain(base64ToUtf8(encoded))
      setError('')
    } catch {
      setError('解碼失敗，請確認 Base64 格式')
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const b64 = bytesToBase64(new Uint8Array(buf))
      setEncoded(b64)
      setDataUrl(`data:${file.type || 'application/octet-stream'};base64,${b64}`)
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
          <textarea className="field" rows={5} value={plain} onChange={(e) => setPlain(e.target.value)} />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={encode}>
            編碼 →
          </button>
          <button type="button" className="btn teal" onClick={decode}>
            ← 解碼
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={async () => {
              await copyText(plain)
              setCopied('plain')
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
              setCopied('b64')
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
              setCopied('data')
            }}
          >
            {copied === 'data' ? '已複製 Data URL' : '複製 Data URL'}
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
            className="field mono"
            rows={6}
            value={encoded}
            onChange={(e) => {
              setEncoded(e.target.value)
              setDataUrl('')
            }}
          />
        </label>
        {error && (
          <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
            {error}
          </p>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          使用 TextEncoder／TextDecoder 處理 UTF-8；大檔案以分塊轉成 Base64，避免呼叫堆疊溢出。
        </p>
      </div>
    </ProjectShell>
  )
}
