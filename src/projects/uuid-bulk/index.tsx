import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const meta: ProjectMeta = getProject('uuid-bulk') ?? {
  slug: 'uuid-bulk',
  title: 'UUID 批次產生',
  description: '大量產生 UUID v4 並匯出。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MIN = 1
const MAX = 2000

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-bulk:count', 50)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = clamp(Number.isFinite(count) ? count : MIN, MIN, MAX)

  function generate() {
    setBusy(true)
    setCopied(false)
    // Yield so UI can paint busy state for large batches
    window.setTimeout(() => {
      setList(Array.from({ length: n }, () => uuidv4()))
      setBusy(false)
    }, 0)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          本機產生 UUID v4（亂數），不上傳。單次上限 {MAX} 組。
        </p>
        <label className="stack">
          <span className="label">
            數量（{MIN}–{MAX}）
          </span>
          <input
            className="field"
            type="number"
            min={MIN}
            max={MAX}
            value={n}
            onChange={(e) => setCount(clamp(parseNumber(e.target.value, MIN), MIN, MAX))}
          />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" disabled={busy} onClick={generate}>
            {busy ? '產生中…' : '產生'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!list.length}
            onClick={async () => {
              await copyText(list.join('\n'))
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '全部複製'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!list.length}
            onClick={() => downloadText('uuids.txt', list.join('\n'))}
          >
            下載 TXT
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!list.length}
            onClick={() => downloadText('uuids.csv', `uuid\n${list.join('\n')}`, 'text/csv')}
          >
            下載 CSV
          </button>
        </div>
        <span className="metric">{list.length} 組</span>
        <pre className="metric mono" style={{ maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {list.join('\n') || '尚未產生'}
        </pre>
      </div>
    </ProjectShell>
  )
}
