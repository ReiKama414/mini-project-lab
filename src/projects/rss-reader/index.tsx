import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('newsletter-reader')!

type Folder = 'inbox' | 'star' | 'archive' | 'unread'
type NL = {
  id: string
  from: string
  subject: string
  body: string
  folder: string
  starred: boolean
  archived: boolean
  read: boolean
  at: number
}

const seed: NL[] = [
  {
    id: '1',
    from: 'Bytes.dev',
    subject: '本週前端精選',
    body: '包含 CSS 新語法、bundler 比較與一則效能案例。建議先看效能案例中的瀑布圖分析。',
    folder: '前端',
    starred: true,
    archived: false,
    read: false,
    at: Date.now() - 86400000,
  },
  {
    id: '2',
    from: 'TLDR',
    subject: 'AI 工具速覽',
    body: '本地模型推理、評測基準與授權注意事項。本週重點是量化與授權相容。',
    folder: 'AI',
    starred: false,
    archived: false,
    read: false,
    at: Date.now() - 3600000 * 5,
  },
  {
    id: '3',
    from: 'Pointer',
    subject: '設計系統雜誌',
    body: 'Token 命名、主題切換與可及性檢查清單。附上對照表可直接套用。',
    folder: '設計',
    starred: false,
    archived: false,
    read: true,
    at: Date.now() - 86400000 * 3,
  },
]

export default function Page() {
  const [items, setItems] = useLocalStorage<NL[]>('lab:newsletter-reader', seed)
  const [folders, setFolders] = useLocalStorage<string[]>('lab:newsletter-reader:folders', ['前端', 'AI', '設計', '其他'])
  const [sel, setSel] = useState(seed[0]!.id)
  const [tab, setTab] = useState<Folder>('inbox')
  const [folderFilter, setFolderFilter] = useState<string>('全部')
  const [newFolder, setNewFolder] = useState('')

  const list = useMemo(() => {
    return items
      .filter((i) => {
        if (tab === 'inbox') return !i.archived
        if (tab === 'star') return i.starred && !i.archived
        if (tab === 'archive') return i.archived
        return !i.read && !i.archived
      })
      .filter((i) => folderFilter === '全部' || i.folder === folderFilter)
      .sort((a, b) => b.at - a.at)
  }, [items, tab, folderFilter])

  const current = items.find((i) => i.id === sel) || list[0]
  const unread = items.filter((i) => !i.read && !i.archived).length

  function patch(id: string, partial: Partial<NL>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...partial } : x)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['inbox', '收件匣'],
            ['unread', `未讀 (${unread})`],
            ['star', '星號'],
            ['archive', '封存'],
          ] as [Folder, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" className={`btn sm ${tab === t ? 'accent' : 'ghost'}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
        <button
          type="button"
          className="btn sm teal"
          onClick={() => {
            const n: NL = {
              id: uid('nl'),
              from: '自訂',
              subject: '新電子報',
              body: '在此撰寫摘要…',
              folder: folders[0] || '其他',
              starred: false,
              archived: false,
              read: false,
              at: Date.now(),
            }
            setItems((xs) => [n, ...xs])
            setSel(n.id)
            setTab('inbox')
          }}
        >
          新增
        </button>
      </div>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="muted">資料夾</span>
        <button type="button" className={`btn sm ${folderFilter === '全部' ? 'accent' : 'ghost'}`} onClick={() => setFolderFilter('全部')}>
          全部
        </button>
        {folders.map((f) => (
          <button key={f} type="button" className={`btn sm ${folderFilter === f ? 'accent' : 'ghost'}`} onClick={() => setFolderFilter(f)}>
            {f}
          </button>
        ))}
        <input className="field" style={{ width: 120 }} placeholder="新資料夾" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            if (!newFolder.trim() || folders.includes(newFolder.trim())) return
            setFolders((fs) => [...fs, newFolder.trim()])
            setNewFolder('')
          }}
        >
          加資料夾
        </button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <ul className="list">
            {list.map((i) => (
              <li
                key={i.id}
                className="list-item"
                style={{ cursor: 'pointer', opacity: i.read ? 0.7 : 1, fontWeight: i.read ? 400 : 600 }}
                onClick={() => {
                  setSel(i.id)
                  patch(i.id, { read: true })
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{i.from}</span>
                  <span className="tag">{i.folder}</span>
                </div>
                <div>
                  {!i.read && <span className="tag">未讀</span>} {i.starred && '★ '}
                  {i.subject}
                </div>
              </li>
            ))}
            {list.length === 0 && <li className="muted">無信件</li>}
          </ul>
        </div>
        <div className="panel stack">
          {current ? (
            <>
              <h3 style={{ margin: 0 }}>{current.subject}</h3>
              <span className="muted">
                {current.from} · {new Date(current.at).toLocaleString('zh-TW')}
              </span>
              <select
                className="field"
                value={current.folder}
                onChange={(e) => patch(current.id, { folder: e.target.value })}
              >
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <p>{current.body}</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { starred: !current.starred })}>
                  {current.starred ? '取消星號' : '加星號'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { read: !current.read })}>
                  {current.read ? '標未讀' : '標已讀'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { archived: !current.archived })}>
                  {current.archived ? '移回收件匣' : '封存'}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">無信件</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
