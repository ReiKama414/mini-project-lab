import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('anonymous-feedback')!

type Item = { id: string; text: string; mood: '😊' | '😐' | '😞'; at: number }

export default function Page() {
  const [items, setItems] = useLocalStorage<Item[]>('lab:anonymous-feedback', [
    { id: '1', text: '文件可以再清楚一點', mood: '😐', at: Date.now() - 86400000 },
    { id: '2', text: '新版 UI 很好用！', mood: '😊', at: Date.now() - 3600000 },
  ])
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Item['mood']>('😐')
  const [boardName, setBoardName] = useLocalStorage('lab:anonymous-feedback:board', '產品回饋板')

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <input className="field" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
        <textarea className="field" rows={3} placeholder="匿名留下想法…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          {(['😊', '😐', '😞'] as const).map((m) => (
            <button key={m} type="button" className={`btn sm ${mood === m ? 'accent' : 'ghost'}`} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!text.trim()) return
              setItems((xs) => [{ id: uid('fb'), text: text.trim(), mood, at: Date.now() }, ...xs])
              setText('')
            }}
          >
            匿名送出
          </button>
        </div>
      </div>
      <div className="grid-3">
        {items.map((it) => (
          <div key={it.id} className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 22 }}>{it.mood}</span>
              <button type="button" className="btn sm danger" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                刪
              </button>
            </div>
            <p style={{ margin: 0 }}>{it.text}</p>
            <span className="muted mono">{new Date(it.at).toLocaleString('zh-TW')}</span>
          </div>
        ))}
      </div>
    </ProjectShell>
  )
}
