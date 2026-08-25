import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

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

const MAX_ITEMS = 200
const MAX_TITLE = 80
const MAX_DETAIL = 500

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

  const titleOk = isNonEmpty(text)
  const editTitleOk = isNonEmpty(editTitle)
  const atLimit = cards.length >= MAX_ITEMS
  const canAdd = titleOk && !atLimit

  const counts = useMemo(() => {
    const map: Record<Col, number> = { todo: 0, doing: 0, done: 0 }
    for (const c of cards) map[c.col]++
    return map
  }, [cards])

  function add() {
    if (!canAdd) return
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
    if (!editing || !editTitleOk) return
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
          <div className="field-wrap" style={{ flex: 1 }}>
            <input
              className={`field${text.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              style={{ width: '100%' }}
              placeholder="新增卡片…"
              value={text}
              maxLength={MAX_TITLE}
              onChange={(e) => setText(limitText(e.target.value, MAX_TITLE))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <div className="field-meta">
              <span className={atLimit || (!titleOk && text.length > 0) ? 'warn' : undefined}>
                {atLimit ? `已達上限 ${MAX_ITEMS} 張` : !titleOk && text.length > 0 ? '請輸入標題' : '\u00a0'}
              </span>
              <span>
                {charCount(text)} / {MAX_TITLE}
              </span>
            </div>
          </div>
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
          <button type="button" className="btn accent" onClick={add} disabled={!canAdd}>
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
                          <div className="stack" style={{ gap: 0 }}>
                            <input
                              className={`field${!editTitleOk ? ' is-invalid' : ''}`}
                              value={editTitle}
                              maxLength={MAX_TITLE}
                              onChange={(e) => setEditTitle(limitText(e.target.value, MAX_TITLE))}
                            />
                            <div className="field-meta">
                              <span className={!editTitleOk ? 'warn' : undefined}>
                                {!editTitleOk ? '標題不可空白' : '\u00a0'}
                              </span>
                              <span>
                                {charCount(editTitle)} / {MAX_TITLE}
                              </span>
                            </div>
                          </div>
                          <div className="stack" style={{ gap: 0 }}>
                            <textarea
                              className="field"
                              rows={2}
                              placeholder="詳情（選填）"
                              value={editDetail}
                              maxLength={MAX_DETAIL}
                              onChange={(e) => setEditDetail(limitText(e.target.value, MAX_DETAIL))}
                            />
                            <div className="field-meta">
                              <span />
                              <span>
                                {charCount(editDetail)} / {MAX_DETAIL}
                              </span>
                            </div>
                          </div>
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
                            <button className="btn sm accent" onClick={saveEdit} disabled={!editTitleOk}>
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
                            <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</strong>
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
