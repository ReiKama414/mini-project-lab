import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick, uid } from '../../lib/utils'

const meta = getProject('realtime-chat')!

type Msg = { id: string; room: string; user: string; text: string; at: number }
type Room = { id: string; name: string }

const bots = ['Alex', 'Sam', 'Riley', 'Jordan', 'Casey']
const phrases = ['收到！', '這個想法不錯', '稍等我看一下', '推到 main 了嗎？', 'LGTM', '今晚可以上線', '有 PR 了嗎？']

export default function Page() {
  const [name, setName] = useLocalStorage('lab:realtime-chat:name', 'You')
  const [rooms, setRooms] = useLocalStorage<Room[]>('lab:realtime-chat:rooms', [
    { id: 'general', name: 'general' },
    { id: 'random', name: 'random' },
    { id: 'dev', name: 'dev' },
  ])
  const [roomId, setRoomId] = useLocalStorage('lab:realtime-chat:room', 'general')
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:realtime-chat', [
    { id: '1', room: 'general', user: 'Alex', text: '歡迎來到即時聊天室示範', at: Date.now() - 60000 },
  ])
  const [input, setInput] = useState('')
  const [presence, setPresence] = useState<string[]>(['Alex', 'Sam', 'Riley'])
  const [typing, setTyping] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const roomMsgs = useMemo(() => msgs.filter((m) => m.room === roomId), [msgs, roomId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomMsgs, typing])

  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() > 0.5) {
        const who = pick(bots)
        setTyping(who)
        setTimeout(() => setTyping(null), 1200)
        return
      }
      setMsgs((xs) =>
        [
          ...xs,
          { id: uid('m'), room: roomId, user: pick(bots), text: pick(phrases), at: Date.now() },
        ].slice(-200),
      )
      const count = 2 + Math.floor(Math.random() * 4)
      setPresence(bots.slice(0, count))
    }, 3500)
    return () => clearInterval(id)
  }, [roomId, setMsgs])

  function send() {
    if (!input.trim()) return
    setMsgs((xs) => [...xs, { id: uid('m'), room: roomId, user: name || 'You', text: input.trim(), at: Date.now() }].slice(-200))
    setInput('')
  }

  function addRoom() {
    const n = newRoom.trim().toLowerCase().replace(/\s+/g, '-')
    if (!n || rooms.some((r) => r.id === n)) return
    setRooms((xs) => [...xs, { id: n, name: n }])
    setRoomId(n)
    setNewRoom('')
  }

  return (
    <ProjectShell meta={meta}>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px', gap: 12, minHeight: 440 }}>
        <aside className="panel stack">
          <strong>Rooms</strong>
          {rooms.map((r) => (
            <button key={r.id} type="button" className={`btn ${roomId === r.id ? 'accent' : 'ghost'}`} onClick={() => setRoomId(r.id)}>
              #{r.name}
            </button>
          ))}
          <input className="field" placeholder="新房間" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
          <button type="button" className="btn sm teal" onClick={addRoom}>
            建立
          </button>
        </aside>

        <section className="panel stack" style={{ minHeight: 0 }}>
          <div className="row">
            <label className="label" style={{ margin: 0 }}>
              暱稱
            </label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 160 }} />
            <span className="tag">#{roomId}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', maxHeight: 360 }}>
            {roomMsgs.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.user === name ? 'user' : 'bot'}`} style={{ marginBottom: 8 }}>
                <strong>{m.user}</strong>
                <div>{m.text}</div>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  {new Date(m.at).toLocaleTimeString('zh-TW')}
                </span>
              </div>
            ))}
            {typing && <div className="muted" style={{ fontSize: 13 }}>{typing} 正在輸入…</div>}
            <div ref={endRef} />
          </div>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="說點什麼…"
            />
            <button type="button" className="btn accent" onClick={send}>
              送出
            </button>
          </div>
        </section>

        <aside className="panel stack">
          <strong>在線</strong>
          <div className="tag">{presence.length + 1} online</div>
          <ul className="list">
            <li className="list-item">{name || 'You'} (你)</li>
            {presence.map((p) => (
              <li key={p} className="list-item">
                {p}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </ProjectShell>
  )
}
