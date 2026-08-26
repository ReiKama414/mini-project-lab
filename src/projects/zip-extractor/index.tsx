import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import JSZip from 'jszip'
import { downloadBlob } from '../../lib/imageCanvas'
import { formatBytes } from '../../lib/utils'

const meta: ProjectMeta = getProject('zip-extractor') ?? {
  slug: 'zip-extractor',
  title: 'ZIP 解壓',
  description: '本機檢視並解壓 ZIP 內容。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['utility'],
}

const ZIP_MAX = 50 * 1024 * 1024
const ENTRY_MAX = 500
const EXTRACT_MAX = 25 * 1024 * 1024

type Entry = { path: string; size: number; dir: boolean }

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [zip, setZip] = useState<JSZip | null>(null)
  const [zipName, setZipName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  async function onFile(file: File | null) {
    if (!file) return
    if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip') {
      setError('請選擇 .zip 檔案')
      return
    }
    if (file.size > ZIP_MAX) {
      setError(`檔案過大（上限 ${formatBytes(ZIP_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    setProgress('讀取 ZIP…')
    try {
      const z = await JSZip.loadAsync(file)
      const list: Entry[] = []
      z.forEach((path, e) => {
        list.push({
          path,
          size: (e as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0,
          dir: e.dir,
        })
      })
      if (list.length > ENTRY_MAX) {
        setError(`項目過多（上限 ${ENTRY_MAX}）`)
        setZip(null)
        setEntries([])
        return
      }
      setZip(z)
      setZipName(file.name)
      setEntries(list.sort((a, b) => a.path.localeCompare(b.path)))
    } catch {
      setError('無法讀取 ZIP')
      setZip(null)
      setEntries([])
      setZipName('')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function extractOne(path: string) {
    if (!zip) return
    const f = zip.file(path)
    if (!f || f.dir) return
    setBusy(true)
    setProgress(`解壓 ${path.split('/').pop() || path}…`)
    setError('')
    try {
      const blob = await f.async('blob')
      if (blob.size > EXTRACT_MAX) {
        setError(`單一檔案過大（上限 ${formatBytes(EXTRACT_MAX)}）`)
        return
      }
      const name = path.split('/').pop() || 'file'
      downloadBlob(blob, name)
    } catch {
      setError('解壓失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        本機檢視並下載 ZIP 內檔案。壓縮檔上限 {formatBytes(ZIP_MAX)}，最多 {ENTRY_MAX} 個項目。
      </p>
      <div className="panel stack">
        <FileDrop
          accept=".zip,application/zip"
          maxBytes={ZIP_MAX}
          disabled={busy}
          label="拖放 ZIP 到此，或點擊選擇"
          hint={`上限 ${formatBytes(ZIP_MAX)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {zipName && (
          <p className="muted" style={{ margin: 0 }}>
            {zipName} · {entries.length} 個項目
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {busy && !zipName && <p className="muted">{progress || '讀取中…'}</p>}
        {error && <p className="field-error">{error}</p>}
        <span className="metric">{entries.length} 個項目</span>
        <ul className="list">
          {entries.map((e) => (
            <li key={e.path} className="list-item">
              <span className="mono" style={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>
                {e.dir ? '[目錄] ' : ''}
                {e.path}
              </span>
              {!e.dir && (
                <>
                  <span className="tag">{formatBytes(e.size)}</span>
                  <button type="button" className="btn sm ghost" disabled={busy} onClick={() => void extractOne(e.path)}>
                    下載
                  </button>
                </>
              )}
            </li>
          ))}
          {!entries.length && <p className="muted">上傳 ZIP 後會列出內容；解壓僅在本機進行。</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
