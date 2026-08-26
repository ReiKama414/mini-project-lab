import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { formatBytes, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-encrypt',
  title: 'PDF 容器加密',
  description: 'AES-GCM 本機封裝／解密 PDF（非標準 PDF 密碼）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility', 'security'],
}
const meta = getProject('pdf-encrypt') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const PW_MAX = 64
const MAGIC = 'MPLPDFv1'

async function deriveKey(pw: string, salt: Uint8Array, usage: KeyUsage[]) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [encFile, setEncFile] = useState<File | null>(null)
  const [userPw, setUserPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function onPdf(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    setFile(f)
    setError('')
    setNote('')
  }

  async function onEnc(f: File | null) {
    if (!f) return
    if (f.size > PDF_MAX * 2) {
      setError(`封裝檔過大（上限 ${formatBytes(PDF_MAX * 2)}）`)
      return
    }
    setEncFile(f)
    setError('')
  }

  async function encrypt() {
    if (!file || !isNonEmpty(userPw)) {
      setError('請上傳 PDF 並設定密碼')
      return
    }
    if (userPw !== confirmPw) {
      setError('兩次密碼不一致')
      return
    }
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const plain = Uint8Array.from(await doc.save())
      const pw = limitText(userPw, PW_MAX)
      const enc = new TextEncoder()
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const key = await deriveKey(pw, salt, ['encrypt'])
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer }, key, plain))
      const header = enc.encode(MAGIC)
      const out = new Uint8Array(header.length + 16 + 12 + cipher.length)
      out.set(header, 0)
      out.set(salt, header.length)
      out.set(iv, header.length + 16)
      out.set(cipher, header.length + 28)
      downloadBlob(new Blob([Uint8Array.from(out)], { type: 'application/octet-stream' }), `${file.name.replace(/\.pdf$/i, '')}.pdf.enc`)
      setNote('已下載 .pdf.enc。此為本機 AES-GCM 封裝，需用同頁解密還原為 PDF。')
    } catch (e) {
      setError('加密失敗：' + (e instanceof Error ? e.message : '未知錯誤'))
    } finally {
      setBusy(false)
    }
  }

  async function decrypt() {
    if (!encFile || !isNonEmpty(userPw)) {
      setError('請上傳 .pdf.enc 並輸入密碼')
      return
    }
    setBusy(true)
    setError('')
    try {
      const buf = new Uint8Array(await encFile.arrayBuffer())
      const enc = new TextEncoder()
      const magic = enc.encode(MAGIC)
      for (let i = 0; i < magic.length; i++) {
        if (buf[i] !== magic[i]) throw new Error('不是有效的封裝檔')
      }
      const salt = buf.slice(8, 24)
      const iv = buf.slice(24, 36)
      const cipher = buf.slice(36)
      const key = await deriveKey(limitText(userPw, PW_MAX), salt, ['decrypt'])
      const plain = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer },
          key,
          cipher,
        ),
      )
      downloadBlob(new Blob([Uint8Array.from(plain)], { type: 'application/pdf' }), encFile.name.replace(/\.pdf\.enc$/i, '') + '-decrypted.pdf')
      setNote('已解密還原為 PDF。')
    } catch (e) {
      setError('解密失敗（密碼錯誤或檔案損毀）')
      void e
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || !isNonEmpty(userPw) || busy} onClick={() => void encrypt()}>
          加密下載
        </button>
      }
    >
      <p
        className="field-hint"
        role="status"
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          border: '1px solid var(--line)',
          borderRadius: 10,
          background: 'color-mix(in srgb, var(--panel) 85%, var(--accent) 8%)',
        }}
      >
        本機 AES-GCM 容器封裝（.pdf.enc），非標準 PDF 開啟密碼
      </p>
      <p className="muted" style={{ marginBottom: 12 }}>
        這<strong>不是</strong> Adobe／瀏覽器可直接開啟的標準 PDF 密碼保護，而是本機 AES-GCM 容器（.pdf.enc）。需用同頁解密還原為一般 PDF。單檔上限{' '}
        {formatBytes(PDF_MAX)}；密碼不會上傳。
      </p>
      <div className="panel stack">
        <FileDrop
          accept="application/pdf"
          maxBytes={PDF_MAX}
          disabled={busy}
          label="拖放 PDF 到此（加密用），或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX)}`}
          onFiles={(files) => void onPdf(files[0] ?? null)}
        />
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
        <FileDrop
          accept=".enc,application/octet-stream"
          maxBytes={PDF_MAX * 2}
          disabled={busy}
          label="拖放 .pdf.enc 到此（解密用），或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX * 2)}`}
          onFiles={(files) => void onEnc(files[0] ?? null)}
        />
        {encFile && (
          <p className="muted" style={{ margin: 0 }}>
            {encFile.name} · {formatBytes(encFile.size)}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {note && <p className="field-hint">{note}</p>}
        <div className="field-wrap">
          <label className="label">密碼</label>
          <input
            className={`field${!isNonEmpty(userPw) ? ' is-invalid' : ''}`}
            type="password"
            value={userPw}
            maxLength={PW_MAX}
            onChange={(e) => setUserPw(limitText(e.target.value, PW_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(userPw)} / {PW_MAX}
            </span>
          </div>
        </div>
        <div className="field-wrap">
          <label className="label">確認密碼（加密時）</label>
          <input
            className="field"
            type="password"
            value={confirmPw}
            maxLength={PW_MAX}
            onChange={(e) => setConfirmPw(limitText(e.target.value, PW_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(confirmPw)} / {PW_MAX}
            </span>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn accent" disabled={!file || !isNonEmpty(userPw) || busy} onClick={() => void encrypt()}>
            {busy ? '處理中…' : '加密並下載 .enc'}
          </button>
          <button type="button" className="btn ghost" disabled={!encFile || !isNonEmpty(userPw) || busy} onClick={() => void decrypt()}>
            解密還原 PDF
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
