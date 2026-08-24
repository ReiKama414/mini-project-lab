import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('rss-reader')!

type Feed = { id: string; title: string; source: string; summary: string; read: boolean; at: string }

const seed: Feed[] = [
  { id: '1', title: 'Vite 6 發佈重點整理', source: 'Dev Weekly', summary: '更快的 HMR、改善 CSS 管線與實驗性功能。', read: false, at: '2026-08-20' },
  { id: '2', title: 'React Compiler 實務筆記', source: 'Frontend Lab', summary: '何時不必再手寫 memo，以及邊界案例。', read: false, at: '2026-08-21' },
  { id: '3', title: '本機優先的 SaaS 架構', source: 'Indie Hackers TW', summary: '先 offline-capable，再逐步接雲端。', read: true, at: '2026-08-18' },
]

export default function Page() {
  const [items, setItems] = useLocalStorage<Feed[]>('lab:rss-reader', seed)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')

  const shown = items.filter((i) => (filter === 'all' ? true : !i.read))

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <button type="button" className={`btn sm ${filter === 'all' ? 'accent' : 'ghost'}`} onClick={() => setFilter('all')}>
            全部
          </button>
          <button type="button" className={`btn sm ${filter === 'unread' ? 'accent' : 'ghost'}`} onClick={() => setFilter('unread')}>
            未讀 ({items.filter((i) => !i.read).length})
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => ({ ...x, read: true })))}>
            全部標已讀
          </button>
        </div>
        <div className="row">
          <input className="field" placeholder="標題" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
          <input className="field" placeholder="來源" value={source} onChange={(e) => setSource(e.target.value)} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!title.trim()) return
              setItems((xs) => [
                { id: uid('f'), title: title.trim(), source: source || '自訂', summary: '手動加入的訂閱項目。', read: false, at: new Date().toISOString().slice(0, 10) },
                ...xs,
              ])
              setTitle('')
              setSource('')
            }}
          >
            新增
          </button>
        </div>
        <ul className="list">
          {shown.map((it) => (
            <li key={it.id} className="list-item stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ opacity: it.read ? 0.6 : 1 }}>{it.title}</strong>
                <span className="tag">{it.source}</span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {it.summary}
              </p>
              <div className="row">
                <span className="mono muted">{it.at}</span>
                <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, read: !x.read } : x)))}>
                  {it.read ? '標未讀' : '標已讀'}
                </button>
                <button type="button" className="btn sm danger" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
