import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick, uid } from '../../lib/utils'

const meta = getProject('realtime-chat')!

type Msg = { id: string; user: string; text: string; at: number }

const bots = ['Alex', 'Sam', 'Riley', 'Jordan']
const phrases = ['收到！', '這個想法不錯', '稍等我看一下', '推到 main 了嗎？', 'LGTM 👍', '今晚可以上線']

export default function Page() {
  const [name, setName] = useLocalStorage('lab:realtime-chat:name', 'You')
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:realtime-chat', [
    { id: '1', user: 'Alex', text: '歡迎來到即時聊天室示範', at: Date.now() - 60000 },
  ])
  const [input, setInput] = useState('')
  const [online, setOnline] = useState(3)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.45) return
      setMsgs((xs) => [...xs, { id: uid('m'), user: pick(bots), text: pick(phrases), at: Date.now() }].slice(-100))
      setOnline(2 + Math.floor(Math.random() * 5))
    }, 4000)
    return () => clearInterval(id)
  }, [setMsgs])

  function send() {
    if (!input.trim()) return
    setMsgs((xs) => [...xs, { id: uid('m'), user: name || 'You', text: input.trim(), at: Date.now() }])
    setInput('')
  }

  return (
    <ProjectShell meta={meta} actions={<span className="tag">{online} online</span>}>
      <div className="panel row" style={{ marginBottom: 8 }}>
        <label className="label">暱稱</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
      <div className="panel stack" style={{ maxHeight: 400, overflow: 'auto' }}>
        {msgs.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.user === name ? 'user' : 'bot'}`}>
            <strong>{m.user}</strong>
            <div>{m.text}</div>
            <span className="muted mono" style={{ fontSize: 11 }}>
              {new Date(m.at).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="field" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="說點什麼…" />
        <button type="button" className="btn accent" onClick={send}>
          送出
        </button>
      </div>
    </ProjectShell>
  )
}
