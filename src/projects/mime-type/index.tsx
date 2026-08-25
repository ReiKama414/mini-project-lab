import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
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

export default function Page() {
  const [name, setName] = useLocalStorage('lab:mime-type:name', 'report.xlsx')
  const [fileMime, setFileMime] = useState('')
  const [fileInfo, setFileInfo] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const guessed = EXT_MAP[ext] || 'application/octet-stream'
  const invalid = !isNonEmpty(name)

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        依副檔名猜測 MIME；上傳檔案可對照瀏覽器提供的 File.type（不上傳伺服器）。
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
        <label className="stack">
          <span className="label">或上傳檔案（讀取瀏覽器 File.type）</span>
          <input
            className="field"
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > FILE_MAX) {
                setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
                return
              }
              setName(limitText(f.name, NAME_MAX))
              setFileMime(f.type || '（瀏覽器未提供）')
              setFileInfo(`${f.name} · ${formatBytes(f.size)}`)
              setError('')
              setCopied(false)
            }}
          />
        </label>
        {fileInfo && (
          <p className="muted">
            {fileInfo}
            <br />
            File.type：<code className="mono">{fileMime}</code>
          </p>
        )}
      </div>
    </ProjectShell>
  )
}
