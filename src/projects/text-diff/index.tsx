import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('text-diff') ?? {
  slug: 'text-diff',
  title: '文字 Diff',
  description: '逐行比較兩段文字。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}

const MAX = 100_000

export default function Page() {
  const [a, setA] = useLocalStorage('lab:text-diff:a', 'hello\nworld\nfoo')
  const [b, setB] = useLocalStorage('lab:text-diff:b', 'hello\nWORLD\nbar')
  const [rows, setRows] = useState<{ i: number; left: string; right: string; same: boolean }[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [compared, setCompared] = useState(false)

  function compare() {
    if (!isNonEmpty(a) && !isNonEmpty(b)) {
      setError('請輸入文字')
      setRows([])
      setCompared(false)
      return
    }
    const la = a.split(/\r?\n/)
    const lb = b.split(/\r?\n/)
    const n = Math.max(la.length, lb.length)
    if (n > 5000) {
      setError('行數過多（上限 5000 行）')
      setRows([])
      setCompared(false)
      return
    }
    const out = []
    for (let i = 0; i < n; i++) {
      const left = la[i] ?? ''
      const right = lb[i] ?? ''
      out.push({ i: i + 1, left, right, same: left === right })
    }
    setRows(out)
    setError('')
    setCompared(true)
    setCopied(false)
  }

  const report = rows
    .filter((r) => !r.same)
    .map((r) => `L${r.i}\n- ${r.left || '∅'}\n+ ${r.right || '∅'}`)
    .join('\n\n')
  const diffCount = rows.filter((r) => !r.same).length

  return (
    <ProjectShell meta={meta}>
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        逐行對齊比較（非 LCS／Myers）。插入或刪除整行時，後續行會錯位顯示為「不同」。
      </p>
      <div className="grid-2">
        <label className="stack panel">
          <span className="label">左側</span>
          <textarea className="field mono" rows={10} value={a} maxLength={MAX} onChange={(e) => setA(limitText(e.target.value, MAX))} />
          <div className="field-meta">
            <span>
              {charCount(a).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <label className="stack panel">
          <span className="label">右側</span>
          <textarea className="field mono" rows={10} value={b} maxLength={MAX} onChange={(e) => setB(limitText(e.target.value, MAX))} />
          <div className="field-meta">
            <span>
              {charCount(b).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
      </div>
      <div className="panel stack" style={{ marginTop: 12 }}>
        <div className="row">
          <button type="button" className="btn accent" onClick={compare}>
            比較
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={!diffCount}
            onClick={async () => {
              await copyText(report)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製差異'}
          </button>
          <button type="button" className="btn ghost" disabled={!diffCount} onClick={() => downloadText('text-diff.txt', report)}>
            下載
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        {compared && !error && <p className="field-hint">{diffCount ? `${diffCount} 行不同` : '全部相同'}</p>}
        <ul className="list">
          {rows.map((r) => (
            <li key={r.i} className="list-item stack" style={{ opacity: r.same ? 0.55 : 1 }}>
              <span className="tag">
                L{r.i}
                {r.same ? ' · 相同' : ' · 不同'}
              </span>
              <code className="mono" style={{ fontSize: 12 }}>
                {r.left || '∅'}
              </code>
              <code className="mono" style={{ fontSize: 12 }}>
                {r.right || '∅'}
              </code>
            </li>
          ))}
          {!rows.length && !error && <p className="muted">尚未比較</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
