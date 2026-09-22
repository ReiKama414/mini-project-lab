import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, downloadText, formatBytes } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const meta = getProject('base64')!

const TEXT_MAX = 200_000
const FILE_MAX = 2_000_000
const HEX_PREVIEW = 32

type Side = 'plain' | 'b64'
type ViewMode = 'split' | 'plain' | 'b64'

const SAMPLES: Record<string, { label: string; plain: string }> = {
  hello: { label: 'Hello', plain: 'Hello, 世界' },
  json: { label: 'JSON', plain: '{"ok":true,"msg":"你好"}' },
  fox: { label: '短句', plain: 'The quick brown fox jumps over the lazy dog' },
}

function utf8ToBytes(str: string) {
  return new TextEncoder().encode(str)
}

function utf8ToBase64(str: string) {
  return bytesToBase64(utf8ToBytes(str))
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

function wrapBase64(b64: string, width = 76) {
  const clean = b64.replace(/\s/g, '')
  if (width <= 0) return clean
  const parts: string[] = []
  for (let i = 0; i < clean.length; i += width) parts.push(clean.slice(i, i + width))
  return parts.join('\n')
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

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf'
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return 'application/zip'
  }
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return 'application/x-elf'
  }
  return null
}

function toHex(bytes: Uint8Array, max = HEX_PREVIEW) {
  const n = Math.min(bytes.length, max)
  const parts: string[] = []
  for (let i = 0; i < n; i++) parts.push(bytes[i]!.toString(16).padStart(2, '0'))
  const more = bytes.length > max ? ` …(+${bytes.length - max})` : ''
  return parts.join(' ') + more
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

function normalizeForDecode(encoded: string, urlSafe: boolean) {
  return urlSafe ? fromUrlSafe(encoded) : encoded.replace(/\s/g, '')
}

function tryDecode(encoded: string, urlSafe: boolean) {
  if (!isNonEmpty(encoded)) return { ok: false as const, error: '空白' }
  try {
    const standard = normalizeForDecode(encoded, urlSafe)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(standard)) {
      return { ok: false as const, error: '含非法字元（若為 URL-safe 請開啟選項）' }
    }
    if (standard.length % 4 !== 0) {
      return { ok: false as const, error: '長度不是 4 的倍數（可能缺少 padding）' }
    }
    const bytes = base64ToBytes(standard)
    return { ok: true as const, bytes, standard }
  } catch {
    return { ok: false as const, error: '解碼失敗，請確認 Base64 格式' }
  }
}

function formatEncoded(b64: string, urlSafe: boolean, wrap: boolean) {
  let out = urlSafe ? toUrlSafe(b64) : b64
  if (wrap) out = wrapBase64(out)
  return limitText(out, TEXT_MAX)
}

