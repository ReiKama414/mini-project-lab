import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('ai-email')!

type Tone = '正式' | '友善' | '簡潔' | '說服'

function generate(to: string, subject: string, points: string, tone: Tone) {
  const bullets = points
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const open =
    tone === '正式'
      ? `親愛的 ${to || '收件者'}：`
      : tone === '友善'
        ? `嗨 ${to || '您好'}，`
        : tone === '簡潔'
          ? `${to || '您好'}，`
          : `Hi ${to || 'there'},`
  const body =
    tone === '簡潔'
      ? bullets.map((b) => `• ${b}`).join('\n') || '（請補充重點）'
      : tone === '說服'
        ? `我想與您分享一個能帶來明確成果的提案。\n\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') || '（請補充賣點）'}\n\n若方便，希望本週能安排 15 分鐘快速討論。`
        : `關於「${subject || '本次聯絡'}」，整理如下：\n\n${bullets.map((b) => `- ${b}`).join('\n') || '- （請補充內容）'}\n\n若有任何問題，歡迎隨時回覆。`
  const close = tone === '正式' ? '此致\n敬礼' : tone === '友善' ? '謝謝你！\n祝好' : '謝謝\n'
  return `主旨：${subject || '（未填主旨）'}\n\n${open}\n\n${body}\n\n${close}`
}

export default function Page() {
  const [to, setTo] = useLocalStorage('lab:ai-email:to', '')
  const [subject, setSubject] = useLocalStorage('lab:ai-email:subject', '')
  const [points, setPoints] = useLocalStorage('lab:ai-email:points', '確認會議時間\n附上議程草稿\n請對方回覆可行時段')
  const [tone, setTone] = useLocalStorage<Tone>('lab:ai-email:tone', '正式')
  const [out, setOut] = useState('')

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">收件者</label>
          <input className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="王經理" />
          <label className="label">主旨</label>
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="專案進度同步" />
          <label className="label">重點（每行一點）</label>
          <textarea className="field" rows={6} value={points} onChange={(e) => setPoints(e.target.value)} />
          <label className="label">語氣</label>
          <div className="row">
            {(['正式', '友善', '簡潔', '說服'] as Tone[]).map((t) => (
              <button key={t} type="button" className={`btn sm ${tone === t ? 'accent' : 'ghost'}`} onClick={() => setTone(t)}>
                {t}
              </button>
            ))}
          </div>
          <button type="button" className="btn accent" onClick={() => setOut(generate(to, subject, points, tone))}>
            產生郵件
          </button>
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="label">草稿</span>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => copyText(out)}>
              複製
            </button>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => downloadText('email-draft.txt', out)}>
              下載
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {out || '點「產生郵件」後顯示結果'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
