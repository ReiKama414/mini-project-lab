import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-chat-ui')!

const PROMPT_MAX = 2000
const INPUT_MAX = 4000

type Msg = { id: string; role: 'user' | 'bot' | 'system'; text: string; at: number }

const PRESETS: { id: string; label: string; prompt: string }[] = [
  { id: 'default', label: '一般助理', prompt: '你是務實、簡潔的中文助理，用條列與步驟回答。' },
  { id: 'code', label: '程式教練', prompt: '你是資深工程師，優先給可執行程式與簡潔解釋，標註語言。' },
  { id: 'writer', label: '寫作顧問', prompt: '你是編輯，著重結構、語氣與可讀性，必要時改寫範例。' },
  { id: 'tutor', label: '學習導師', prompt: '你是耐心導師，用類比與小測驗確認理解。' },
]

function intentReply(input: string, system: string): string {
  const lower = input.toLowerCase()
  const sysHint = system.includes('工程') || system.includes('程式') ? 'code' : system.includes('編輯') ? 'writer' : 'default'

  if (/你好|嗨|hello|hi\b/.test(lower)) return '你好！我是本機示範助理。可試：寫 code、幫我摘要、翻譯成英文、列待辦。'
  if (/謝謝|感謝/.test(lower)) return '不客氣！需要再改寫、拆步驟或重新產生上一則都可以。'

  if (/code|程式|寫個|實作|function|typescript|python|bug/.test(lower) || sysHint === 'code') {
    const topic = input.replace(/.*(寫|實作|code)\s*/i, '').trim() || '範例函式'
    return [
      `依「程式」意圖整理（示範）：`,
      ``,
      '```ts',
      `// ${topic.slice(0, 40)}`,
      'export function run(input: string): string {',
      "  if (!input.trim()) throw new Error('empty')",
      '  return input.trim()',
      '}',
      '```',
      ``,
      '下一步：補上單元測試與錯誤處理。',
    ].join('\n')
  }

  if (/摘要|總結|summarize|重點/.test(lower)) {
    const body = input.replace(/.*(摘要|總結|summarize|重點)[:：\s]*/i, '').trim() || input
    const parts = body.split(/[。！？\n.!?]/).map((s) => s.trim()).filter((s) => s.length > 4).slice(0, 5)
    return ['【摘要】', ...parts.map((p, i) => `${i + 1}. ${p}`), '', '一句話：先抓結論，再補細節。'].join('\n')
  }

  if (/翻譯|translate|英文|中文/.test(lower)) {
    const raw = input.replace(/.*(翻譯|translate|成英文|成中文)[:：\s]*/i, '').trim() || input
    const toEn = /英文|english|en\b/i.test(input)
    if (toEn) {
      return `【EN】\n${raw}\n→ Here's a concise English version: "${raw.slice(0, 80)}" (demo paraphrase). Please review tone for your audience.`
    }
    return `【ZH】\n${raw}\n→ 中文大意：${raw}（示範改寫，實務請再潤飾）。`
  }

  if (/todo|待辦|清單|checklist|步驟/.test(lower)) {
    const topic = input.replace(/.*(todo|待辦|清單|步驟)[:：\s]*/i, '').trim() || '本任務'
    return [
      `【待辦 · ${topic.slice(0, 30)}】`,
      '☐ 釐清完成定義與截止日',
      '☐ 拆成 3 個可驗證小步驟',
      '☐ 先做風險最高的一項',
      '☐ 設檢查點並寫下結果',
      '☐ 回顧：留下可重用筆記',
    ].join('\n')
  }

  if (/計畫|plan|規劃/.test(lower)) {
    return '規劃建議：1) 定義成果 2) 列出任務 3) 估時排序 4) 每日複盤。把主題再說清楚一點，我可以展開週計畫。'
  }

  const tips = [
    '建議先寫最短可行方案（MVP），再擴充細節。',
    '用「問題 → 假設 → 驗證」推進，避免一次做太大。',
    '把時程與風險寫清楚，之後回顧會容易很多。',
  ]
  const tip = tips[Math.floor(Math.random() * tips.length)]!
  return `好的，針對「${input.slice(0, 48)}${input.length > 48 ? '…' : ''}」：\n\n• ${tip}\n• 若要更具體，告訴我預算、期限與成功指標。\n\n（系統：${PRESETS.find((p) => p.prompt === system)?.label || '自訂'}）`
}

