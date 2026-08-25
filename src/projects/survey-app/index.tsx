import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, charCount, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('survey-app')!

type Q = { id: string; text: string; options: string[] }
type Response = { id: string; answers: Record<string, string>; at: number }
type Mode = 'edit' | 'take' | 'stats'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']

const PRESETS: { label: string; title: string; qs: Omit<Q, 'id'>[] }[] = [
  {
    label: '產品滿意度',
    title: '產品滿意度調查',
    qs: [
      { text: '整體滿意度？', options: ['非常滿意', '滿意', '普通', '不滿意'] },
      { text: '最常用功能？', options: ['儀表板', '匯出', '協作', '其他'] },
      { text: '推薦給朋友的意願？', options: ['一定會', '可能會', '不確定', '不會'] },
      { text: '最想改進的地方？', options: ['效能', '介面', '文件', '價格'] },
    ],
  },
  {
    label: '活動回饋',
    title: '活動回饋問卷',
    qs: [
      { text: '內容實用嗎？', options: ['很實用', '還行', '普通', '不太實用'] },
      { text: '節奏如何？', options: ['太快', '剛好', '太慢'] },
      { text: '會再參加嗎？', options: ['會', '看情況', '不會'] },
    ],
  },
  {
    label: '內部 NPS',
    title: '內部 NPS 快測',
    qs: [
      { text: '推薦同事使用的意願？', options: ['10', '9', '8', '7', '6 以下'] },
      { text: '主要卡點？', options: ['學習成本', '缺功能', '不穩定', '沒有'] },
    ],
  },
]

