import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadBlob } from '../../lib/imageCanvas'
import { charCount, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'base64-to-image',
  title: 'Base64 → 圖片',
  description: '將 Data URL／Base64 還原成圖片。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('base64-to-image') ?? fallback

const MAX = 2_000_000

function guessExt(src: string) {
  const m = src.match(/^data:image\/([\w+.-]+);/i)
  const t = (m?.[1] || 'png').toLowerCase()
  if (t === 'jpeg') return 'jpg'
  if (t === 'svg+xml') return 'svg'
  return t.replace(/[^a-z0-9]/g, '') || 'png'
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:base64-to-image:input', '')
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function preview() {
    if (!isNonEmpty(input)) {
      setError('請貼上 Base64 或 Data URL')
      return
    }
    let url = input.trim()
    if (!url.startsWith('data:')) {
      url = `data:image/png;base64,${url.replace(/\s/g, '')}`
    }
    setSrc(url)
    setError('')
  }

  async function download() {
    if (!src) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error('fail')
      const blob = await res.blob()
      if (!blob.size) throw new Error('empty')
      downloadBlob(blob, `image.${guessExt(src)}`)
    } catch {
      setError('下載失敗，請確認 Base64 內容是否完整')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!src || busy} onClick={() => void download()}>
          {busy ? '處理中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        純 Base64 會預設當成 PNG；內容過長可能超出瀏覽器記憶體。僅本機解碼，不會上傳。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">Data URL 或純 Base64</span>
          <textarea
            className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
            rows={8}
            value={input}
            maxLength={MAX}
            onChange={(e) => setInput(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={preview} disabled={!isNonEmpty(input)}>
            預覽
          </button>
          <button type="button" className="btn ghost" disabled={!src || busy} onClick={() => void download()}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {src && (
          <img
            src={src}
            alt="decoded"
            style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }}
            onError={() => setError('無法顯示圖片，請檢查編碼')}
          />
        )}
      </div>
    </ProjectShell>
  )
}
