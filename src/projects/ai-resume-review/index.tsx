import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('ai-resume-review')!

type Dim = { key: string; label: string; score: number; note: string }
type Issue = { id: string; section: string; severity: '高' | '中' | '低'; text: string; rewrite: string }
type ReviewResult = { overall: number; dims: Dim[]; issues: Issue[]; summary: string; chars: number; at: number }

const PRESETS: { label: string; text: string }[] = [
  {
    label: '完整範例',
    text: '王小明 | frontend@example.com | 0912345678\n前端工程師\n簡介：專注設計系統與效能的前端工程師\n- 負責電商前台改版，轉換率提升 18%\n- 主導設計系統落地，元件庫涵蓋 40+ 元件\n技能：React, TypeScript, CSS\n學歷：台灣大學 資訊工程',
  },
  {
    label: '偏弱版本',
    text: '小明\n做過一些網站\n會一點程式\n想找前端工作',
  },
  {
    label: '後端範例',
    text: '陳大文 | backend@example.com | 0987654321\n後端工程師\n自我介紹：熟悉分散式系統與 API 設計\n- 優化訂單服務延遲，P99 降低 35%\n- 實作事件驅動架構，日處理 200萬+ 訊息\n技能：Go, PostgreSQL, Kafka\n教育：交通大學 資訊工程碩士',
  },
]

function review(resume: string): Omit<ReviewResult, 'at'> {
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
  return { overall, dims, issues, summary, chars: len }
}

