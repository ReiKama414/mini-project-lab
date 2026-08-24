import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('kanban-board')!

type Col = 'todo' | 'doing' | 'done'
type Priority = 'low' | 'medium' | 'high'
type Card = {
  id: string
  title: string
  detail?: string
  col: Col
  priority: Priority
  createdAt: number
}

const COLS: { id: Col; label: string; wip?: number }[] = [
  { id: 'todo', label: '待辦' },
  { id: 'doing', label: '進行中', wip: 3 },
  { id: 'done', label: '完成' },
]

const PRIORITY_LABEL: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export default function Page() {
  const [cards, setCards] = useLocalStorage<Card[]>('lab:kanban-board', [
    {
      id: '1',
      title: '規劃功能',
      detail: '列出 MVP 範圍',
      col: 'todo',
      priority: 'high',
      createdAt: Date.now() - 86400000,
    },
    {
      id: '2',
      title: '實作看板',
      col: 'doing',
      priority: 'medium',
      createdAt: Date.now() - 3600000,
    },
  ])
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')

  const counts = useMemo(() => {
    const map: Record<Col, number> = { todo: 0, doing: 0, done: 0 }
    for (const c of cards) map[c.col]++
    return map
  }, [cards])

  function add() {
    if (!text.trim()) return
    setCards([
      {
        id: uid('card'),
        title: text.trim(),
        col: 'todo',
        priority,
        createdAt: Date.now(),
      },
      ...cards,
    ])
    setText('')
  }

  function move(id: string, col: Col) {
    const wip = COLS.find((c) => c.id === col)?.wip
    if (wip != null && counts[col] >= wip && cards.find((c) => c.id === id)?.col !== col) {
      const ok = window.confirm(`「${COLS.find((c) => c.id === col)?.label}」已達 WIP ${wip}，仍要移動？`)
      if (!ok) return
    }
    setCards(cards.map((c) => (c.id === id ? { ...c, col } : c)))
  }

  function startEdit(c: Card) {
    setEditing(c.id)
    setEditTitle(c.title)
    setEditDetail(c.detail || '')
    setEditPriority(c.priority)
  }

  function saveEdit() {
    if (!editing || !editTitle.trim()) return
    setCards(
      cards.map((c) =>
        c.id === editing
          ? {
              ...c,
              title: editTitle.trim(),
              detail: editDetail.trim() || undefined,
              priority: editPriority,
            }
          : c,
      ),
    )
    setEditing(null)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="新增卡片…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="field"
            style={{ width: 100 }}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="high">高優先</option>
            <option value="medium">中優先</option>
            <option value="low">低優先</option>
          </select>
          <button className="btn accent" onClick={add}>
            新增
          </button>
        </div>

        <div className="row">
          {COLS.map((col) => (
            <span key={col.id} className="tag">
              {col.label} {counts[col.id]}
              {col.wip != null ? ` / WIP ${col.wip}` : ''}
            </span>
          ))}
          <span className="muted" style={{ marginLeft: 'auto' }}>
            共 {cards.length} 張
          </span>
        </div>

        <div className="kanban">
          {COLS.map((col) => {
            const overWip = col.wip != null && counts[col.id] > col.wip
            return (
              <div key={col.id} className="kanban-col">
                <h3>
                  {col.label}{' '}
                  <span className="muted">
                    {counts[col.id]}
                    {col.wip != null ? `/${col.wip}` : ''}
                  </span>
                  {overWip && <span className="tag">超 WIP</span>}
                </h3>
                {cards
                  .filter((c) => c.col === col.id)
                  .sort((a, b) => {
                    const rank = { high: 0, medium: 1, low: 2 }
                    return rank[a.priority] - rank[b.priority]
                  })
                  .map((c) => (
                    <div
                      key={c.id}
                      className="list-item"
                      style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}
                    >
                      {editing === c.id ? (
                        <div className="stack" style={{ gap: 8 }}>
                          <input
                            className="field"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                          <textarea
                            className="field"
                            rows={2}
                            placeholder="詳情（選填）"
                            value={editDetail}
                            onChange={(e) => setEditDetail(e.target.value)}
                          />
                          <select
                            className="field"
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as Priority)}
                          >
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                          </select>
                          <div className="row">
                            <button className="btn sm accent" onClick={saveEdit}>
                              儲存
                            </button>
                            <button className="btn sm ghost" onClick={() => setEditing(null)}>
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row">
                            <strong style={{ flex: 1 }}>{c.title}</strong>
                            <span
                              className="tag"
                              style={{
                                background:
                                  c.priority === 'high'
                                    ? 'var(--rose-soft)'
                                    : c.priority === 'medium'
                                      ? 'var(--amber-soft)'
                                      : 'var(--teal-soft)',
                              }}
                            >
                              {PRIORITY_LABEL[c.priority]}
                            </span>
                          </div>
                          {c.detail && (
                            <span className="muted" style={{ fontSize: 13 }}>
                              {c.detail}
                            </span>
                          )}
                          <span className="muted" style={{ fontSize: 11 }}>
                            {new Date(c.createdAt).toLocaleDateString('zh-TW')}
                          </span>
                          <div className="row" style={{ flexWrap: 'wrap' }}>
                            {COLS.filter((x) => x.id !== c.col).map((x) => (
                              <button
                                key={x.id}
                                className="btn sm ghost"
                                onClick={() => move(c.id, x.id)}
                              >
                                → {x.label}
                              </button>
                            ))}
                            <button className="btn sm ghost" onClick={() => startEdit(c)}>
                              編輯
                            </button>
                            <button
                              className="btn sm ghost"
                              onClick={() => setCards(cards.filter((x) => x.id !== c.id))}
                            >
                              刪除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      </div>
    </ProjectShell>
  )
}
