import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('mime-type') ?? {
  slug: 'mime-type',
  title: 'MIME 類型偵測',
  description: '依副檔名與檔案內容判斷 MIME。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['utility'],
}

const EXT_MAP: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  md: 'text/markdown',
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  wav: 'audio/wav',
  webm: 'video/webm',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const NAME_MAX = 200
const FILE_MAX = 25 * 1024 * 1024

/** Magic-byte sniff for common binary formats. */
async function sniffMime(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (buf.length < 4) return null
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  // ZIP (also covers many OOXML containers): PK..
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'application/zip'
  return null
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:mime-type:name', 'report.xlsx')
  const [fileMime, setFileMime] = useState('')
  const [sniffedMime, setSniffedMime] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const guessed = EXT_MAP[ext] || 'application/octet-stream'
  const invalid = !isNonEmpty(name)

  async function onUpload(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      return
    }
    setName(limitText(file.name, NAME_MAX))
    setFileMime(file.type || '（瀏覽器未提供）')
    setFileInfo(`${file.name} · ${formatBytes(file.size)}`)
    setError('')
    setCopied(false)
    try {
      const sniffed = await sniffMime(file)
      setSniffedMime(sniffed ?? '（無法從魔術位元組判斷）')
    } catch {
      setSniffedMime('（讀取失敗）')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        依副檔名猜測 MIME；上傳檔案可對照瀏覽器 File.type，並以魔術位元組偵測 PNG／JPEG／GIF／WEBP／PDF／ZIP（不上傳伺服器）。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">檔名</span>
          <input
            className={`field${invalid ? ' is-invalid' : ''}`}
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setName(limitText(e.target.value, NAME_MAX))
              setCopied(false)
              setError('')
            }}
          />
          <div className="field-meta">
            <span>
              {charCount(name)} / {NAME_MAX}
            </span>
          </div>
        </label>
        {(invalid || error) && <p className="field-error">{error || '請輸入檔名'}</p>}
        <div className="metric mono">{guessed}</div>
        <p className="muted">副檔名：{ext || '（無）'}</p>
        <button
          type="button"
          className="btn accent"
          disabled={invalid}
          onClick={async () => {
            await copyText(guessed)
            setCopied(true)
          }}
        >
          {copied ? '已複製' : '複製 MIME'}
        </button>
        <FileDrop
          maxBytes={FILE_MAX}
          label="拖放檔案到此，或點擊選擇"
          hint={`上限 ${formatBytes(FILE_MAX)} · 對照 File.type 與魔術位元組`}
          onFiles={(files) => void onUpload(files[0] ?? null)}
        />
        {fileInfo && (
          <p className="muted">
            {fileInfo}
            <br />
            File.type：<code className="mono">{fileMime}</code>
            <br />
            魔術位元組：<code className="mono">{sniffedMime}</code>
          </p>
        )}
      </div>
    </ProjectShell>
  )
}
