import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('todo-list')!

const TEXT_MAX = 80
const SEARCH_MAX = 80

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
  const [error, setError] = useState('')

  const canAdd = isNonEmpty(text)
  const canSaveEdit = isNonEmpty(editText)

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
    if (!v) {
      setError('請輸入待辦內容')
      return
    }
    setError('')
    setTodos([
      {
        id: uid('todo'),
        text: limitText(v, TEXT_MAX),
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
    if (!v) {
      setError('待辦內容不可空白')
      return
    }
    setError('')
    setTodos(todos.map((t) => (t.id === id ? { ...t, text: limitText(v, TEXT_MAX) } : t)))
    setEditing(null)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="stack" style={{ gap: 4 }}>
          <div className="row">
            <input
              className={`field${error && !canAdd ? ' is-invalid' : ''}`}
              style={{ flex: 1 }}
              placeholder="新增待辦…"
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => {
                setText(limitText(e.target.value, TEXT_MAX))
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && canAdd && add()}
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
            <button className="btn accent" onClick={add} disabled={!canAdd}>
              新增
            </button>
          </div>
          <div className="field-meta">
            <span>{charCount(text)} / {TEXT_MAX}</span>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="row toolbar-row">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : f === 'active' ? '未完成' : '已完成'}
            </button>
          ))}
          <div className="field-wrap" style={{ flex: 1, minWidth: 160, maxWidth: 280 }}>
            <input
              className="field"
              placeholder="搜尋…"
              value={q}
              maxLength={SEARCH_MAX}
              onChange={(e) => setQ(limitText(e.target.value, SEARCH_MAX))}
              aria-label="搜尋待辦"
            />
            <div className="field-meta">
              <span>{charCount(q)} / {SEARCH_MAX}</span>
            </div>
          </div>
          <span className="muted" style={{ marginLeft: 'auto' }}>
            剩餘 {left} · 完成 {doneCount}
          </span>
          <button
            type="button"
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
                  <div className="field-wrap" style={{ flex: 1 }}>
                    <input
                      className={`field${!canSaveEdit ? ' is-invalid' : ''}`}
                      autoFocus
                      value={editText}
                      maxLength={TEXT_MAX}
                      onChange={(e) => setEditText(limitText(e.target.value, TEXT_MAX))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canSaveEdit) saveEdit(t.id)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      onBlur={() => {
                        if (canSaveEdit) saveEdit(t.id)
                      }}
                    />
                    <div className="field-meta">
                      <span>{charCount(editText)} / {TEXT_MAX}</span>
                    </div>
                  </div>
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
