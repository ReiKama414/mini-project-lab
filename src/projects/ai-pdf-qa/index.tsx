import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('ai-pdf-qa')!

function answer(doc: string, q: string) {
  const query = q.trim().toLowerCase()
  if (!doc.trim()) return '請先貼上文件內容。'
  if (!query) return '請輸入問題。'
  const sentences = doc
    .split(/[。！？\n.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
  const tokens = query.split(/\s+/).filter(Boolean)
  const scored = sentences
    .map((s) => {
      const sl = s.toLowerCase()
      const hit = tokens.filter((t) => sl.includes(t)).length
      return { s, hit }
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit)
  if (scored.length === 0) {
    const preview = sentences.slice(0, 2).join('。')
    return `文件中找不到直接對應句。文件開頭摘要：${preview || '（空白）'}…`
  }
  return `依文件內容：${scored
    .slice(0, 3)
    .map((x) => x.s)
    .join('。')}。`
}

type QA = { q: string; a: string }

export default function Page() {
  const [doc, setDoc] = useLocalStorage(
    'lab:ai-pdf-qa:doc',
    '本產品提供訂閱制方案。基本方案每月 299 元，含 5 位成員。企業方案支援 SSO 與審計日誌。客服時間為週一至週五 9:00–18:00。退款政策為購買後 7 天內可申請。',
  )
  const [q, setQ] = useState('退款政策是什麼？')
  const [history, setHistory] = useLocalStorage<QA[]>('lab:ai-pdf-qa:history', [])

  function ask() {
    const a = answer(doc, q)
    setHistory((h) => [{ q, a }, ...h].slice(0, 20))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">文件內容（貼上 PDF 文字）</label>
          <textarea className="field" rows={12} value={doc} onChange={(e) => setDoc(e.target.value)} />
          <label className="label">問題</label>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button type="button" className="btn accent" onClick={ask}>
            提問
          </button>
        </div>
        <div className="panel stack">
          <div className="label">問答紀錄</div>
          {history.length === 0 && <p className="muted">尚無紀錄</p>}
          <ul className="list">
            {history.map((item, i) => (
              <li key={i} className="list-item stack" style={{ gap: 4 }}>
                <strong>Q: {item.q}</strong>
                <span className="muted">A: {item.a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
