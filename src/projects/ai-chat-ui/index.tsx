import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, pick, uid } from '../../lib/utils'

const meta = getProject('ai-chat-ui')!

type Msg = { id: string; role: 'user' | 'bot'; text: string; at: number }

const PRESETS = [
  { id: 'coach', label: '教練', system: '你是務實的產品教練，回覆要有步驟。' },
  { id: 'writer', label: '寫手', system: '你是文案寫手，重視清晰與節奏。' },
  { id: 'dev', label: '工程', system: '你是資深工程師，回覆簡潔並給範例。' },
]

function botReply(input: string, system: string): string {
  const t = input.trim()
  const lower = t.toLowerCase()
  if (/翻譯|translate/.test(lower)) {
    if (/[\u4e00-\u9fff]/.test(t)) {
      return `（英譯示範）\n${t.replace(/請幫我翻譯[:：]?/, '').trim() || t}\n→ Please review this draft and share feedback by Friday.`
    }
    return `（中譯示範）\n${t}\n→ 請在週五前審閱這份草稿並提供回饋。`
  }
  if (/摘要|總結|summar/.test(lower)) {
    const body = t.replace(/.*(摘要|總結|summarize)[:：]?\s*/i, '')
    const lines = body.split(/[。.!?\n]/).map((s) => s.trim()).filter((s) => s.length > 4).slice(0, 3)
    return `摘要：\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n') || '（請貼上要摘要的內容）'}`
  }
  if (/待辦|todo|任務/.test(lower)) {
    return `待辦拆解：\n1. 定義完成標準\n2. 列出阻礙與依賴\n3. 估時並排優先序\n4. 設定檢查點\n\n（依「${system.slice(0, 12)}…」風格）`
  }
  if (/code|程式|寫個|function/.test(lower)) {
    return `範例程式（示範）：\n\`\`\`ts\nexport function demo(input: string) {\n  return input.trim().split(/\\s+/).filter(Boolean)\n}\n\`\`\`\n可再告訴我語言與輸入輸出，我幫你改。`
  }
  if (/你好|嗨|hello|hi/.test(lower)) return `你好！目前模式：${PRESETS.find((p) => system.includes(p.system.slice(0, 6)))?.label || '助理'}。想討論什麼？`
  return pick([
    `依你的描述，建議先做最小可行版本，再迭代。下一步：寫下成功指標。`,
    `可以拆成「現況／目標／差距／行動」。你目前卡在哪一段？`,
    `我聽到的重點是：${t.slice(0, 40)}${t.length > 40 ? '…' : ''}。若要更精準，補上期限與限制條件。`,
  ])
}

export default function Page() {
  const [preset, setPreset] = useLocalStorage('lab:ai-chat-ui:preset', 'coach')
  const system = PRESETS.find((p) => p.id === preset)?.system || PRESETS[0]!.system
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:ai-chat-ui:msgs', [
    { id: uid('m'), role: 'bot', text: '嗨！選左側角色後直接輸入。支援：翻譯、摘要、待辦、程式。', at: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    setMsgs((m) => [...m, { id: uid('m'), role: 'user', text: content, at: Date.now() }])
    setBusy(true)
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 500))
    setMsgs((m) => [...m, { id: uid('m'), role: 'bot', text: botReply(content, system), at: Date.now() }])
    setBusy(false)
  }

  function regenerate() {
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    setMsgs((m) => {
      const copy = [...m]
      if (copy[copy.length - 1]?.role === 'bot') copy.pop()
      return copy
    })
    void send(lastUser.text)
  }

  const exportText = msgs.map((m) => `${m.role === 'user' ? '你' : 'AI'}: ${m.text}`).join('\n\n')

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => void copyText(exportText)}>
            複製對話
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => downloadText('chat.txt', exportText)}
          >
            匯出
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn sm ${preset === p.id ? 'accent' : 'ghost'}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="btn ghost sm" onClick={regenerate} disabled={busy}>
          重新產生上一則
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() =>
            setMsgs([
              { id: uid('m'), role: 'bot', text: '對話已清空。', at: Date.now() },
            ])
          }
        >
          清空
        </button>
      </div>
      <div className="panel stack" style={{ maxHeight: 420, overflow: 'auto' }}>
        {msgs.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="chat-bubble bot muted">輸入中…</div>}
        <div ref={endRef} />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="field"
          style={{ flex: 1 }}
          value={input}
          placeholder="輸入訊息…（試試：請摘要下列文字）"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
        />
        <button type="button" className="btn accent" onClick={() => void send()} disabled={busy}>
          送出
        </button>
      </div>
    </ProjectShell>
  )
}
