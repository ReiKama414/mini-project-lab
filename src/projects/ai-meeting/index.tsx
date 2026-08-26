import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-meeting')!

const TITLE_MAX = 120
const NOTES_MAX = 20000

type Action = { id: string; text: string; owner: string; done: boolean }

function extractAttendees(notes: string): string[] {
  const found = new Set<string>()
  const m = notes.match(/(?:出席|參與|參加|attendees?)[:：]\s*([^\n]+)/i)
  if (m?.[1]) {
    m[1]
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .forEach((s) => found.add(s))
  }
  const nameHits = notes.match(/(?:小[\u4e00-\u9fff]{1,2}|[\u4e00-\u9fff]{2,3}(?=負責|表示|同意|跟進))/g) || []
  nameHits.forEach((n) => found.add(n))
  return [...found].slice(0, 12)
}

function extractDecisions(lines: string[]): string[] {
  return lines.filter((l) => /決定|同意|採用|通過|確認|拍板|決議/.test(l)).slice(0, 8)
}

function extractActions(lines: string[]): Action[] {
  return lines
    .filter((l) => /待辦|負責|截止|要做|跟進|請|需|交付/.test(l))
    .slice(0, 10)
    .map((text) => {
      const ownerMatch = text.match(/([\u4e00-\u9fff]{2,4}|[A-Za-z]+)(?=負責|跟進)/)
      return {
        id: uid('a'),
        text,
        owner: ownerMatch?.[1] || '未指定',
        done: false,
      }
    })
}

function extractRisks(lines: string[]): string[] {
  return lines.filter((l) => /風險|阻塞|問題|延遲|擔心|瓶頸/.test(l)).slice(0, 6)
}

export default function Page() {
  const [notes, setNotes] = useLocalStorage(
    'lab:ai-meeting',
    '出席：小明、雅婷、志豪\n確認 Q3 里程碑。同意採用新設計稿。小明負責 API 整合，截止週五。風險：第三方延遲可能影響上線。請產品跟進用戶訪談。決議：下週一再 review。',
  )
  const [title, setTitle] = useLocalStorage('lab:ai-meeting:title', '週會摘要')
  const [attendees, setAttendees] = useState<string[]>([])
  const [decisions, setDecisions] = useState<string[]>([])
  const [actions, setActions] = useLocalStorage<Action[]>('lab:ai-meeting:actions', [])
  const [risks, setRisks] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [ready, setReady] = useState(false)

  const canAnalyze = isNonEmpty(notes)

  function analyze() {
    if (!canAnalyze) return
    const lines = notes
      .split(/\n|[。！？.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3)
    const att = extractAttendees(notes)
    const dec = extractDecisions(lines)
    const act = extractActions(lines)
    const risk = extractRisks(lines)
    const key = lines.filter((l) => !/出席|參與/.test(l)).slice(0, 4)
    setAttendees(att)
    setDecisions(dec)
    setActions(act)
    setRisks(risk)
    setSummary(key.map((k, i) => `${i + 1}. ${k}`).join('\n') || '（筆記過短）')
    setReady(true)
  }

  const markdown = useMemo(() => {
    if (!ready) return ''
    return [
      `# ${title}`,
      '',
      `## 出席`,
      attendees.length ? attendees.map((a) => `- ${a}`).join('\n') : '- （未偵測）',
      '',
      `## 摘要`,
      summary,
      '',
      `## 決策`,
      decisions.length ? decisions.map((d) => `- ${d}`).join('\n') : '- （無）',
      '',
      `## 待辦`,
      actions.length
        ? actions.map((a) => `- [${a.done ? 'x' : ' '}] ${a.text}（${a.owner}）`).join('\n')
        : '- [ ] （請手動補）',
      '',
      `## 風險`,
      risks.length ? risks.map((r) => `- ${r}`).join('\n') : '- （無）',
    ].join('\n')
  }, [ready, title, attendees, summary, decisions, actions, risks])

  const doneCount = actions.filter((a) => a.done).length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!markdown} onClick={() => copyText(markdown)}>
            複製 Markdown
          </button>
          <button type="button" className="btn ghost sm" disabled={!markdown} onClick={() => downloadText('meeting.md', markdown, 'text/markdown;charset=utf-8')}>
            下載
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        本機規則／模板示範，非雲端 LLM
      </p>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">會議標題</label>
          <input
            className="field"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))}
          />
          <div className="field-meta">
            <span className="field-hint">標題會出現在匯出 Markdown</span>
            <span>{charCount(title)}/{TITLE_MAX}</span>
          </div>
          <label className="label">會議筆記</label>
          <textarea
            className={cn('field', !canAnalyze && 'is-invalid')}
            rows={12}
            maxLength={NOTES_MAX}
            value={notes}
            onChange={(e) => setNotes(limitText(e.target.value, NOTES_MAX))}
          />
          <div className="field-meta">
            <span className={!canAnalyze ? 'warn' : undefined}>{canAnalyze ? '可分析' : '請貼上會議筆記'}</span>
            <span>{charCount(notes)}/{NOTES_MAX}</span>
          </div>
          {!canAnalyze && <p className="field-error">筆記不可空白</p>}
          <button type="button" className="btn accent" onClick={analyze} disabled={!canAnalyze}>
            產生摘要
          </button>
        </div>
        <div className="panel stack">
          {!ready ? (
            <p className="muted">貼上筆記後產生出席、決策與待辦清單</p>
          ) : (
            <>
              <div>
                <div className="tag">出席</div>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
                  {attendees.length === 0 && <span className="muted">未偵測到</span>}
                  {attendees.map((a) => (
                    <span key={a} className="tag">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="tag">摘要</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                  {summary}
                </pre>
              </div>
              <div>
                <div className="tag">決策</div>
                <ul className="list">
                  {decisions.map((d) => (
                    <li key={d} className="list-item">
                      {d}
                    </li>
                  ))}
                  {decisions.length === 0 && <li className="muted">無明確決策句</li>}
                </ul>
              </div>
              <div>
                <div className="row">
                  <div className="tag">待辦清單</div>
                  <span className="muted">
                    {doneCount}/{actions.length}
                  </span>
                </div>
                <div className="progress" style={{ margin: '8px 0' }}>
                  <div
                    style={{
                      width: `${actions.length ? (doneCount / actions.length) * 100 : 0}%`,
                      height: 8,
                      borderRadius: 4,
                      background: '#22c55e',
                    }}
                  />
                </div>
                <ul className="list">
                  {actions.map((a) => (
                    <li key={a.id} className="list-item row">
                      <label className="row" style={{ flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={a.done}
                          onChange={() =>
                            setActions((xs) => xs.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)))
                          }
                        />
                        <span style={{ textDecoration: a.done ? 'line-through' : 'none' }}>{a.text}</span>
                      </label>
                      <span className="tag">{a.owner}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="tag">風險</div>
                <ul className="list">
                  {risks.map((r) => (
                    <li key={r} className="list-item">
                      {r}
                    </li>
                  ))}
                  {risks.length === 0 && <li className="muted">暫無</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
