import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('clipboard-manager')!

type Category = '一般' | '程式碼' | '連結' | '備註'
type Clip = {
  id: string
  text: string
  category: Category
  pinned: boolean
  createdAt: number
}

const CATS: Category[] = ['一般', '程式碼', '連結', '備註']

function guessCategory(text: string): Category {
  if (/^https?:\/\//i.test(text.trim())) return '連結'
  if (/[{};=<>]|function |const |let |import /.test(text)) return '程式碼'
  return '一般'
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Clip[]>('lab:clipboard-manager', [])
  const [text, setText] = useState('')
  const [category, setCategory] = useState<Category>('一般')
  const [filter, setFilter] = useState<'全部' | Category>('全部')
  const [q, setQ] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((c) => (filter === '全部' ? true : c.category === filter))
      .filter((c) => (!onlyPinned ? true : c.pinned))
      .filter((c) => !s || c.text.toLowerCase().includes(s))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.createdAt - a.createdAt
      })
  }, [items, filter, q, onlyPinned])

  function add(content: string, cat?: Category) {
    const t = content.trim()
    if (!t) return
    const next: Clip = {
      id: uid('clip'),
      text: t,
      category: cat || category || guessCategory(t),
      pinned: false,
      createdAt: Date.now(),
    }
    setItems([next, ...items].slice(0, 80))
    setText('')
  }

  async function pasteFromSystem() {
    try {
      const t = await navigator.clipboard.readText()
      add(t, guessCategory(t))
    } catch {
      add(text)
    }
  }

  function togglePin(id: string) {
    setItems(items.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <textarea
            className="field"
            style={{ flex: 1 }}
            rows={3}
            placeholder="手動加入剪貼內容…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(text)
            }}
          />
        </div>
        <div className="row">
          <select
            className="field"
            style={{ maxWidth: 140 }}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn accent" onClick={() => add(text)}>
            加入
          </button>
          <button className="btn teal" onClick={pasteFromSystem}>
            讀取系統剪貼簿
          </button>
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
            Ctrl/⌘ + Enter 快速加入
          </span>
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(['全部', ...CATS] as const).map((f) => (
            <button
              key={f}
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
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
          <input
            className="field"
            style={{ flex: 1, minWidth: 140 }}
            placeholder="搜尋…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn ghost sm" onClick={() => setItems([])} disabled={!items.length}>
            全部清除
          </button>
        </div>

        <div className="row">
          <span className="muted">
            顯示 {visible.length} / 共 {items.length}（最多 80）
          </span>
        </div>

        <ul className="list">
          {visible.map((c) => (
            <li key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="stack" style={{ flex: 1, gap: 6 }}>
                <div className="row">
                  {c.pinned && <span className="tag">釘選</span>}
                  <span className="tag">{c.category}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {new Date(c.createdAt).toLocaleString('zh-TW')}
                  </span>
                </div>
                <span
                  className={c.category === '程式碼' ? 'mono' : undefined}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {c.text}
                </span>
              </div>
              <button className="btn sm ghost" onClick={() => togglePin(c.id)}>
                {c.pinned ? '取消釘選' : '釘選'}
              </button>
              <button className="btn sm accent" onClick={() => copyText(c.text)}>
                複製
              </button>
              <button
                className="btn sm ghost"
                onClick={() => setItems(items.filter((x) => x.id !== c.id))}
              >
                刪除
              </button>
            </li>
          ))}
          {!visible.length && <p className="muted">尚無符合的紀錄</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
