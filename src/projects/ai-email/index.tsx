import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-email')!

const TO_MAX = 120
const CC_MAX = 200
const SUBJECT_MAX = 200
const POINTS_MAX = 5000

type Tone = '正式' | '友善' | '簡潔' | '說服'
type Length = '短' | '中' | '長'
type Lang = 'ZH' | 'EN'

function bulletsOf(points: string) {
  return points
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function generate(
  to: string,
  cc: string,
  subject: string,
  points: string,
  tone: Tone,
  length: Length,
  lang: Lang,
  variant: number,
): string {
  const bullets = bulletsOf(points)
  const who = to || (lang === 'EN' ? 'there' : '收件者')
  const subj = subject || (lang === 'EN' ? '(No subject)' : '（未填主旨）')
  const ccLine = cc.trim() ? (lang === 'EN' ? `Cc: ${cc.trim()}\n` : `副本：${cc.trim()}\n`) : ''

  const openZH =
    tone === '正式'
      ? `親愛的 ${who}：`
      : tone === '友善'
        ? `嗨 ${who}，`
        : tone === '簡潔'
          ? `${who}，`
          : `Hi ${who}，`
  const openEN =
    tone === '正式'
      ? `Dear ${who},`
      : tone === '友善'
        ? `Hi ${who},`
        : tone === '簡潔'
          ? `${who},`
          : `Hello ${who},`

  const expand =
    length === '短'
      ? 0
      : length === '中'
        ? 1
        : 2

  const angle = [
    lang === 'ZH' ? '以下整理重點供您參考。' : 'Here are the key points for your review.',
    lang === 'ZH' ? '希望能儘快對齊下一步行動。' : 'I hope we can align on next steps soon.',
    lang === 'ZH' ? '若時程允許，想邀請您給一點回饋。' : 'If timing allows, I would appreciate your feedback.',
  ][variant % 3]!

  let body: string
  if (lang === 'EN') {
    if (tone === '簡潔') {
      body = bullets.map((b) => `• ${b}`).join('\n') || '• (please add points)'
    } else if (tone === '說服') {
      body = [
        'I wanted to share a proposal with a clear outcome.',
        '',
        bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') || '1. (add benefits)',
        '',
        'Would a 15-minute chat this week work?',
      ].join('\n')
    } else {
      body = [`Regarding "${subj}", a quick summary:`, '', ...bullets.map((b) => `- ${b}`), '', angle].join('\n')
    }
    if (expand >= 1) body += `\n\nContext: we are prioritizing clarity and a measurable next step.`
    if (expand >= 2) body += `\n\nRisks / notes: please flag blockers early so we can adjust scope.`
  } else {
    if (tone === '簡潔') {
      body = bullets.map((b) => `• ${b}`).join('\n') || '• （請補充重點）'
    } else if (tone === '說服') {
      body = [
        '我想與您分享一個能帶來明確成果的提案。',
        '',
        bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') || '1. （請補充賣點）',
        '',
        '若方便，希望本週能安排 15 分鐘快速討論。',
      ].join('\n')
    } else {
      body = [`關於「${subj}」，整理如下：`, '', ...bullets.map((b) => `- ${b}`), '', angle].join('\n')
    }
    if (expand >= 1) body += `\n\n補充：目前優先確保對齊與可追蹤的下一步。`
    if (expand >= 2) body += `\n\n風險／備註：若有阻塞請儘早告知，我們可調整範圍。`
  }

  const closeZH = tone === '正式' ? '此致\n敬礼' : tone === '友善' ? '謝謝你！\n祝好' : '謝謝'
  const closeEN = tone === '正式' ? 'Best regards,' : tone === '友善' ? 'Thanks!\nCheers,' : 'Thanks,'

  const header =
    lang === 'EN'
      ? `Subject: ${subj}\nTo: ${to || '(recipient)'}\n${ccLine}`
      : `主旨：${subj}\n收件：${to || '（收件者）'}\n${ccLine}`

  return `${header}\n${lang === 'EN' ? openEN : openZH}\n\n${body}\n\n${lang === 'EN' ? closeEN : closeZH}`
}

export default function Page() {
  const [to, setTo] = useLocalStorage('lab:ai-email:to', '')
  const [cc, setCc] = useLocalStorage('lab:ai-email:cc', '')
  const [subject, setSubject] = useLocalStorage('lab:ai-email:subject', '')
  const [points, setPoints] = useLocalStorage(
    'lab:ai-email:points',
    '確認會議時間\n附上議程草稿\n請對方回覆可行時段',
  )
  const [tone, setTone] = useLocalStorage<Tone>('lab:ai-email:tone', '正式')
  const [length, setLength] = useLocalStorage<Length>('lab:ai-email:length', '中')
  const [lang, setLang] = useLocalStorage<Lang>('lab:ai-email:lang', 'ZH')
  const [drafts, setDrafts] = useState<string[]>([])
  const [picked, setPicked] = useState(0)

  function regen() {
    if (!isNonEmpty(points)) return
    const next = [0, 1, 2].map((v) =>
      generate(
        limitText(to, TO_MAX),
        limitText(cc, CC_MAX),
        limitText(subject, SUBJECT_MAX),
        limitText(points, POINTS_MAX),
        tone,
        length,
        lang,
        v,
      ),
    )
    setDrafts(next)
    setPicked(0)
  }

  const out = drafts[picked] || ''
  const canGenerate = isNonEmpty(points)

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        本機規則／模板示範，非雲端 LLM
      </p>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">收件者</label>
          <input
            className="field"
            maxLength={TO_MAX}
            value={to}
            onChange={(e) => setTo(limitText(e.target.value, TO_MAX))}
            placeholder="王經理"
          />
          <div className="field-meta">
            <span className="field-hint">顯示名稱或信箱</span>
            <span>{charCount(to)}/{TO_MAX}</span>
          </div>
          <label className="label">副本 CC（選填）</label>
          <input
            className="field"
            maxLength={CC_MAX}
            value={cc}
            onChange={(e) => setCc(limitText(e.target.value, CC_MAX))}
            placeholder="pm@example.com — 副本對象會出現在信頭"
          />
          <div className="field-meta">
            <span className="field-hint">選填</span>
            <span>{charCount(cc)}/{CC_MAX}</span>
          </div>
          <label className="label">主旨</label>
          <input
            className="field"
            maxLength={SUBJECT_MAX}
            value={subject}
            onChange={(e) => setSubject(limitText(e.target.value, SUBJECT_MAX))}
            placeholder="專案進度同步"
          />
          <div className="field-meta">
            <span className="field-hint">建議簡潔明確</span>
            <span>{charCount(subject)}/{SUBJECT_MAX}</span>
          </div>
          <label className="label">重點（每行一點）</label>
          <textarea
            className={cn('field', !canGenerate && 'is-invalid')}
            rows={6}
            maxLength={POINTS_MAX}
            value={points}
            onChange={(e) => setPoints(limitText(e.target.value, POINTS_MAX))}
          />
          <div className="field-meta">
            <span className={!canGenerate ? 'warn' : undefined}>{canGenerate ? '可產生' : '請輸入至少一點重點'}</span>
            <span>{charCount(points)}/{POINTS_MAX}</span>
          </div>
          {!canGenerate && <p className="field-error">重點不可空白</p>}
          <label className="label">語氣</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['正式', '友善', '簡潔', '說服'] as Tone[]).map((t) => (
              <button key={t} type="button" className={`btn sm ${tone === t ? 'accent' : 'ghost'}`} onClick={() => setTone(t)}>
                {t}
              </button>
            ))}
          </div>
          <label className="label">長度</label>
          <div className="row">
            {(['短', '中', '長'] as Length[]).map((l) => (
              <button key={l} type="button" className={`btn sm ${length === l ? 'accent' : 'ghost'}`} onClick={() => setLength(l)}>
                {l}
              </button>
            ))}
          </div>
          <label className="label">語言</label>
          <div className="row">
            {(['ZH', 'EN'] as Lang[]).map((l) => (
              <button key={l} type="button" className={`btn sm ${lang === l ? 'accent' : 'ghost'}`} onClick={() => setLang(l)}>
                {l === 'ZH' ? '中文' : 'English'}
              </button>
            ))}
          </div>
          <button type="button" className="btn accent" onClick={regen} disabled={!canGenerate}>
            產生 3 個變體
          </button>
        </div>
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="label">草稿</span>
            {drafts.length > 0 &&
              drafts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn sm ${picked === i ? 'accent' : 'ghost'}`}
                  onClick={() => setPicked(i)}
                >
                  變體 {i + 1}
                </button>
              ))}
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => copyText(out)}>
              複製
            </button>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => downloadText('email-draft.txt', out)}>
              下載
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {out || '點「產生 3 個變體」後選擇草稿'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
