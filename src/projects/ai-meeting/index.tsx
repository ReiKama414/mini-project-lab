import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('ai-meeting')!

function summarize(notes: string) {
  const lines = notes
    .split(/\n|[。！？.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
  const decisions = lines.filter((l) => /決定|同意|採用|通過|確認/.test(l)).slice(0, 5)
  const actions = lines.filter((l) => /待辦|負責|截止|要做|跟進|請/.test(l)).slice(0, 6)
  const risks = lines.filter((l) => /風險|阻塞|問題|延遲|擔心/.test(l)).slice(0, 4)
  const key = lines.slice(0, 4)
  return {
    summary: key.length ? key.map((k, i) => `${i + 1}. ${k}`).join('\n') : '（筆記過短，請補充更多內容）',
    decisions: decisions.length ? decisions.map((d) => `• ${d}`).join('\n') : '• 未偵測到明確決策句，可人工補上',
    actions: actions.length ? actions.map((a) => `☐ ${a}`).join('\n') : '☐ 請手動列出負責人與截止日',
    risks: risks.length ? risks.map((r) => `⚠ ${r}`).join('\n') : '⚠ 暫無明顯風險關鍵字',
  }
}

export default function Page() {
  const [notes, setNotes] = useLocalStorage(
    'lab:ai-meeting',
    '確認 Q3 里程碑。同意採用新設計稿。小明負責 API 整合，截止週五。風險：第三方延遲可能影響上線。請產品跟進用戶訪談。',
  )
  const [result, setResult] = useState<ReturnType<typeof summarize> | null>(null)

  const text = result
    ? `【會議摘要】\n${result.summary}\n\n【決策】\n${result.decisions}\n\n【待辦】\n${result.actions}\n\n【風險】\n${result.risks}`
    : ''

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">會議筆記</label>
          <textarea className="field" rows={12} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className="btn accent" onClick={() => setResult(summarize(notes))}>
            產生摘要
          </button>
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="label">輸出</span>
            <button type="button" className="btn sm ghost" disabled={!text} onClick={() => copyText(text)}>
              複製
            </button>
            <button type="button" className="btn sm ghost" disabled={!text} onClick={() => downloadText('meeting-summary.txt', text)}>
              下載
            </button>
          </div>
          {result ? (
            <div className="stack">
              <div>
                <div className="tag">摘要</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                  {result.summary}
                </pre>
              </div>
              <div>
                <div className="tag">決策</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                  {result.decisions}
                </pre>
              </div>
              <div>
                <div className="tag">待辦</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                  {result.actions}
                </pre>
              </div>
              <div>
                <div className="tag">風險</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                  {result.risks}
                </pre>
              </div>
            </div>
          ) : (
            <p className="muted">貼上筆記後產生結構化摘要</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
