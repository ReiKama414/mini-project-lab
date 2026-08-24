import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('bookmark-manager')!

type Bookmark = {
  id: string
  title: string
  url: string
  folder: string
  tags: string[]
  createdAt: number
}

const FOLDERS = ['全部', '工作', '學習', '娛樂', '其他']

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return ''
  }
}

function letterAvatar(title: string) {
  return (title.trim()[0] || '?').toUpperCase()
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Bookmark[]>('lab:bookmark-manager', [
    {
      id: '1',
      title: 'MDN',
      url: 'https://developer.mozilla.org',
      folder: '學習',
      tags: ['文件', 'Web'],
      createdAt: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'React',
      url: 'https://react.dev',
      folder: '工作',
      tags: ['前端'],
      createdAt: Date.now() - 3600000,
    },
  ])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('https://')
  const [folder, setFolder] = useState('工作')
  const [tagInput, setTagInput] = useState('')
  const [filterFolder, setFilterFolder] = useState('全部')
  const [filterTag, setFilterTag] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach((b) => b.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [items])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((b) => filterFolder === '全部' || b.folder === filterFolder)
      .filter((b) => !filterTag || b.tags.includes(filterTag))
      .filter(
        (b) =>
          !s ||
          b.title.toLowerCase().includes(s) ||
          b.url.toLowerCase().includes(s) ||
          b.tags.some((t) => t.toLowerCase().includes(s)),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [items, filterFolder, filterTag, q])

  function parseTags(raw: string) {
    return raw
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
  }

  function add() {
    if (!title.trim() || !url.trim()) return
    try {
      new URL(url)
    } catch {
      return
    }
    setItems([
      {
        id: uid('bm'),
        title: title.trim(),
        url: url.trim(),
        folder,
        tags: parseTags(tagInput),
        createdAt: Date.now(),
      },
      ...items,
    ])
    setTitle('')
    setUrl('https://')
    setTagInput('')
  }

  function saveEdit(id: string) {
    const b = items.find((x) => x.id === id)
    if (!b) return
    if (!title.trim() || !url.trim()) return
    try {
      new URL(url)
    } catch {
      return
    }
    setItems(
      items.map((x) =>
        x.id === id
          ? {
              ...x,
              title: title.trim(),
              url: url.trim(),
              folder,
              tags: parseTags(tagInput),
            }
          : x,
      ),
    )
    setEditing(null)
    setTitle('')
    setUrl('https://')
    setTagInput('')
    setFolder('工作')
  }

  function startEdit(b: Bookmark) {
    setEditing(b.id)
    setTitle(b.title)
    setUrl(b.url)
    setFolder(b.folder)
    setTagInput(b.tags.join(', '))
  }

  function cancelEdit() {
    setEditing(null)
    setTitle('')
    setUrl('https://')
    setTagInput('')
    setFolder('工作')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-2">
          <input
            className="field"
            placeholder="標題"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="field"
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="row">
          <select
            className="field"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            style={{ maxWidth: 140 }}
          >
            {FOLDERS.filter((f) => f !== '全部').map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="標籤（逗號分隔）"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          {editing ? (
            <>
              <button className="btn accent" onClick={() => saveEdit(editing)}>
                儲存
              </button>
              <button className="btn ghost" onClick={cancelEdit}>
                取消
              </button>
            </>
          ) : (
            <button className="btn accent" onClick={add}>
              新增書籤
            </button>
          )}
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {FOLDERS.map((f) => (
            <button
              key={f}
              className={`btn sm ${filterFolder === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilterFolder(f)}
            >
              {f}
            </button>
          ))}
          <input
            className="field"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="搜尋標題 / URL / 標籤…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className={`btn sm ${!filterTag ? 'teal' : 'ghost'}`}
              onClick={() => setFilterTag('')}
            >
              全部標籤
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                className={`btn sm ${filterTag === t ? 'teal' : 'ghost'}`}
                onClick={() => setFilterTag(filterTag === t ? '' : t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <ul className="list">
          {visible.map((b) => {
            const icon = faviconUrl(b.url)
            return (
              <li key={b.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    width={28}
                    height={28}
                    style={{ borderRadius: 6, marginTop: 4 }}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <span
                    className="tag"
                    style={{ width: 28, height: 28, justifyContent: 'center', textAlign: 'center' }}
                  >
                    {letterAvatar(b.title)}
                  </span>
                )}
                <div className="stack" style={{ flex: 1, gap: 4 }}>
                  <strong>{b.title}</strong>
                  <a href={b.url} target="_blank" rel="noreferrer" className="muted">
                    {b.url}
                  </a>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <span className="tag">{b.folder}</span>
                    {b.tags.map((t) => (
                      <span key={t} className="tag">
                        #{t}
                      </span>
                    ))}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(b.createdAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                </div>
                <a className="btn sm teal" href={b.url} target="_blank" rel="noreferrer">
                  開啟
                </a>
                <button className="btn sm ghost" onClick={() => startEdit(b)}>
                  編輯
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => setItems(items.filter((x) => x.id !== b.id))}
                >
                  刪除
                </button>
              </li>
            )
          })}
          {!visible.length && <p className="muted">尚無符合的書籤</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
