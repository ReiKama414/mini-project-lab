import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, pick, uid } from '../../lib/utils'

const meta = getProject('realtime-chat')!

type Msg = { id: string; room: string; user: string; text: string; at: number }
type Room = { id: string; name: string }

const bots = ['Alex', 'Sam', 'Riley', 'Jordan', 'Casey', 'Mina', '浩宇']
const phrases = [
  '收到！',
  '這個想法不錯',
  '稍等我看一下',
  '推到 main 了嗎？',
  'LGTM',
  '今晚可以上線',
  '有 PR 了嗎？',
  '我先開個 issue',
  '截圖放一下？',
  'OK，我跟進',
]

function formatTime(at: number) {
  return new Date(at).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function transcriptOf(msgs: Msg[], roomName: string) {
  const lines = [
    `# 聊天紀錄 · #${roomName}`,
    `匯出時間：${new Date().toLocaleString('zh-TW')}`,
    '',
    ...msgs.map((m) => `[${formatTime(m.at)}] ${m.user}: ${m.text}`),
  ]
  return lines.join('\n')
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:realtime-chat:name', '你')
  const [rooms, setRooms] = useLocalStorage<Room[]>('lab:realtime-chat:rooms', [
    { id: 'general', name: 'general' },
    { id: 'random', name: 'random' },
    { id: 'dev', name: 'dev' },
  ])
  const [roomId, setRoomId] = useLocalStorage('lab:realtime-chat:room', 'general')
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:realtime-chat:msgs', [
    { id: '1', room: 'general', user: 'Alex', text: '歡迎來到多房間即時聊天示範', at: Date.now() - 120000 },
    { id: '2', room: 'general', user: 'Sam', text: '訊息會存在本機，可匯出紀錄', at: Date.now() - 90000 },
    { id: '3', room: 'dev', user: 'Riley', text: '這裡是 #dev 頻道', at: Date.now() - 60000 },
  ])
  const [input, setInput] = useState('')
  const [presence, setPresence] = useState<string[]>(['Alex', 'Sam', 'Riley'])
  const [typing, setTyping] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState('')
  const [botOn, setBotOn] = useLocalStorage('lab:realtime-chat:bot', true)
  const endRef = useRef<HTMLDivElement>(null)

  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]
  const roomMsgs = useMemo(() => msgs.filter((m) => m.room === roomId), [msgs, roomId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [roomMsgs, typing])

  useEffect(() => {
    if (!botOn) return
    const id = setInterval(() => {
      if (Math.random() > 0.45) {
        const who = pick(bots)
        setTyping(who)
        window.setTimeout(() => setTyping(null), 1200)
        return
      }
      setMsgs((xs) =>
        [
          ...xs,
          { id: uid('m'), room: roomId, user: pick(bots), text: pick(phrases), at: Date.now() },
        ].slice(-300),
      )
      const count = 2 + Math.floor(Math.random() * 5)
      setPresence([...bots].sort(() => Math.random() - 0.5).slice(0, count))
    }, 3500)
    return () => clearInterval(id)
  }, [roomId, setMsgs, botOn])

  function send() {
    if (!input.trim()) return
    setMsgs((xs) =>
      [...xs, { id: uid('m'), room: roomId, user: name || '你', text: input.trim(), at: Date.now() }].slice(-300),
    )
    setInput('')
  }

  function addRoom() {
    const n = newRoom.trim().toLowerCase().replace(/\s+/g, '-')
    if (!n || rooms.some((r) => r.id === n)) return
    setRooms((xs) => [...xs, { id: n, name: n }])
    setRoomId(n)
    setNewRoom('')
  }

  function clearRoom() {
    setMsgs((xs) => xs.filter((m) => m.room !== roomId))
  }

  function clearAll() {
    setMsgs([])
  }

  function exportRoom() {
    const text = transcriptOf(roomMsgs, room?.name ?? roomId)
    downloadText(`chat-${roomId}.txt`, text)
  }

  function exportAll() {
    const byRoom = rooms
      .map((r) => {
        const list = msgs.filter((m) => m.room === r.id)
        if (!list.length) return ''
        return transcriptOf(list, r.name)
      })
      .filter(Boolean)
      .join('\n\n---\n\n')
    downloadText('chat-all.txt', byRoom || '（尚無訊息）')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn ghost sm" onClick={exportRoom} disabled={!roomMsgs.length}>
            匯出本房
          </button>
          <button type="button" className="btn ghost sm" onClick={exportAll} disabled={!msgs.length}>
            匯出全部
          </button>
        </div>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, 180px) 1fr minmax(120px, 160px)',
          gap: 12,
          minHeight: 440,
        }}
      >
        <aside className="panel stack">
          <strong>房間</strong>
          {rooms.map((r) => {
            const count = msgs.filter((m) => m.room === r.id).length
            return (
              <button
                key={r.id}
                type="button"
                className={`btn ${roomId === r.id ? 'accent' : 'ghost'}`}
                onClick={() => setRoomId(r.id)}
              >
                #{r.name}
                <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
                  {count}
                </span>
              </button>
            )
          })}
          <input
            className="field"
            placeholder="新房間"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoom()}
          />
          <button type="button" className="btn sm teal" onClick={addRoom}>
            建立
          </button>
        </aside>

        <section className="panel stack" style={{ minHeight: 0 }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="label" style={{ margin: 0 }}>
              暱稱
            </label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 140 }} />
            <span className="tag">#{room?.name ?? roomId}</span>
            <button type="button" className={`btn sm ${botOn ? 'teal' : 'ghost'}`} onClick={() => setBotOn((v) => !v)}>
              {botOn ? '模擬在線 ON' : '模擬在線 OFF'}
            </button>
            <button type="button" className="btn sm ghost" onClick={clearRoom} disabled={!roomMsgs.length}>
              清空本房
            </button>
            <button type="button" className="btn sm ghost" onClick={clearAll} disabled={!msgs.length}>
              清空全部
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', maxHeight: 360 }}>
            {roomMsgs.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble ${m.user === name ? 'user' : 'bot'}`}
                style={{ marginBottom: 8 }}
              >
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <strong>{m.user}</strong>
                  <span className="muted mono" style={{ fontSize: 11 }}>
                    {formatTime(m.at)}
                  </span>
                </div>
                <div>{m.text}</div>
              </div>
            ))}
            {!roomMsgs.length && (
              <p className="muted" style={{ fontSize: 13 }}>
                這個房間還沒有訊息。打個招呼，或開啟「模擬在線」讓 bot 加入對話。
              </p>
            )}
            {typing && (
              <div className="muted" style={{ fontSize: 13 }}>
                {typing} 正在輸入…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="說點什麼…（Enter 送出）"
            />
            <button type="button" className="btn accent" onClick={send}>
              送出
            </button>
          </div>
        </section>

        <aside className="panel stack">
          <strong>在線</strong>
          <div className="tag">{presence.length + 1} 人</div>
          <ul className="list">
            <li className="list-item">
              <span style={{ flex: 1 }}>{name || '你'}</span>
              <span className="muted" style={{ fontSize: 11 }}>
                你
              </span>
            </li>
            {presence.map((p) => (
              <li key={p} className="list-item">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--teal, #0d9488)',
                    display: 'inline-block',
                    marginRight: 6,
                  }}
                />
                {p}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 11 }}>
            本機模擬多房間聊天：presence、輸入中狀態與匯出紀錄。
          </p>
        </aside>
      </div>
    </ProjectShell>
  )
}
