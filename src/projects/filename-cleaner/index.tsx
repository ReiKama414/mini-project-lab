import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('filename-cleaner') ?? {
  slug: 'filename-cleaner',
  title: '檔名清理',
  description: '移除非法字元、空白與多餘符號。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['utility'],
}

const MAX = 2000
const FILE_MAX = 5 * 1024 * 1024

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:filename-cleaner:input', 'My File (最終版)!!!  .PDF')
  const [spaceToDash, setSpaceToDash] = useLocalStorage('lab:filename-cleaner:dash', true)
  const [lower, setLower] = useLocalStorage('lab:filename-cleaner:lower', false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const cleaned = useMemo(() => {
    let s = input.trim()
    s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    s = s.replace(/\s+/g, spaceToDash ? '-' : '_')
    s = s.replace(/-+/g, '-').replace(/_+/g, '_').replace(/[.]+/g, '.')
    s = s.replace(/^[-_.]+|[-_.]+$/g, '')
    if (lower) s = s.toLowerCase()
    return s || 'untitled'
  }, [input, spaceToDash, lower])

  const invalid = !isNonEmpty(input)

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        移除 Windows／跨平台常見非法字元，並可正規化空白。亦可從檔案讀取檔名（不讀內容）。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">原始檔名</span>
          <input
            className={`field${invalid ? ' is-invalid' : ''}`}
            value={input}
            maxLength={MAX}
            onChange={(e) => {
              setInput(limitText(e.target.value, MAX))
              setCopied(false)
              setError('')
            }}
          />
          <div className="field-meta">
            <span>
              {charCount(input)} / {MAX}
            </span>
          </div>
        </label>
        <div className="stack">
          <span className="label">或選擇檔案（僅取檔名）</span>
          <FileDrop
            maxBytes={FILE_MAX}
            label="拖放檔案到此，或點擊選擇"
            hint={`上限 ${formatBytes(FILE_MAX)} · 僅讀檔名`}
            onFiles={(files) => {
              const f = files[0]
              if (!f) return
              setInput(limitText(f.name, MAX))
              setError('')
              setCopied(false)
            }}
          />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={spaceToDash} onChange={(e) => setSpaceToDash(e.target.checked)} />
            空白轉連字號
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} />
            全小寫
          </label>
        </div>
        {(invalid || error) && <p className="field-error">{error || '請輸入檔名'}</p>}
        <div className="metric mono" style={{ wordBreak: 'break-all' }}>
          {cleaned}
        </div>
        <button
          type="button"
          className="btn accent"
          disabled={invalid}
          onClick={async () => {
            await copyText(cleaned)
            setCopied(true)
          }}
        >
          {copied ? '已複製' : '複製清理後檔名'}
        </button>
      </div>
    </ProjectShell>
  )
}
