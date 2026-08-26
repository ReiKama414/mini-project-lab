import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { IconCalendar } from '../../components/icons'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('todo-list')!

const TEXT_MAX = 80
const SEARCH_MAX = 80

type Priority = 1 | 2 | 3 | 4 | 5
type Todo = {
  id: string
  text: string
  done: boolean
  priority: Priority
  due?: string
  createdAt: number
}

const PRIORITIES: Priority[] = [1, 2, 3, 4, 5]

function normalizePriority(raw: unknown): Priority {
  if (raw === 'high') return 5
  if (raw === 'medium') return 3
  if (raw === 'low') return 1
  const n = Number(raw)
  if (n >= 1 && n <= 5) return n as Priority
  return 3
}

function StarPick({
  value,
  onChange,
  size = 'md',
  ariaLabel = '優先度',
}: {
  value: Priority
  onChange: (p: Priority) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
}) {
  return (
    <div
      className={`star-pick star-pick-${size}`}
      role="group"
      aria-label={ariaLabel}
      title={`優先度 ${value} 星`}
    >
      {PRIORITIES.map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${n <= value ? ' is-on' : ''}`}
          aria-label={`${n} 星`}
          aria-pressed={n <= value}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function Page() {
  const [stored, setStored] = useLocalStorage<Todo[]>('lab:todo-list', [])
  const todos = useMemo(
    () => stored.map((t) => ({ ...t, priority: normalizePriority(t.priority) })),
    [stored],
  )
  const setTodos = (next: Todo[] | ((prev: Todo[]) => Todo[])) => {
    setStored((prev) => {
      const base = prev.map((t) => ({ ...t, priority: normalizePriority(t.priority) }))
      return typeof next === 'function' ? next(base) : next
    })
  }
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>(3)
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const [prioFilter, setPrioFilter] = useState<'all' | Priority>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const canAdd = isNonEmpty(text)
  const canSaveEdit = isNonEmpty(editText)
  const filtering = filter !== 'all' || prioFilter !== 'all' || !!q.trim()

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return todos.filter((t) => {
      if (filter === 'done' && !t.done) return false
      if (filter === 'active' && t.done) return false
      if (prioFilter !== 'all' && t.priority !== prioFilter) return false
      if (needle && !t.text.toLowerCase().includes(needle)) return false
      return true
    })
  }, [todos, filter, prioFilter, q])

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

  function setTodoPriority(id: string, next: Priority) {
    setTodos(todos.map((t) => (t.id === id ? { ...t, priority: next } : t)))
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    const from = todos.findIndex((t) => t.id === fromId)
    const to = todos.findIndex((t) => t.id === toId)
    if (from < 0 || to < 0) return
    const next = [...todos]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setTodos(next)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack todo-page">
        <div className="todo-compose">
          <div className="todo-compose-main">
            <input
              className={`field${error && !canAdd ? ' is-invalid' : ''}`}
              placeholder="新增待辦…"
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => {
                setText(limitText(e.target.value, TEXT_MAX))
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && canAdd && add()}
              aria-label="待辦內容"
            />
            <span className="char-inline" aria-live="polite">
              {charCount(text)} / {TEXT_MAX}
            </span>
          </div>
          <div className="todo-compose-bar">
            <div className="todo-compose-slot" title="優先度">
              <span className="todo-compose-label">優先度</span>
              <StarPick value={priority} onChange={setPriority} ariaLabel="新增優先度" />
            </div>
            <span className="todo-compose-divider" aria-hidden />
            <label className="todo-compose-slot todo-compose-date">
              <span className="todo-compose-label">
                <IconCalendar size={14} strokeWidth={2.25} />
                到期
              </span>
              <input
                className="field"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                aria-label="到期日"
              />
            </label>
            <AddButton onClick={add} disabled={!canAdd} className="todo-compose-add">
              新增
            </AddButton>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="todo-toolbar">
          <div className="todo-toolbar-filters row toolbar-row">
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
            <label className="todo-prio-filter">
              <span className="muted">優先度</span>
              <select
                className="field"
                value={prioFilter === 'all' ? 'all' : String(prioFilter)}
                onChange={(e) => {
                  const v = e.target.value
                  setPrioFilter(v === 'all' ? 'all' : (Number(v) as Priority))
                }}
                aria-label="篩選優先度"
              >
                <option value="all">全部</option>
                {PRIORITIES.map((n) => (
                  <option key={n} value={n}>
                    {n} 星
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="todo-toolbar-search">
            <input
              className="field"
              placeholder="搜尋…"
              value={q}
              maxLength={SEARCH_MAX}
              onChange={(e) => setQ(limitText(e.target.value, SEARCH_MAX))}
              aria-label="搜尋待辦"
            />
          </div>
          <div className="todo-toolbar-stats">
            <span className="muted toolbar-stat">
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
        </div>

        {visible.length === 0 ? (
          <p className="muted todo-empty">
            {todos.length === 0 ? '還沒有待辦，先新增一筆吧' : '尚無符合篩選的待辦'}
          </p>
        ) : (
          <ol className="list todo-ol" aria-label="待辦清單（可拖曳調整順序）">
            {visible.map((t, index) => {
              const overdue = !t.done && !!t.due && t.due < new Date().toISOString().slice(0, 10)
              const isDragging = dragId === t.id
              const isOver = overId === t.id && dragId !== t.id
              const order = index + 1
              return (
                <li
                  key={t.id}
                  value={order}
                  className={`list-item todo-item${t.done ? ' done' : ''}${isDragging ? ' is-dragging' : ''}${isOver ? ' is-drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (overId !== t.id) setOverId(t.id)
                  }}
                  onDragLeave={() => {
                    if (overId === t.id) setOverId(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = dragId || e.dataTransfer.getData('text/plain')
                    if (from) reorder(from, t.id)
                    setDragId(null)
                    setOverId(null)
                  }}
                >
                  <span className="todo-order" aria-hidden>
                    {order}
                  </span>
                  <span
                    className="todo-grip"
                    role="button"
                    tabIndex={0}
                    title={filtering ? `拖曳調整順序（目前第 ${order} 筆）` : '拖曳調整順序'}
                    aria-label={`第 ${order} 筆，拖曳調整順序`}
                    draggable={editing !== t.id}
                    onDragStart={(e) => {
                      if (editing === t.id) {
                        e.preventDefault()
                        return
                      }
                      setDragId(t.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', t.id)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                      e.preventDefault()
                      const i = visible.findIndex((x) => x.id === t.id)
                      const target = e.key === 'ArrowUp' ? visible[i - 1] : visible[i + 1]
                      if (target) reorder(t.id, target.id)
                    }}
                  >
                    ⠿
                  </span>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() =>
                      setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                    }
                    aria-label={t.done ? '標為未完成' : '標為完成'}
                  />
                  <select
                    className="field todo-prio-badge"
                    value={t.priority}
                    onChange={(e) => setTodoPriority(t.id, Number(e.target.value) as Priority)}
                    aria-label={`${t.text} 優先度`}
                    title={`優先度 ${t.priority} 星`}
                  >
                    {PRIORITIES.map((n) => (
                      <option key={n} value={n}>
                        {n}★
                      </option>
                    ))}
                  </select>
                  {editing === t.id ? (
                    <div className="todo-edit">
                      <input
                        className={`field${!canSaveEdit ? ' is-invalid' : ''}`}
                        autoFocus
                        value={editText}
                        maxLength={TEXT_MAX}
                        onChange={(e) => setEditText(limitText(e.target.value, TEXT_MAX))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && canSaveEdit) saveEdit(t.id)
                          if (e.key === 'Escape') {
                            setEditing(null)
                            setError('')
                          }
                        }}
                        onBlur={() => {
                          if (canSaveEdit) saveEdit(t.id)
                          else {
                            setEditing(null)
                            setError('')
                          }
                        }}
                      />
                      <span className="char-inline">
                        {charCount(editText)} / {TEXT_MAX}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost sm todo-text"
                      onDoubleClick={() => {
                        setEditing(t.id)
                        setEditText(t.text)
                        setError('')
                      }}
                      title="雙擊編輯"
                    >
                      {t.text}
                    </button>
                  )}
                  {t.due && (
                    <span
                      className="muted todo-due"
                      style={{ color: overdue ? 'var(--rose)' : undefined }}
                    >
                      {overdue ? '逾期 ' : ''}
                      {t.due}
                    </span>
                  )}
                  <div className="todo-actions">
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        setEditing(t.id)
                        setEditText(t.text)
                        setError('')
                      }}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        if (editing === t.id) setEditing(null)
                        setTodos(todos.filter((x) => x.id !== t.id))
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <p className="muted todo-hint">
          有序清單：左側序號可拖曳調整順序；列表以「3★」顯示優先度，點選可改。
        </p>
      </div>
    </ProjectShell>
  )
}
