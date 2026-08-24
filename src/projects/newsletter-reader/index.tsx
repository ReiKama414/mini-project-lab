import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('newsletter-reader')!

type NL = { id: string; from: string; subject: string; body: string; starred: boolean; archived: boolean }

const seed: NL[] = [
  { id: '1', from: 'Bytes.dev', subject: '本週前端精選', body: '包含 CSS 新語法、bundler 比較與一則效能案例。', starred: true, archived: false },
  { id: '2', from: 'TLDR', subject: 'AI 工具速覽', body: '本地模型推理、評測基準與授權注意事項。', starred: false, archived: false },
  { id: '3', from: 'Pointer', subject: '設計系統雜誌', body: 'Token 命名、主題切換與可及性檢查清單。', starred: false, archived: false },
]

export default function Page() {
  const [items, setItems] = useLocalStorage<NL[]>('lab:newsletter-reader', seed)
  const [sel, setSel] = useState(seed[0]!.id)
  const [tab, setTab] = useState<'inbox' | 'star' | 'archive'>('inbox')

  const list = items.filter((i) => (tab === 'inbox' ? !i.archived : tab === 'star' ? i.starred && !i.archived : i.archived))
  const current = items.find((i) => i.id === sel) || list[0]

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 8 }}>
        {(['inbox', 'star', 'archive'] as const).map((t) => (
          <button key={t} type="button" className={`btn sm ${tab === t ? 'accent' : 'ghost'}`} onClick={() => setTab(t)}>
            {t === 'inbox' ? '收件匣' : t === 'star' ? '星號' : '封存'}
          </button>
        ))}
        <button
          type="button"
          className="btn sm teal"
          onClick={() => {
            const n = { id: uid('nl'), from: '自訂', subject: '新電子報', body: '在此撰寫摘要…', starred: false, archived: false }
            setItems((xs) => [n, ...xs])
            setSel(n.id)
            setTab('inbox')
          }}
        >
          新增
        </button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <ul className="list">
            {list.map((i) => (
              <li key={i.id} className={`list-item ${sel === i.id ? 'tag' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setSel(i.id)}>
                <div className="muted">{i.from}</div>
                <strong>{i.subject}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          {current ? (
            <>
              <h3 style={{ margin: 0 }}>{current.subject}</h3>
              <span className="muted">{current.from}</span>
              <p>{current.body}</p>
              <div className="row">
                <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => (x.id === current.id ? { ...x, starred: !x.starred } : x)))}>
                  {current.starred ? '取消星號' : '加星號'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => (x.id === current.id ? { ...x, archived: !x.archived } : x)))}>
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