const MAX_TITLE = 80
const MAX_QUESTION = 200
const MAX_QUESTIONS = 30

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:survey:title', PRESETS[0]!.title)
  const [qs, setQs] = useLocalStorage<Q[]>(
    'lab:survey:qs',
    PRESETS[0]!.qs.map((q, i) => ({ ...q, id: String(i + 1) })),
  )
  const [responses, setResponses] = useLocalStorage<Response[]>('lab:survey:responses', [])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<Mode>('take')
  const [takeStep, setTakeStep] = useState(0)
  const [favTitle, setFavTitle] = useLocalStorage('lab:survey:fav-title', '')

  const stats = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    qs.forEach((q) => {
      map[q.id] = Object.fromEntries(q.options.map((o) => [o, 0]))
    })
    responses.forEach((r) => {
      Object.entries(r.answers).forEach(([qid, ans]) => {
        if (map[qid] && map[qid]![ans] !== undefined) map[qid]![ans]!++
      })
    })
    return map
  }, [qs, responses])

  const answeredCount = Object.keys(answers).filter((k) => answers[k]).length
  const currentQ = qs[takeStep]
  const allAnswered = qs.length > 0 && answeredCount >= qs.length

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title)
    setQs(p.qs.map((q) => ({ ...q, id: uid('q') })))
    setAnswers({})
    setTakeStep(0)
    setMode('edit')
  }

  function submit() {
    if (!allAnswered) return
    setResponses((rs) => [...rs, { id: uid('r'), answers, at: Date.now() }])
    setAnswers({})
    setTakeStep(0)
    setMode('stats')
  }

  function exportCsv() {
    const header = ['時間', ...qs.map((q) => q.text)]
    const rows = responses.map((r) => [
      new Date(r.at).toISOString(),
      ...qs.map((q) => r.answers[q.id] || ''),
    ])
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadText('survey-results.csv', csv, 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button
            type="button"
            className="btn ghost sm"
            disabled={!responses.length}
            onClick={() => downloadText('survey-results.json', JSON.stringify(responses, null, 2), 'application/json')}
          >
            匯出 JSON
          </button>
          <button type="button" className="btn ghost sm" disabled={!responses.length} onClick={exportCsv}>
            匯出 CSV
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(['edit', 'take', 'stats'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn sm ${mode === m ? 'accent' : 'ghost'}`}
            onClick={() => {
              setMode(m)
              if (m === 'take') setTakeStep(0)
            }}
          >
            {m === 'edit' ? '1. 編輯' : m === 'take' ? '2. 填寫' : '3. 統計'}
          </button>
        ))}
        <span className="metric">回覆數 {responses.length}</span>
        {favTitle && favTitle === title && <span className="tag">★ 收藏問卷</span>}
      </div>

      {mode === 'edit' && (
        <div className="panel stack">
          <div className="label">問卷預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`btn sm ${favTitle === title ? 'accent' : 'ghost'}`}
              onClick={() => setFavTitle(favTitle === title ? '' : title)}
            >
              {favTitle === title ? '取消收藏標題' : '收藏此問卷標題'}
            </button>
          </div>
          <div className="row">
            <label className="label">標題</label>
            <span className="mono muted">{title.length} 字</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!isNonEmpty(title) ? 'warn' : undefined}>{!isNonEmpty(title) ? '標題不可空白' : ' '}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              disabled={qs.length >= MAX_QUESTIONS}
              onClick={() => {
                if (qs.length >= MAX_QUESTIONS) return
                setQs((xs) => [...xs, { id: uid('q'), text: '新問題？', options: ['是', '否', '普通'] }])
              }}
            >
              新增題目
            </button>
            <span className="muted">
              {qs.length}/{MAX_QUESTIONS} 題
            </span>
          </div>
          {qs.length === 0 ? (
            <div className="list-item stack">
              <strong>還沒有題目</strong>
              <p className="muted" style={{ margin: 0 }}>
                選預設問卷或新增題目。選項用逗號分隔。
              </p>
            </div>
          ) : (
            qs.map((q, qi) => (
              <div key={q.id} className="list-item stack">
                <div className="row">
                  <span className="tag">Q{qi + 1}</span>
                  <input
                    className="field"
                    style={{ flex: 1 }}
                    value={q.text}
                    onChange={(e) => setQs((xs) => xs.map((x) => (x.id === q.id ? { ...x, text: limitText(e.target.value, MAX_QUESTION) } : x)))}
                  />
                  <span className="mono muted">{q.text.length}</span>
                  <button type="button" className="btn sm danger" onClick={() => setQs((xs) => xs.filter((x) => x.id !== q.id))}>
                    刪
                  </button>
                </div>
                <input
                  className="field"
                  value={q.options.join(', ')}
                  onChange={(e) =>
                    setQs((xs) =>
                      xs.map((x) =>
                        x.id === q.id
                          ? { ...x, options: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }
                          : x,
                      ),
                    )
                  }
                />
              </div>
            ))
          )}
          <button type="button" className="btn accent" disabled={!qs.length} onClick={() => setMode('take')}>
            下一步：填寫 →
          </button>
        </div>
      )}

      {mode === 'take' && (
        <div className="panel stack">
          {qs.length === 0 ? (
            <div className="list-item stack">
              <strong>無可填寫的題目</strong>
              <button type="button" className="btn ghost" onClick={() => setMode('edit')}>
                ← 去編輯
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ margin: 0 }}>{title}</h3>
              <div className="row">
                <span className="muted">
                  進度 {answeredCount}/{qs.length}
                </span>
                <span className="muted">
                  題目 {Math.min(takeStep + 1, qs.length)}/{qs.length}
                </span>
              </div>
              <div className="progress">
                <div
                  style={{
                    width: `${qs.length ? (answeredCount / qs.length) * 100 : 0}%`,
                    height: 8,
                    borderRadius: 4,
                    background: '#22c55e',
                  }}
                />
              </div>
              {currentQ && (
                <div className="stack">
                  <div className="label">
                    {takeStep + 1}. {currentQ.text}
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {currentQ.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`btn sm ${answers[currentQ.id] === o ? 'accent' : 'ghost'}`}
                        onClick={() => {
                          setAnswers((a) => ({ ...a, [currentQ.id]: o }))
                          if (takeStep < qs.length - 1) setTakeStep((s) => s + 1)
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <button type="button" className="btn ghost" disabled={takeStep <= 0} onClick={() => setTakeStep((s) => s - 1)}>
                  上一題
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={takeStep >= qs.length - 1}
                  onClick={() => setTakeStep((s) => s + 1)}
                >
                  下一題
                </button>
                <button type="button" className="btn accent" disabled={!allAnswered} onClick={submit}>
                  送出回覆
                </button>
              </div>
              {!allAnswered && <p className="muted">請答完所有題目後才能送出。</p>}
            </>
          )}
        </div>
      )}

      {mode === 'stats' && (
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="label">統計圖表</span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={!responses.length}
              onClick={() =>
                void copyText(
                  qs
                    .map((q) => {
                      const lines = q.options.map((o) => {
                        const n = stats[q.id]?.[o] || 0
                        const pct = responses.length ? Math.round((n / responses.length) * 100) : 0
                        return `  ${o}: ${n} (${pct}%)`
                      })
                      return `${q.text}\n${lines.join('\n')}`
                    })
                    .join('\n\n'),
                )
              }
            >
              複製摘要
            </button>
            <button type="button" className="btn sm danger" disabled={!responses.length} onClick={() => setResponses([])}>
              清空回覆
            </button>
          </div>
          {responses.length === 0 ? (
            <div className="list-item stack">
              <strong>尚無資料</strong>
              <p className="muted" style={{ margin: 0 }}>
                先在「填寫」步驟送出至少一筆回覆。
              </p>
              <button type="button" className="btn ghost" onClick={() => setMode('take')}>
                去填寫 →
              </button>
            </div>
          ) : (
            qs.map((q) => {
              const total = responses.length || 1
              return (
                <div key={q.id} className="stack" style={{ marginBottom: 16 }}>
                  <strong>{q.text}</strong>
                  <div className="row" style={{ alignItems: 'flex-end', gap: 8, height: 120 }}>
                    {q.options.map((o, oi) => {
                      const n = stats[q.id]?.[o] || 0
                      const pct = Math.round((n / total) * 100)
                      return (
                        <div key={o} className="stack" style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                          <span className="mono muted">{pct}%</span>
                          <div
                            style={{
                              width: '100%',
                              height: `${Math.max(4, pct)}%`,
                              minHeight: n ? 8 : 4,
                              background: COLORS[oi % COLORS.length],
                              borderRadius: 4,
                            }}
                            title={`${o}: ${n}`}
                          />
                          <span style={{ fontSize: 12, textAlign: 'center' }}>{o}</span>
                          <span className="mono muted">{n}</span>
                        </div>
                      )
                    })}
                  </div>
                  {q.options.map((o, oi) => {
                    const n = stats[q.id]?.[o] || 0
                    const pct = responses.length ? Math.round((n / responses.length) * 100) : 0
                    return (
                      <div key={o} className="row" style={{ marginTop: 4 }}>
                        <span style={{ width: 100 }}>{o}</span>
                        <div className="progress" style={{ flex: 1 }}>
                          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: COLORS[oi % COLORS.length] }} />
                        </div>
                        <span className="mono muted">
                          {n} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </ProjectShell>
  )
}
