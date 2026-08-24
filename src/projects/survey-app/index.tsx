import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText } from '../../lib/utils'

const meta = getProject('survey-app')!

type Q = { id: string; text: string; options: string[] }
type Response = { id: string; answers: Record<string, string>; at: number }

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7']

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:survey:title', '產品滿意度調查')
  const [qs, setQs] = useLocalStorage<Q[]>('lab:survey:qs', [
    { id: '1', text: '整體滿意度？', options: ['非常滿意', '滿意', '普通', '不滿意'] },
    { id: '2', text: '最常用功能？', options: ['儀表板', '匯出', '協作', '其他'] },
    { id: '3', text: '推薦給朋友的意願？', options: ['一定會', '可能會', '不確定', '不會'] },
    { id: '4', text: '最想改進的地方？', options: ['效能', '介面', '文件', '價格'] },
  ])
  const [responses, setResponses] = useLocalStorage<Response[]>('lab:survey:responses', [])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'edit' | 'take' | 'stats'>('take')

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

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn ghost sm"
          disabled={!responses.length}
          onClick={() => downloadText('survey-results.json', JSON.stringify(responses, null, 2), 'application/json')}
        >
          匯出結果
        </button>
      }
    >
      <div className="row" style={{ marginBottom: 12 }}>
        {(['edit', 'take', 'stats'] as const).map((m) => (
          <button key={m} type="button" className={`btn sm ${mode === m ? 'accent' : 'ghost'}`} onClick={() => setMode(m)}>
            {m === 'edit' ? '編輯' : m === 'take' ? '填寫' : '統計圖表'}
          </button>
        ))}
        <span className="metric">回覆數 {responses.length}</span>
      </div>
      {mode === 'edit' && (
        <div className="panel stack">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setQs((xs) => [...xs, { id: uid('q'), text: '新問題？', options: ['是', '否', '普通'] }])}
          >
            新增題目
          </button>
          {qs.map((q, qi) => (
            <div key={q.id} className="list-item stack">
              <div className="row">
                <span className="tag">Q{qi + 1}</span>
                <input className="field" style={{ flex: 1 }} value={q.text} onChange={(e) => setQs((xs) => xs.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)))} />
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
          ))}
        </div>
      )}
      {mode === 'take' && (
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>{title}</h3>
          {qs.map((q, i) => (
            <div key={q.id} className="stack">
              <div className="label">
                {i + 1}. {q.text}
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {q.options.map((o) => (
                  <button key={o} type="button" className={`btn sm ${answers[q.id] === o ? 'accent' : 'ghost'}`} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (Object.keys(answers).length < qs.length) return
              setResponses((rs) => [...rs, { id: uid('r'), answers, at: Date.now() }])
              setAnswers({})
              setMode('stats')
            }}
          >
            送出回覆
          </button>
        </div>
      )}
      {mode === 'stats' && (
        <div className="panel stack">
          {responses.length === 0 && <p className="muted">尚無資料，先填寫一筆回覆</p>}
          {qs.map((q) => {
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
          })}
        </div>
      )}
    </ProjectShell>
  )
}
