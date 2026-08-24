import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('ai-resume-review')!

type Dim = { key: string; label: string; score: number; note: string }
type Issue = { id: string; section: string; severity: '高' | '中' | '低'; text: string; rewrite: string }

function review(resume: string) {
  const len = resume.trim().length
  const hasEmail = /[\w.-]+@[\w.-]+/.test(resume)
  const hasPhone = /\d{8,}/.test(resume)
  const hasMetrics = /\d+%|\d+\+|提升|成長|降低|減少|增加/.test(resume)
  const hasAction = /負責|主導|完成|設計|優化|實作|交付|帶領/.test(resume)
  const bullets = resume.split('\n').filter((l) => /^\s*[-•*]/.test(l)).length
  const hasSkills = /技能|skills?/i.test(resume)
  const hasExp = /經歷|experience|公司|工程師|設計師/i.test(resume)
  const hasEdu = /學歷|教育|大學|學院|education/i.test(resume)
  const hasSummary = /簡介|自我介紹|summary|關於我/i.test(resume)

  const dims: Dim[] = [
    {
      key: 'contact',
      label: '聯絡資訊',
      score: Math.min(100, (hasEmail ? 55 : 20) + (hasPhone ? 45 : 15)),
      note: hasEmail && hasPhone ? '聯絡方式完整' : '建議補 Email／電話',
    },
    {
      key: 'impact',
      label: '量化成果',
      score: hasMetrics ? 88 : len > 200 ? 45 : 30,
      note: hasMetrics ? '有數據佐證' : '缺少％／人數等數字',
    },
    {
      key: 'verbs',
      label: '行動動詞',
      score: hasAction ? 85 : 40,
      note: hasAction ? '動詞開頭清楚' : '多用主導／設計／優化',
    },
    {
      key: 'structure',
      label: '結構可掃',
      score: Math.min(100, 30 + Math.min(bullets * 12, 50) + (hasSkills ? 10 : 0) + (hasExp ? 10 : 0)),
      note: bullets >= 3 ? '條列清楚' : '經歷建議改成條列',
    },
    {
      key: 'coverage',
      label: '區塊完整度',
      score: Math.min(100, (hasSummary ? 25 : 5) + (hasExp ? 30 : 10) + (hasSkills ? 25 : 10) + (hasEdu ? 20 : 5)),
      note: [hasSummary, hasExp, hasSkills, hasEdu].filter(Boolean).length >= 3 ? '主要區塊齊全' : '可補簡介／學歷等',
    },
  ]

  const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)

  const issues: Issue[] = []
  if (!hasEmail) {
    issues.push({
      id: 'email',
      section: '聯絡',
      severity: '高',
      text: '缺少可聯絡 Email',
      rewrite: '在標題列加入：your.name@email.com',
    })
  }
  if (!hasMetrics) {
    issues.push({
      id: 'metrics',
      section: '經歷',
      severity: '高',
      text: '缺乏量化成果',
      rewrite: '把「負責前台改版」改成「主導前台改版，轉換率提升 18%」',
    })
  }
  if (!hasAction) {
    issues.push({
      id: 'verbs',
      section: '經歷',
      severity: '中',
      text: '動詞偏弱',
      rewrite: '條列改以「主導／設計／優化／交付」開頭',
    })
  }
  if (bullets < 3) {
    issues.push({
      id: 'bullets',
      section: '格式',
      severity: '中',
      text: '條列不足，掃描困難',
      rewrite: '每段經歷改為 3–5 條「- 成果」',
    })
  }
  if (!hasSkills) {
    issues.push({
      id: 'skills',
      section: '技能',
      severity: '中',
      text: '未標示技能區',
      rewrite: '新增區塊：技能：React, TypeScript, CSS…',
    })
  }
  if (len < 120) {
    issues.push({
      id: 'length',
      section: '整體',
      severity: '低',
      text: '內容偏短',
      rewrite: '補 1–2 個專案亮點與技術關鍵字',
    })
  }
  if (!hasSummary) {
    issues.push({
      id: 'summary',
      section: '簡介',
      severity: '低',
      text: '缺少一句話定位',
      rewrite: '開頭加：前端工程師｜專注設計系統與效能',
    })
  }
  if (issues.length === 0) {
    issues.push({
      id: 'ok',
      section: '整體',
      severity: '低',
      text: '整體良好，可針對職缺微調關鍵字',
      rewrite: '將 JD 關鍵字自然嵌入技能與經歷條',
    })
  }

  const summary = overall >= 80 ? '表現優秀' : overall >= 60 ? '中上，可再強化' : '基礎可讀，建議補強'
  return { overall, dims, issues, summary }
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
          <textarea className="field" rows={16} value={resume} onChange={(e) => setResume(e.target.value)} />
          <button type="button" className="btn accent" onClick={() => setResult(review(resume))}>
            健檢
          </button>
        </div>
        <div className="panel stack">
          {!result ? (
            <p className="muted">貼上履歷後按「健檢」取得維度分數與改寫建議</p>
          ) : (
            <>
              <div className="metric">
                <div className="muted">綜合分數</div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{result.overall}</div>
                <div className="tag">{result.summary}</div>
              </div>
              <div className="progress">
                <div style={{ width: `${result.overall}%`, height: 8, background: 'var(--accent, #3b82f6)', borderRadius: 4 }} />
              </div>
              <div className="label">維度分數</div>
              {result.dims.map((d) => (
                <div key={d.key} className="stack" style={{ gap: 4 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span>{d.label}</span>
                    <span className="mono">{d.score}</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${d.score}%`, height: 6, borderRadius: 4, background: '#6366f1' }} />
                  </div>
                  <span className="muted">{d.note}</span>
                </div>
              ))}
              <div className="label">問題檢查清單</div>
              <ul className="list">
                {result.issues.map((iss) => (
                  <li key={iss.id} className="list-item stack" style={{ gap: 4 }}>
                    <div className="row">
                      <span className="tag">{iss.section}</span>
                      <span className="tag">{iss.severity}</span>
                      <strong>{iss.text}</strong>
                    </div>
                    <div className="muted">建議改寫：{iss.rewrite}</div>
                    <button type="button" className="btn sm ghost" onClick={() => copyText(iss.rewrite)}>
                      複製建議
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => copyText(result.issues.map((i) => `[${i.section}] ${i.text}\n→ ${i.rewrite}`).join('\n\n'))}
              >
                複製全部建議
              </button>
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
