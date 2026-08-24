import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('todo-list')!

type Priority = 'low' | 'medium' | 'high'
type Todo = {
  id: string
  text: string
  done: boolean
  priority: Priority
  due?: string
  createdAt: number
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export default function Page() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('lab:todo-list', [])
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const visible = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 }
    return todos
      .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
      .filter((t) => !q.trim() || t.text.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority]
        return (a.due || '9999').localeCompare(b.due || '9999')
      })
  }, [todos, filter, q])

  const left = todos.filter((t) => !t.done).length
  const doneCount = todos.filter((t) => t.done).length

  function add() {
    const v = text.trim()
    if (!v) return
    setTodos([
      {
        id: uid('todo'),
        text: v,
        done: false,
        priority,
        due: due || undefined,
        createdAt: Date.now(),
      },
      ...todos,
    ])
    setText('')
    setDue('')
  }

  function saveEdit(id: string) {
    const v = editText.trim()
    if (!v) return
    setTodos(todos.map((t) => (t.id === id ? { ...t, text: v } : t)))
    setEditing(null)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="新增待辦…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="field"
            style={{ width: 90 }}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="high">高優先</option>
            <option value="medium">中優先</option>
            <option value="low">低優先</option>
          </select>
          <input
            className="field"
            type="date"
            style={{ width: 150 }}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button className="btn accent" onClick={add}>
            新增
          </button>
        </div>

        <div className="row">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'active' ? '未完成' : '已完成'}
            </button>
          ))}
          <input
            className="field"
            style={{ flex: 1, maxWidth: 220 }}
            placeholder="搜尋…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="muted" style={{ marginLeft: 'auto' }}>
            剩餘 {left} · 完成 {doneCount}
          </span>
          <button
            className="btn ghost sm"
            onClick={() => setTodos(todos.filter((t) => !t.done))}
            disabled={!doneCount}
          >
            清除已完成
          </button>
        </div>

        <ul className="list">
          {visible.map((t) => {
            const overdue = !t.done && t.due && t.due < new Date().toISOString().slice(0, 10)
            return (
              <li key={t.id} className={`list-item ${t.done ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() =>
                    setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                  }
                />
                <span
                  className="tag"
                  style={{
                    background:
                      t.priority === 'high'
                        ? 'var(--rose-soft)'
                        : t.priority === 'medium'
                          ? 'var(--amber-soft)'
                          : 'var(--teal-soft)',
                  }}
                >
                  {PRIORITY_LABEL[t.priority]}
                </span>
                {editing === t.id ? (
                  <input
                    className="field"
                    style={{ flex: 1 }}
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(t.id)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    onBlur={() => saveEdit(t.id)}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{
                      flex: 1,
                      justifyContent: 'flex-start',
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 400,
                    }}
                    onDoubleClick={() => {
                      setEditing(t.id)
                      setEditText(t.text)
                    }}
                    title="雙擊編輯"
                  >
                    {t.text}
                  </button>
                )}
                {t.due && (
                  <span className="muted" style={{ fontSize: 12, color: overdue ? 'var(--rose)' : undefined }}>
                    {overdue ? '逾期 ' : ''}
                    {t.due}
                  </span>
                )}
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setEditing(t.id)
                    setEditText(t.text)
                  }}
                >
                  編輯
                </button>
                <button
                  className="btn ghost sm"
                  onClick={() => setTodos(todos.filter((x) => x.id !== t.id))}
                >
                  刪除
                </button>
              </li>
            )
          })}
          {!visible.length && <p className="muted">尚無符合的待辦</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
