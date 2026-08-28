import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { fileToDataURL, IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '../../lib/imageCanvas'
import { copyText, formatBytes } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'image-to-base64',
  title: '圖片 → Base64',
  description: '將圖片轉成 Data URL／Base64。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('image-to-base64') ?? fallback

export default function Page() {
  const [dataUrl, setDataUrl] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(IMAGE_MAX_BYTES)}）`)
      return
    }
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      const url = await fileToDataURL(file)
      setDataUrl(url)
      setInfo(`${file.name} · ${formatBytes(file.size)} · ${file.type || 'unknown'} · Base64 約 ${formatBytes(Math.round((url.length * 3) / 4))}`)
    } catch {
      setError('讀取失敗')
      setDataUrl('')
      setInfo('')
    } finally {
      setBusy(false)
    }
  }

  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : ''

  function downloadTxt() {
    if (!dataUrl) return
    const blob = new Blob([dataUrl], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'image-data-url.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!dataUrl || busy} onClick={downloadTxt}>
          下載 txt
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        Base64 會比原檔大約 33%，大圖可能拖慢頁面或剪貼簿。僅本機轉換，不會上傳。
      </p>
      <div className="panel stack">
        <FileDrop
          accept={IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          disabled={busy}
          label="拖放圖片到此，或點擊選擇"
          hint={`上限 ${formatBytes(IMAGE_MAX_BYTES)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {error && <p className="field-error">{error}</p>}
        {busy && <p className="field-hint">讀取中…</p>}
        {info && <p className="field-hint">{info}</p>}
        {dataUrl && (
          <>
            <img src={dataUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8 }} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn accent"
                onClick={async () => {
                  await copyText(dataUrl)
                  setCopied(true)
                }}
              >
                {copied ? '已複製' : '複製 Data URL'}
              </button>
              <button type="button" className="btn ghost" onClick={() => void copyText(b64)}>
                複製純 Base64
              </button>
              <button type="button" className="btn ghost" onClick={downloadTxt}>
                下載 txt
              </button>
            </div>
            <pre className="metric mono" style={{ maxHeight: 160, overflow: 'auto', wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontSize: 11 }}>
              {dataUrl.slice(0, 500)}
              {dataUrl.length > 500 ? '…' : ''}
            </pre>
          </>
        )}
      </div>
    </ProjectShell>
  )
}
