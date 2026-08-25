import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'privacy-checker',
  title: '隱私風險檢查',
  description: '掃描文字中的 email／電話／身分相關模式。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('privacy-checker') ?? fallback

const MAX = 50_000

export default function Page() {
  const [text, setText] = useLocalStorage(
    'lab:privacy-checker:text',
    '聯絡我：ada@example.com 或 +886-912-345-678，卡號示範 4111-1111-1111-1111',
  )
  const [findings, setFindings] = useState<{ type: string; value: string }[]>([])
  const [scanned, setScanned] = useState(false)
  const [error, setError] = useState('')

  function scan() {
    if (!isNonEmpty(text)) {
      setError('請輸入文字')
      setFindings([])
      setScanned(false)
      return
    }
    const out: { type: string; value: string }[] = []
    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
    email.forEach((v) => out.push({ type: 'Email', value: v }))
    const phone = text.match(/\+?\d[\d\s-]{7,}\d/g) || []
    phone.forEach((v) => out.push({ type: '電話樣式', value: v.trim() }))
    const card = text.match(/\b(?:\d[ -]*?){13,19}\b/g) || []
    card.forEach((v) => out.push({ type: '可能卡號', value: v.trim() }))
    setFindings(out)
    setScanned(true)
    setError('')
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        簡易正則啟發式掃描，可能誤判或漏判，不能取代正式個資審查。文字僅在本機處理。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">文字（本機掃描）</span>
          <textarea
            className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
            rows={8}
            value={text}
            maxLength={MAX}
            onChange={(e) => {
              setText(limitText(e.target.value, MAX))
              setScanned(false)
            }}
          />
          <div className="field-meta">
            <span>
              {charCount(text).toLocaleString()} / {MAX.toLocaleString()}
            </span>
          </div>
        </label>
        <button type="button" className="btn accent" onClick={scan}>
          掃描
        </button>
        {error && <p className="field-error">{error}</p>}
        <span className="metric">發現 {findings.length} 項</span>
        <ul className="list">
          {findings.map((f, i) => (
            <li key={`${f.type}-${f.value}-${i}`} className="list-item">
              <span className="tag">{f.type}</span>
              <code className="mono">{f.value}</code>
            </li>
          ))}
          {!findings.length && <p className="muted">{scanned ? '未偵測到符合模式的內容' : '尚未掃描'}</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