export default function Page() {
  const [plain, setPlain] = useLocalStorage('lab:base64:plain', SAMPLES.hello!.plain)
  const [encoded, setEncoded] = useLocalStorage('lab:base64:encoded', '')
  const [urlSafe, setUrlSafe] = useLocalStorage('lab:base64:urlSafe', false)
  const [wrap, setWrap] = useLocalStorage('lab:base64:wrap', false)
  const [live, setLive] = useLocalStorage('lab:base64:live', true)
  const [mime, setMime] = useLocalStorage('lab:base64:mime', 'text/plain;charset=utf-8')
  const [view, setView] = useLocalStorage<ViewMode>('lab:base64:view', 'split')
  const [lastEdited, setLastEdited] = useState<Side>('plain')
  const [error, setError] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!live || lastEdited !== 'plain') return
    if (!isNonEmpty(plain)) {
      setEncoded('')
      setError('')
      setFileInfo('')
      return
    }
    try {
      setEncoded(formatEncoded(utf8ToBase64(plain), urlSafe, wrap))
      setError('')
      setFileInfo('')
    } catch {
      setError('編碼失敗')
    }
  }, [live, lastEdited, plain, urlSafe, wrap])

  useEffect(() => {
    if (!live || lastEdited !== 'b64') return
    if (!isNonEmpty(encoded)) {
      setPlain('')
      setError('')
      setFileInfo('')
      return
    }
    const result = tryDecode(encoded, urlSafe)
    if (!result.ok) {
      setError(result.error)
      setFileInfo('')
      return
    }
    if (looksBinary(result.bytes)) {
      setPlain('')
      setError('')
      setFileInfo(`解碼結果疑似二進位（${formatBytes(result.bytes.length)}），請下載 .bin`)
      return
    }
    setPlain(limitText(bytesToUtf8(result.bytes), TEXT_MAX))
    setError('')
    setFileInfo('')
  }, [live, lastEdited, encoded, urlSafe])

  const plainBytes = useMemo(() => utf8ToBytes(plain), [plain])
  const decoded = useMemo(() => tryDecode(encoded, urlSafe), [encoded, urlSafe])
  const standardB64 = decoded.ok ? decoded.standard : isNonEmpty(plain) ? utf8ToBase64(plain) : ''
  const dataUrl = standardB64 ? `data:${mime};base64,${standardB64}` : ''
  const padCount = (standardB64.match(/=+$/) || [''])[0]!.length
  const b64Len = encoded.replace(/\s/g, '').length
  const expansion = plainBytes.length ? b64Len / plainBytes.length : 0
  const sniff = decoded.ok ? sniffMime(decoded.bytes) : null
  const hex = decoded.ok ? toHex(decoded.bytes) : isNonEmpty(plain) ? toHex(plainBytes) : ''

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function encodeNow() {
    if (!isNonEmpty(plain)) {
      setError('請輸入要編碼的文字')
      return
    }
    try {
      setEncoded(formatEncoded(utf8ToBase64(plain), urlSafe, wrap))
      setLastEdited('plain')
      setError('')
      setFileInfo('')
    } catch {
      setError('編碼失敗')
    }
  }

  function decodeNow() {
    if (!isNonEmpty(encoded)) {
      setError('請輸入 Base64')
      return
    }
    const result = tryDecode(encoded, urlSafe)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (looksBinary(result.bytes)) {
      setPlain('')
      setError('')
      setFileInfo(`解碼結果疑似二進位（${formatBytes(result.bytes.length)}），請下載 .bin`)
      setLastEdited('b64')
      return
    }
    setPlain(limitText(bytesToUtf8(result.bytes), TEXT_MAX))
    setError('')
    setFileInfo('')
    setLastEdited('b64')
  }

  function downloadDecoded(as: 'txt' | 'bin') {
    if (!isNonEmpty(encoded)) return
    const result = tryDecode(encoded, urlSafe)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (as === 'bin') downloadBytes('decoded.bin', result.bytes, 'application/octet-stream')
    else downloadText('decoded.txt', bytesToUtf8(result.bytes))
    setError('')
  }

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setLoadError('')
    try {
      const buf = await file.arrayBuffer()
      const b64 = formatEncoded(bytesToBase64(new Uint8Array(buf)), urlSafe, wrap)
      setEncoded(b64)
      setLastEdited('b64')
      setPlain('')
      setFileInfo(`${file.name} · ${formatBytes(file.size)} · MIME: ${file.type || 'unknown'}`)
      setError('')
      if (file.type) setMime(file.type)
    } catch {
      setLoadError('讀取檔案失敗')
    }
  }

  function applySample(text: string) {
    if (plain.trim() && !confirm('套用範本會覆蓋目前文字，確定？')) return
    setPlain(text)
    setLastEdited('plain')
    setError('')
    setFileInfo('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row b64-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!plain}
            onClick={() => void copyVal(plain, 'plain')}
            icon="copy"
          >
            {copied === 'plain' ? '已複製' : '複製文字'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!encoded}
            onClick={() => void copyVal(encoded, 'b64')}
            icon="copy"
          >
            {copied === 'b64' ? '已複製' : '複製 Base64'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!dataUrl}
            onClick={() => void copyVal(dataUrl, 'data')}
            icon="copy"
          >
            {copied === 'data' ? '已複製' : '複製 Data URL'}
          </ActionButton>
        </div>
      }
    >
      <div className="b64-calc">
        <div className="pw-stats">
          <span className="metric mono">{formatBytes(plainBytes.length)}</span>
          <span className="tag">{charCount(plain).toLocaleString()} 字</span>
          <span className="tag">B64 {b64Len.toLocaleString()}</span>
          {decoded.ok && <span className="tag">解碼 {formatBytes(decoded.bytes.length)}</span>}
          {sniff && <span className="tag">{sniff}</span>}
          <span className="tag">{urlSafe ? 'URL-safe' : '標準'}</span>
          {live && <span className="tag">即時</span>}
        </div>

        <div className="panel b64-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row b64-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['plain', '文字'],
                  ['b64', 'Base64'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">範本</div>
            <div className="pw-chips">
              {Object.entries(SAMPLES).map(([key, s]) => (
                <button key={key} type="button" className="btn sm ghost" onClick={() => applySample(s.plain)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row b64-options">
            <label className="b64-check">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              <span>即時互轉</span>
            </label>
            <label className="b64-check">
              <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
              <span>URL-safe（- _）</span>
            </label>
            <label className="b64-check">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
              <span>每 76 字換行</span>
            </label>
            <label className="b64-field">
              <span className="muted">Data URL MIME</span>
              <select className="field" value={mime} onChange={(e) => setMime(e.target.value)}>
                <option value="text/plain;charset=utf-8">text/plain</option>
                <option value="application/json">application/json</option>
                <option value="text/html;charset=utf-8">text/html</option>
                <option value="application/octet-stream">octet-stream</option>
                <option value="image/png">image/png</option>
                <option value="image/jpeg">image/jpeg</option>
              </select>
            </label>
          </div>
        </div>

        <div className={`b64-main b64-view-${view}`}>
          {(view === 'split' || view === 'plain') && (
            <section className="panel b64-pane">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">文字（UTF-8）</h3>
                <span className="tag mono">{formatBytes(plainBytes.length)}</span>
              </div>

              <div className="b64-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  {!live && (
                    <button type="button" className="btn sm accent" disabled={!isNonEmpty(plain)} onClick={encodeNow}>
                      編碼 →
                    </button>
                  )}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!plain}
                    onClick={() => void copyVal(plain, 'plain')}
                    icon="copy"
                  >
                    {copied === 'plain' ? '已複製' : '複製'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setPlain('')
                      setLastEdited('plain')
                      if (!live) {
                        setEncoded('')
                        setError('')
                        setFileInfo('')
                      }
                    }}
                  >
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className="field b64-textarea"
                value={plain}
                maxLength={TEXT_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setPlain(limitText(e.target.value, TEXT_MAX))
                  setLastEdited('plain')
                }}
                placeholder="輸入純文字…"
                aria-label="純文字輸入"
              />
              <div className="field-meta">
                <span>
                  {charCount(plain).toLocaleString()} / {TEXT_MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'b64') && (
            <section className="panel b64-pane">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">Base64</h3>
                <span className={`tag ${decoded.ok || !isNonEmpty(encoded) ? '' : 'warn'}`}>
                  {isNonEmpty(encoded) ? (decoded.ok ? '有效' : '無效') : '空白'}
                </span>
              </div>

              <div className="b64-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  {!live && (
                    <button
                      type="button"
                      className="btn sm teal"
                      disabled={!isNonEmpty(encoded)}
                      onClick={decodeNow}
                    >
                      ← 解碼
                    </button>
                  )}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!encoded}
                    onClick={() => void copyVal(encoded, 'b64')}
                    icon="copy"
                  >
                    {copied === 'b64' ? '已複製' : '複製'}
                  </ActionButton>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={!encoded || !decoded.ok}
                    onClick={() => downloadDecoded('txt')}
                  >
                    .txt
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={!encoded || !decoded.ok}
                    onClick={() => downloadDecoded('bin')}
                  >
                    .bin
                  </button>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setEncoded('')
                      setLastEdited('b64')
                      setFileInfo('')
                      if (!live) setError('')
                    }}
                  >
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className={`field mono b64-textarea${!decoded.ok && isNonEmpty(encoded) ? ' is-invalid' : ''}`}
                value={encoded}
                maxLength={TEXT_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setEncoded(limitText(e.target.value, TEXT_MAX))
                  setLastEdited('b64')
                }}
                placeholder="SGVsbG8sIOS4lueVjA=="
                aria-label="Base64 輸入"
              />
              <div className="field-meta">
                <span>
                  {charCount(encoded).toLocaleString()} / {TEXT_MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}
        </div>

        {(error || fileInfo) && (
          <div className="panel b64-alerts">
            {error && <p className="field-error">{error}</p>}
            {fileInfo && !error && <p className="field-hint">{fileInfo}</p>}
          </div>
        )}

        <div className="b64-bottom">
          <section className="panel b64-file">
            <h3 className="pw-panel-title">檔案 → Base64</h3>
            <FileDrop
              accept="*/*"
              maxBytes={FILE_MAX}
              label="拖放或點擊選擇檔案"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => void onFiles(files)}
            />
            {loadError && <p className="field-error">{loadError}</p>}
            {dataUrl && (
              <div className="b64-dataurl">
                <div className="label">Data URL</div>
                <pre className="b64-dataurl-pre mono">
                  {dataUrl.slice(0, 280)}
                  {dataUrl.length > 280 ? '…' : ''}
                </pre>
                <ActionButton className="btn sm ghost" onClick={() => void copyVal(dataUrl, 'data')} icon="copy">
                  {copied === 'data' ? '已複製' : '複製完整 Data URL'}
                </ActionButton>
              </div>
            )}
          </section>

          <section className="panel b64-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            <ul className="pw-info-list">
              <li>
                <span className="muted">UTF-8 位元組</span>
                <strong className="mono">{formatBytes(plainBytes.length)}</strong>
              </li>
              <li>
                <span className="muted">Base64 長度</span>
                <strong className="mono">{b64Len.toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">Padding</span>
                <strong className="mono">{padCount ? '='.repeat(padCount) : '無'}</strong>
              </li>
              <li>
                <span className="muted">膨脹比</span>
                <strong className="mono">{expansion ? `${expansion.toFixed(2)}×` : '—'}</strong>
              </li>
              <li>
                <span className="muted">變體</span>
                <strong>{urlSafe ? 'URL-safe' : '標準 RFC 4648'}</strong>
              </li>
              <li>
                <span className="muted">解碼狀態</span>
                <strong>{!isNonEmpty(encoded) ? '—' : decoded.ok ? '有效' : '無效'}</strong>
              </li>
              {decoded.ok && (
                <li>
                  <span className="muted">解碼大小</span>
                  <strong className="mono">{formatBytes(decoded.bytes.length)}</strong>
                </li>
              )}
              <li>
                <span className="muted">魔數／MIME</span>
                <strong className="mono">{sniff || '—'}</strong>
              </li>
              <li>
                <span className="muted">Hex 預覽</span>
                <strong className="mono b64-hex">{hex || '—'}</strong>
              </li>
            </ul>
            <p className="muted pw-hint">
              以 UTF-8 編碼／解碼；URL-safe 使用 <code>-_</code> 並可省略 padding。疑似二進位結果請下載
              .bin。內容存於本機。
            </p>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