async function typeOut(
  full: string,
  onTick: (partial: string) => void,
  signal: { cancelled: boolean },
) {
  let out = ''
  for (const ch of full) {
    if (signal.cancelled) return
    out += ch
    onTick(out)
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 18))
  }
}

export default function Page() {
  const [presetId, setPresetId] = useLocalStorage('lab:ai-chat-ui:preset', 'default')
  const [customPrompt, setCustomPrompt] = useLocalStorage(
    'lab:ai-chat-ui:prompt',
    PRESETS[0]!.prompt,
  )
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:ai-chat-ui', [
    { id: uid('m'), role: 'bot', text: '嗨！選左側系統提示後直接提問。支援：程式、摘要、翻譯、待辦。', at: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef({ cancelled: false })

  const system = PRESETS.find((p) => p.id === presetId)?.prompt || customPrompt

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy, streaming])

  const applyPreset = (id: string) => {
    setPresetId(id)
    const p = PRESETS.find((x) => x.id === id)
    if (p) setCustomPrompt(p.prompt)
  }

  const runBot = useCallback(
    async (userText: string, replaceLastBot?: boolean) => {
      cancelRef.current.cancelled = true
      cancelRef.current = { cancelled: false }
      setBusy(true)
      setStreaming('')
      await new Promise((r) => setTimeout(r, 200))
      const full = intentReply(userText, system)
      await typeOut(full, setStreaming, cancelRef.current)
      if (cancelRef.current.cancelled) {
        setBusy(false)
        setStreaming('')
        return
      }
      setMsgs((m) => {
        const next = [...m]
        if (replaceLastBot) {
          const lastBot = [...next].reverse().findIndex((x) => x.role === 'bot')
          if (lastBot >= 0) {
            const idx = next.length - 1 - lastBot
            next[idx] = { ...next[idx]!, text: full, at: Date.now() }
            return next
          }
        }
        return [...next, { id: uid('m'), role: 'bot', text: full, at: Date.now() }]
      })
      setStreaming('')
      setBusy(false)
    },
    [system, setMsgs],
  )

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMsgs((m) => [...m, { id: uid('m'), role: 'user', text, at: Date.now() }])
    await runBot(text)
  }

  async function regenerate() {
    if (busy) return
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    await runBot(lastUser.text, true)
  }

  function exportChat() {
    const lines = msgs
      .filter((m) => m.role !== 'system')
      .map((m) => `[${new Date(m.at).toLocaleString('zh-TW')}] ${m.role === 'user' ? '你' : '助理'}：\n${m.text}`)
    const body = [`系統提示：${system}`, '', ...lines].join('\n\n')
    downloadText('chat-export.md', body, 'text/markdown;charset=utf-8')
  }

  function clearChat() {
    cancelRef.current.cancelled = true
    setBusy(false)
    setStreaming('')
    setMsgs([{ id: uid('m'), role: 'bot', text: '對話已清空。有什麼可以幫忙？', at: Date.now() }])
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={exportChat} disabled={!msgs.length}>
            匯出對話
          </button>
          <button type="button" className="btn ghost sm" onClick={() => copyText(msgs.map((m) => m.text).join('\n\n'))}>
            複製
          </button>
          <button type="button" className="btn ghost sm" onClick={clearChat}>
            清空
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">系統提示預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn sm ${presetId === p.id ? 'accent' : 'ghost'}`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="label">自訂提示</label>
          <textarea className="field" rows={4} value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
          <p className="muted" style={{ margin: 0 }}>
            意圖關鍵字：code／摘要／翻譯／待辦
          </p>
        </div>
        <div className="stack">
          <div className="panel stack" style={{ maxHeight: 420, overflow: 'auto' }}>
            {msgs.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.role === 'user' ? 'user' : 'bot'}`}>
                {m.text}
              </div>
            ))}
            {busy && streaming && <div className="chat-bubble bot">{streaming}</div>}
            {busy && !streaming && <div className="chat-bubble bot muted">思考中…</div>}
            <div ref={endRef} />
          </div>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              value={input}
              placeholder="輸入訊息…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={busy}
            />
            <button type="button" className="btn accent" onClick={send} disabled={busy}>
              送出
            </button>
            <button type="button" className="btn ghost" onClick={regenerate} disabled={busy || !msgs.some((m) => m.role === 'user')}>
              重新產生
            </button>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
