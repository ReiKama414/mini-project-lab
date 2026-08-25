import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'

const meta: ProjectMeta = getProject('tracking-url-cleaner') ?? {
  slug: 'tracking-url-cleaner',
  title: '追蹤參數清理',
  description: '移除常見追蹤 query 參數。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const TRACK = /^(utm_|fbclid|gclid|mc_|igshid|ref|ref_src|si$|_hs|yclid|msclkid|twclid)/i
const MAX = 2000

export default function Page() {
  const [url, setUrl] = useLocalStorage(
    'lab:tracking-url-cleaner:url',
    'https://example.com/page?id=1&utm_source=tw&fbclid=abc&q=hello',
  )
  const [out, setOut] = useState('')
  const [removed, setRemoved] = useState<string[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function clean() {
    if (!isNonEmpty(url)) {
      setError('請輸入網址')
      setOut('')
      setRemoved([])
      return
    }
    if (!isValidHttpUrl(url)) {
      setError('網址無效（需 http／https）')
      setOut('')
      setRemoved([])
      return
    }
    try {
      const u = new URL(normalizeHttpUrl(url))
      const gone: string[] = []
      ;[...u.searchParams.keys()].forEach((k) => {
        if (TRACK.test(k)) {
          gone.push(k)
          u.searchParams.delete(k)
        }
      })
      setOut(u.toString())
      setRemoved(gone)
      setError('')
      setCopied(false)
    } catch {
      setError('解析失敗')
      setOut('')
      setRemoved([])
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          依啟發式規則移除常見追蹤參數（utm_、fbclid、gclid 等）。非完整清單；業務參數請自行確認後再分享。
        </p>
        <label className="stack">
          <span className="label">網址</span>
          <textarea
            className={`field mono${error ? ' is-invalid' : ''}`}
            rows={3}
            value={url}
            maxLength={MAX}
            onChange={(e) => setUrl(limitText(e.target.value, MAX))}
          />
          <div className="field-meta">
            <span>
              {charCount(url)} / {MAX}
            </span>
          </div>
        </label>
        <div className="row">
          <button type="button" className="btn accent" onClick={clean}>
            清理
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!out}
            onClick={async () => {
              await copyText(out)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {!!removed.length && <p className="field-hint">已移除：{removed.join(', ')}</p>}
        {out && !removed.length && <p className="field-hint">未偵測到常見追蹤參數</p>}
        {out && (
          <pre className="metric mono" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            {out}
          </pre>
        )}
      </div>
    </ProjectShell>
  )
}
