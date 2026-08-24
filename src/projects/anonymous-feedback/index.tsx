import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText } from '../../lib/utils'

const meta = getProject('anonymous-feedback')!

type Cat = '體驗' | '功能' | '文件' | '其他'
type Item = { id: string; text: string; mood: '😊' | '😐' | '😞'; cat: Cat; votes: number; at: number }

const CATS: Cat[] = ['體驗', '功能', '文件', '其他']

export default function Page() {
  const [items, setItems] = useLocalStorage<Item[]>('lab:anonymous-feedback', [
    { id: '1', text: '文件可以再清楚一點', mood: '😐', cat: '文件', votes: 3, at: Date.now() - 86400000 },
    { id: '2', text: '新版 UI 很好用！', mood: '😊', cat: '體驗', votes: 8, at: Date.now() - 3600000 },
    { id: '3', text: '希望有離線模式', mood: '😐', cat: '功能', votes: 5, at: Date.now() - 7200000 },
  ])
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Item['mood']>('😐')
  const [cat, setCat] = useState<Cat>('體驗')
  const [filter, setFilter] = useState<Cat | '全部'>('全部')
  const [boardName, setBoardName] = useLocalStorage('lab:anonymous-feedback:board', '產品回饋板')
  const [sort, setSort] = useState<'new' | 'votes'>('votes')

  const shown = useMemo(() => {
    const list = items.filter((i) => filter === '全部' || i.cat === filter)
    return [...list].sort((a, b) => (sort === 'votes' ? b.votes - a.votes : b.at - a.at))
  }, [items, filter, sort])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn ghost sm"
          onClick={() =>
            downloadText(
              'feedback.csv',
              ['分類,情緒,票數,內容,時間', ...items.map((i) => [i.cat, i.mood, i.votes, `"${i.text.replace(/"/g, '""')}"`, new Date(i.at).toISOString()].join(','))].join('\n'),
              'text/csv;charset=utf-8',
            )
          }
        >
          匯出
        </button>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <input className="field" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
        <textarea className="field" rows={3} placeholder="匿名留下想法…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="muted">分類</span>
          {CATS.map((c) => (
            <button key={c} type="button" className={`btn sm ${cat === c ? 'accent' : 'ghost'}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="row">
          {(['😊', '😐', '😞'] as const).map((m) => (
            <button key={m} type="button" className={`btn sm ${mood === m ? 'accent' : 'ghost'}`} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!text.trim()) return
              setItems((xs) => [{ id: uid('fb'), text: text.trim(), mood, cat, votes: 0, at: Date.now() }, ...xs])
              setText('')
            }}
          >
            匿名送出
          </button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {(['全部', ...CATS] as const).map((c) => (
          <button key={c} type="button" className={`btn sm ${filter === c ? 'accent' : 'ghost'}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
        <button type="button" className={`btn sm ${sort === 'votes' ? 'accent' : 'ghost'}`} onClick={() => setSort('votes')}>
          熱門
        </button>
        <button type="button" className={`btn sm ${sort === 'new' ? 'accent' : 'ghost'}`} onClick={() => setSort('new')}>
          最新
        </button>
      </div>
      <div className="grid-3">
        {shown.map((it) => (
          <div key={it.id} className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 22 }}>{it.mood}</span>
              <span className="tag">{it.cat}</span>
            </div>
            <p style={{ margin: 0 }}>{it.text}</p>
            <span className="muted mono">{new Date(it.at).toLocaleString('zh-TW')}</span>
            <div className="row">
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, votes: x.votes + 1 } : x)))}
              >
                ▲ {it.votes}
              </button>
              <button type="button" className="btn sm danger" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                審核刪除
              </button>
            </div>
          </div>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">此分類尚無回饋</p>}
    </ProjectShell>
  )
}
