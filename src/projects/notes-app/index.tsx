import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('notes-app')!

type Note = {
  id: string
  title: string
  body: string
  folder: string
  pinned: boolean
  updatedAt: number
  createdAt: number
}

const FOLDERS = ['全部', '個人', '工作', '靈感', '未分類']

export default function Page() {
  const [notes, setNotes] = useLocalStorage<Note[]>('lab:notes-app', [])
  const [active, setActive] = useState<string | null>(null)
  const [folder, setFolder] = useState('全部')
  const [q, setQ] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)

  const current = notes.find((n) => n.id === active) || null

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return notes
      .filter((n) => (folder === '全部' ? true : n.folder === folder))
      .filter((n) => (!onlyPinned ? true : n.pinned))
      .filter(
        (n) =>
          !s ||
          n.title.toLowerCase().includes(s) ||
          n.body.toLowerCase().includes(s),
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
  }, [notes, folder, q, onlyPinned])

  function create() {
    const n: Note = {
      id: uid('note'),
      title: '未命名筆記',
      body: '',
      folder: folder === '全部' ? '未分類' : folder,
      pinned: false,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    }
    setNotes([n, ...notes])
    setActive(n.id)
  }

  function update(patch: Partial<Note>) {
    if (!current) return
    setNotes(
      notes.map((n) =>
        n.id === current.id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    )
  }

  const charCount = current ? current.body.length : 0
  const wordCount = current
    ? current.body.trim() ? current.body.trim().split(/\s+/).length : 0
    : 0

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <button className="btn accent" onClick={create}>
            新增筆記
          </button>
          <input
            className="field"
            placeholder="搜尋標題或內容…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {FOLDERS.map((f) => (
              <button
                key={f}
                className={`btn sm ${folder === f ? 'accent' : 'ghost'}`}
                onClick={() => setFolder(f)}
              >
                {f}
              </button>
            ))}
            <button
              className={`btn sm ${onlyPinned ? 'teal' : 'ghost'}`}
              onClick={() => setOnlyPinned(!onlyPinned)}
            >
              僅釘選
            </button>
          </div>
          <ul className="list">
            {visible.map((n) => (
              <li
                key={n.id}
                className="list-item"
                style={{
                  cursor: 'pointer',
                  outline: active === n.id ? '2px solid var(--accent, #f0734a)' : undefined,
                }}
                onClick={() => setActive(n.id)}
              >
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <div className="row">
                    {n.pinned && <span className="tag">釘選</span>}
                    <strong>{n.title || '未命名'}</strong>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {n.folder} · {new Date(n.updatedAt).toLocaleString('zh-TW')}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {(n.body || '（空白）').slice(0, 48)}
                    {n.body.length > 48 ? '…' : ''}
                  </span>
                </div>
              </li>
            ))}
            {!visible.length && <p className="muted">尚無筆記</p>}
          </ul>
        </div>

        <div className="panel stack">
          {current ? (
            <>
              <div className="row">
                <input
                  className="field"
                  style={{ flex: 1 }}
                  value={current.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
                <select
                  className="field"
                  style={{ maxWidth: 120 }}
                  value={current.folder}
                  onChange={(e) => update({ folder: e.target.value })}
                >
                  {FOLDERS.filter((f) => f !== '全部').map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <button
                  className={`btn sm ${current.pinned ? 'teal' : 'ghost'}`}
                  onClick={() => update({ pinned: !current.pinned })}
                >
                  {current.pinned ? '已釘選' : '釘選'}
                </button>
              </div>
              <textarea
                className="field"
                rows={16}
                value={current.body}
                onChange={(e) => update({ body: e.target.value })}
                placeholder="開始書寫…"
              />
              <div className="row">
                <span className="muted">
                  {charCount.toLocaleString()} 字元 · 約 {wordCount} 詞 · 建立{' '}
                  {new Date(current.createdAt).toLocaleString('zh-TW')} · 更新{' '}
                  {new Date(current.updatedAt).toLocaleString('zh-TW')}
                </span>
                <button
                  className="btn ghost"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    setNotes(notes.filter((n) => n.id !== current.id))
                    setActive(null)
                  }}
                >
                  刪除筆記
                </button>
              </div>
            </>
          ) : (
            <p className="muted">選擇或新增一則筆記</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