export default function Page() {
  const [resume, setResume] = useLocalStorage('lab:ai-resume-review', PRESETS[0]!.text)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [history, setHistory] = useLocalStorage<ReviewResult[]>('lab:ai-resume-review:history', [])
  const [favs, setFavs] = useLocalStorage<Issue[]>('lab:ai-resume-review:favs', [])
  const [step, setStep] = useState<'paste' | 'report'>('paste')

  function run() {
    const r = { ...review(resume), at: Date.now() }
    setResult(r)
    setHistory((h) => [r, ...h].slice(0, 15))
    setStep('report')
  }

  function exportReport() {
    if (!result) return
    const body = [
      `# 履歷健檢報告`,
      `綜合分數：${result.overall}（${result.summary}）`,
      `字數：${result.chars}`,
      `時間：${new Date(result.at).toLocaleString('zh-TW')}`,
      '',
      '## 維度',
      ...result.dims.map((d) => `- ${d.label}：${d.score} — ${d.note}`),
      '',
      '## 建議',
      ...result.issues.map((i) => `### [${i.severity}] ${i.section}：${i.text}\n→ ${i.rewrite}`),
    ].join('\n')
    downloadText('resume-review.md', body, 'text/markdown;charset=utf-8')
  }

  function toggleFav(iss: Issue) {
    setFavs((xs) => (xs.some((f) => f.id === iss.id && f.text === iss.text) ? xs.filter((f) => !(f.id === iss.id && f.text === iss.text)) : [iss, ...xs].slice(0, 30)))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!result} onClick={exportReport}>
            匯出報告
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!history.length && !favs.length}
            onClick={() => {
              setHistory([])
              setFavs([])
              setResult(null)
              setStep('paste')
            }}
          >
            清空紀錄
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn sm ${step === 'paste' ? 'accent' : 'ghost'}`} onClick={() => setStep('paste')}>
          1. 貼上履歷
        </button>
        <button type="button" className={`btn sm ${step === 'report' ? 'accent' : 'ghost'}`} onClick={() => setStep('report')} disabled={!result}>
          2. 健檢報告
        </button>
        <span className="mono muted">{resume.trim().length} 字</span>
      </div>

      {step === 'paste' && (
        <div className="panel stack">
          <div className="label">範例履歷</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn sm ghost" onClick={() => setResume(p.text)}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="label">履歷文字</label>
          <textarea className="field" rows={16} value={resume} onChange={(e) => setResume(e.target.value)} />
          <div className="row">
            <button type="button" className="btn accent" onClick={run} disabled={!resume.trim()}>
              健檢
            </button>
            <button type="button" className="btn ghost" onClick={() => setResume('')}>
              清空輸入
            </button>
          </div>
          {!resume.trim() && (
            <div className="list-item">
              <p className="muted" style={{ margin: 0 }}>
                貼上履歷或選範例，啟發式規則會評分聯絡、量化、動詞、結構與區塊完整度（無需真實 LLM）。
              </p>
            </div>
          )}
        </div>
      )}

      {step === 'report' && (
        <div className="grid-2">
          <div className="panel stack">
            {!result ? (
              <div className="list-item stack">
                <strong>尚無報告</strong>
                <p className="muted" style={{ margin: 0 }}>
                  回到上一步貼上履歷並按「健檢」。
                </p>
              </div>
            ) : (
              <>
                <div className="metric">
                  <div className="muted">綜合分數</div>
                  <div style={{ fontSize: 36, fontWeight: 700 }}>{result.overall}</div>
                  <div className="tag">{result.summary}</div>
                  <div className="muted mono">{result.chars} 字 · {new Date(result.at).toLocaleString('zh-TW')}</div>
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
                <button type="button" className="btn ghost sm" onClick={() => setStep('paste')}>
                  ← 修改履歷再測
                </button>
              </>
            )}
          </div>
          <div className="panel stack">
            <div className="label">問題檢查清單</div>
            {!result ? (
              <p className="muted">健檢後顯示建議</p>
            ) : (
              <>
                <ul className="list">
                  {result.issues.map((iss) => {
                    const isFav = favs.some((f) => f.id === iss.id && f.text === iss.text)
                    return (
                      <li key={iss.id} className="list-item stack" style={{ gap: 4 }}>
                        <div className="row">
                          <span className="tag">{iss.section}</span>
                          <span className="tag">{iss.severity}</span>
                          <strong>{iss.text}</strong>
                        </div>
                        <div className="muted">建議改寫：{iss.rewrite}</div>
                        <div className="row">
                          <button type="button" className="btn sm ghost" onClick={() => void copyText(iss.rewrite)}>
                            複製建議
                          </button>
                          <button type="button" className={`btn sm ${isFav ? 'accent' : 'ghost'}`} onClick={() => toggleFav(iss)}>
                            {isFav ? '已收藏' : '收藏'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => void copyText(result.issues.map((i) => `[${i.section}] ${i.text}\n→ ${i.rewrite}`).join('\n\n'))}
                >
                  複製全部建議
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel stack">
          <div className="row">
            <div className="label">健檢歷史</div>
            <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          {history.length === 0 ? (
            <p className="muted">每次健檢會留下分數快照。</p>
          ) : (
            <ul className="list" style={{ maxHeight: 200, overflow: 'auto' }}>
              {history.map((h, i) => (
                <li key={h.at} className="list-item row">
                  <span className="metric">{h.overall}</span>
                  <span style={{ flex: 1 }} className="muted">
                    {h.summary} · {h.chars} 字 · {new Date(h.at).toLocaleString('zh-TW')}
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setResult(h)
                      setStep('report')
                    }}
                  >
                    查看
                  </button>
                  {i === 0 && <span className="tag">最新</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel stack">
          <div className="row">
            <div className="label">收藏建議</div>
            <button type="button" className="btn sm ghost" disabled={!favs.length} onClick={() => setFavs([])}>
              清空
            </button>
          </div>
          {favs.length === 0 ? (
            <p className="muted">把實用的改寫建議收藏起來。</p>
          ) : (
            <ul className="list" style={{ maxHeight: 200, overflow: 'auto' }}>
              {favs.map((f) => (
                <li key={`${f.id}-${f.text}`} className="list-item stack" style={{ gap: 4 }}>
                  <strong>
                    [{f.severity}] {f.text}
                  </strong>
                  <span className="muted">{f.rewrite}</span>
                  <button type="button" className="btn sm ghost" onClick={() => void copyText(f.rewrite)}>
                    複製
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
