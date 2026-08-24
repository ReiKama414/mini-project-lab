import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('personal-dashboard')!

type Todo = { id: string; text: string; done: boolean }

export default function Page() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('lab:personal-dashboard:todos', [
    { id: '1', text: '回覆重要郵件', done: false },
    { id: '2', text: '運動 30 分', done: true },
  ])
  const [focus, setFocus] = useLocalStorage('lab:personal-dashboard:focus', '完成側專案首頁')
  const [note, setNote] = useLocalStorage('lab:personal-dashboard:note', '')
  const [now, setNow] = useState(new Date())
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const done = todos.filter((t) => t.done).length

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3">
        <div className="panel metric stack">
          <div className="muted">現在時間</div>
          <div className="mono" style={{ fontSize: 28 }}>
            {now.toLocaleTimeString('zh-TW')}
          </div>
          <div className="muted">{now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="panel stack">
          <div className="label">今日焦點</div>
          <input className="field" value={focus} onChange={(e) => setFocus(e.target.value)} />
          <div className="progress">
            <div style={{ width: `${todos.length ? (done / todos.length) * 100 : 0}%`, height: 8, borderRadius: 4, background: '#22c55e' }} />
          </div>
          <span className="muted">
            待辦進度 {done}/{todos.length}
          </span>
        </div>
        <div className="panel stack">
          <div className="label">快速筆記</div>
          <textarea className="field" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="隨手記…" />
        </div>
      </div>
      <div className="panel stack" style={{ marginTop: 12 }}>
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={draft} placeholder="新增待辦" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && draft.trim() && (setTodos((t) => [...t, { id: uid('t'), text: draft.trim(), done: false }]), setDraft(''))} />
          <button type="button" className="btn accent" onClick={() => draft.trim() && (setTodos((t) => [...t, { id: uid('t'), text: draft.trim(), done: false }]), setDraft(''))}>
            新增
          </button>
        </div>
        <ul className="list">
          {todos.map((t) => (
            <li key={t.id} className="list-item row">
              <label className="row" style={{ flex: 1 }}>
                <input type="checkbox" checked={t.done} onChange={() => setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
                <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
              </label>
              <button type="button" className="btn sm danger" onClick={() => setTodos((xs) => xs.filter((x) => x.id !== t.id))}>
                刪
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
