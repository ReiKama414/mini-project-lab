import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('ai-resume-review')!

function review(resume: string) {
  const len = resume.trim().length
  const hasEmail = /[\w.-]+@[\w.-]+/.test(resume)
  const hasPhone = /\d{8,}/.test(resume)
  const hasMetrics = /\d+%|\d+\+|提升|成長|降低/.test(resume)
  const hasAction = /負責|主導|完成|設計|優化|實作/.test(resume)
  const bullets = resume.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('•')).length
  const score = Math.min(
    100,
    40 +
      (len > 200 ? 15 : len > 80 ? 8 : 0) +
      (hasEmail ? 8 : 0) +
      (hasPhone ? 5 : 0) +
      (hasMetrics ? 15 : 0) +
      (hasAction ? 12 : 0) +
      Math.min(bullets * 3, 12),
  )
  const tips: string[] = []
  if (!hasMetrics) tips.push('加入量化成果（％、人數、時間、營收）。')
  if (!hasAction) tips.push('多用行動動詞開頭：主導、設計、優化、交付。')
  if (bullets < 3) tips.push('經歷建議改成條列，方便掃描。')
  if (len < 120) tips.push('內容偏短，可補技能與專案亮點。')
  if (!hasEmail) tips.push('記得放可聯絡的 Email。')
  if (tips.length === 0) tips.push('整體不錯！可再針對目標職缺微調關鍵字。')
  return { score, tips, summary: score >= 80 ? '表現優秀' : score >= 60 ? '中上，可再強化' : '基礎可讀，建議補強' }
}

export default function Page() {
  const [resume, setResume] = useLocalStorage(
    'lab:ai-resume-review',
    '王小明 | frontend@example.com | 0912345678\n前端工程師\n- 負責電商前台改版，轉換率提升 18%\n- 主導設計系統落地，元件庫涵蓋 40+ 元件\n技能：React, TypeScript, CSS',
  )
  const [result, setResult] = useState<ReturnType<typeof review> | null>(null)

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">履歷文字</label>
          <textarea className="field" rows={14} value={resume} onChange={(e) => setResume(e.target.value)} />
          <button type="button" className="btn accent" onClick={() => setResult(review(resume))}>
            健檢
          </button>
        </div>
        <div className="panel stack">
          {result ? (
            <>
              <div className="metric">
                <div className="muted">綜合分數</div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{result.score}</div>
                <div className="tag">{result.summary}</div>
              </div>
              <div className="progress" style={{ ['--p' as string]: `${result.score}%` }}>
                <div style={{ width: `${result.score}%`, height: 8, background: 'var(--accent, #3b82f6)', borderRadius: 4 }} />
              </div>
              <ul className="list">
                {result.tips.map((t) => (
                  <li key={t} className="list-item">
                    {t}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn ghost sm" onClick={() => copyText(result.tips.join('\n'))}>
                複製建議
              </button>
            </>
          ) : (
            <p className="muted">貼上履歷後按「健檢」取得建議</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
