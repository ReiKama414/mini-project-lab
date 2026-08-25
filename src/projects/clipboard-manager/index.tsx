import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, uid } from '../../lib/utils'

const meta = getProject('clipboard-manager')!

const TEXT_MAX = 5000
const SEARCH_MAX = 80

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
  const [error, setError] = useState('')

  const canAdd = isNonEmpty(text)

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
    const t = limitText(content.trim(), TEXT_MAX)
    if (!t) {
      setError('請輸入內容')
      return
    }
    setError('')
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
            className={`field${!canAdd && error ? ' is-invalid' : ''}`}
            style={{ flex: 1 }}
            rows={3}
            placeholder="手動加入剪貼內容…"
            value={text}
            maxLength={TEXT_MAX}
            onChange={(e) => {
              setText(limitText(e.target.value, TEXT_MAX))
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canAdd) add(text)
            }}
          />
        </div>
        <div className="field-meta">
          <span>{charCount(text)} / {TEXT_MAX}</span>
        </div>
        {error && <p className="field-error">{error}</p>}
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
          <button type="button" className="btn accent" onClick={() => add(text)} disabled={!canAdd}>
            加入
          </button>
          <button type="button" className="btn teal" onClick={pasteFromSystem}>
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
              type="button"
              className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            className={`btn sm ${onlyPinned ? 'teal' : 'ghost'}`}
            onClick={() => setOnlyPinned(!onlyPinned)}
          >
            僅釘選
          </button>
          <div className="field-wrap" style={{ flex: 1, minWidth: 140 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋…"
              value={q}
              maxLength={SEARCH_MAX}
              onChange={(e) => setQ(limitText(e.target.value, SEARCH_MAX))}
            />
            <div className="field-meta">
              <span>搜尋 {charCount(q)} / {SEARCH_MAX}</span>
            </div>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => setItems([])} disabled={!items.length}>
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
              <button type="button" className="btn sm ghost" onClick={() => togglePin(c.id)}>
                {c.pinned ? '取消釘選' : '釘選'}
              </button>
              <button type="button" className="btn sm accent" onClick={() => copyText(c.text)}>
                複製
              </button>
              <button type="button"
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
