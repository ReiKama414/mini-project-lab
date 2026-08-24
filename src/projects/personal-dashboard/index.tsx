import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('personal-dashboard')!

type Todo = { id: string; text: string; done: boolean }
type Link = { id: string; label: string; url: string }

export default function Page() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('lab:personal-dashboard:todos', [
    { id: '1', text: '回覆重要郵件', done: false },
    { id: '2', text: '運動 30 分', done: true },
  ])
  const [focus, setFocus] = useLocalStorage('lab:personal-dashboard:focus', '完成側專案首頁')
  const [note, setNote] = useLocalStorage('lab:personal-dashboard:note', '')
  const [links, setLinks] = useLocalStorage<Link[]>('lab:personal-dashboard:links', [
    { id: '1', label: 'GitHub', url: 'https://github.com' },
    { id: '2', label: 'Calendar', url: 'https://calendar.google.com' },
    { id: '3', label: 'Docs', url: 'https://docs.google.com' },
  ])
  const [now, setNow] = useState(new Date())
  const [draft, setDraft] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('https://')
  const [editTodo, setEditTodo] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const done = todos.filter((t) => t.done).length
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0

  function addTodo() {
    if (!draft.trim()) return
    setTodos((t) => [...t, { id: uid('t'), text: draft.trim(), done: false }])
    setDraft('')
  }

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
            <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: '#22c55e' }} />
          </div>
          <span className="muted">
            待辦進度 {done}/{todos.length}（{pct}%）
          </span>
        </div>
        <div className="panel stack">
          <div className="label">快速筆記</div>
          <textarea className="field" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="隨手記…" />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel stack">
          <div className="label">待辦（可編輯）</div>
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              value={draft}
              placeholder="新增待辦"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <button type="button" className="btn accent" onClick={addTodo}>
              新增
            </button>
          </div>
          <ul className="list">
            {todos.map((t) => (
              <li key={t.id} className="list-item row">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                />
                {editTodo === t.id ? (
                  <input
                    className="field"
                    style={{ flex: 1 }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, text: editText.trim() || x.text } : x)))
                        setEditTodo(null)
                      }
                    }}
                  />
                ) : (
                  <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                )}
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    if (editTodo === t.id) {
                      setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, text: editText.trim() || x.text } : x)))
                      setEditTodo(null)
                    } else {
                      setEditTodo(t.id)
                      setEditText(t.text)
                    }
                  }}
                >
                  {editTodo === t.id ? '存' : '編'}
                </button>
                <button type="button" className="btn sm danger" onClick={() => setTodos((xs) => xs.filter((x) => x.id !== t.id))}>
                  刪
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <div className="label">快速連結</div>
          <div className="row">
            <input className="field" placeholder="名稱" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <input className="field" style={{ flex: 1 }} placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (!linkLabel.trim() || !linkUrl.trim()) return
                setLinks((xs) => [...xs, { id: uid('l'), label: linkLabel.trim(), url: linkUrl.trim() }])
                setLinkLabel('')
                setLinkUrl('https://')
              }}
            >
              加
            </button>
          </div>
          <div className="stack">
            {links.map((l) => (
              <div key={l.id} className="row">
                <a className="btn" href={l.url} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                  {l.label}
                </a>
                <button type="button" className="btn sm danger" onClick={() => setLinks((xs) => xs.filter((x) => x.id !== l.id))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
