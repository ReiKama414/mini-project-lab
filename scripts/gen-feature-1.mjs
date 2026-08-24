import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'projects')
function write(slug, source) {
  const file = path.join(dir, slug, 'index.tsx')
  if (fs.existsSync(file)) { console.log('skip', slug); return }
  fs.mkdirSync(path.join(dir, slug), { recursive: true })
  fs.writeFileSync(file, source.trim() + '\n')
  console.log('write', slug)
}
const h = (slug, extra) => `import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
${extra}
const meta = getProject('${slug}')!
`

write('qr-scanner', `${h('qr-scanner', `import { useState } from 'react'\n`)}
export default function Page() {
  const [raw, setRaw] = useState('')
  const decoded = raw.trim() ? raw.trim() : ''
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <p className="muted">示範：貼上 QR 內容（或掃描結果文字）進行解析顯示。實務可接上相機 API。</p>
        <textarea className="field" placeholder="貼上 QR payload…" value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="panel">
          <label className="label">解析結果</label>
          {decoded ? (
            <div className="stack">
              <p className="mono">{decoded}</p>
              {/^https?:\\/\\//i.test(decoded) && <a className="btn accent sm" href={decoded} target="_blank" rel="noreferrer">開啟連結</a>}
            </div>
          ) : <p className="muted">尚無內容</p>}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('clipboard-manager', `${h('clipboard-manager', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'
`)}
type Clip = { id: string; text: string; at: number }
export default function Page() {
  const [items, setItems] = useLocalStorage<Clip[]>('lab:clipboard-manager', [])
  const [text, setText] = useState('')
  async function grab() {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) setItems([{ id: uid('c'), text: t, at: Date.now() }, ...items].slice(0, 50))
    } catch {
      if (text.trim()) setItems([{ id: uid('c'), text, at: Date.now() }, ...items].slice(0, 50))
    }
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="或手動輸入…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn accent" onClick={() => void grab()}>存入</button>
          <button className="btn ghost" onClick={() => setItems([])}>清空</button>
        </div>
        <ul className="list">
          {items.map((c) => (
            <li key={c.id} className="list-item">
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</span>
              <button className="btn ghost sm" onClick={() => void copyText(c.text)}>複製</button>
              <button className="btn ghost sm" onClick={() => setItems(items.filter((x) => x.id !== c.id))}>刪</button>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}`)

write('bookmark-manager', `${h('bookmark-manager', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Bm = { id: string; title: string; url: string; tag: string }
export default function Page() {
  const [items, setItems] = useLocalStorage<Bm[]>('lab:bookmark-manager', [])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('https://')
  const [tag, setTag] = useState('一般')
  function add() {
    if (!title.trim() || !url.trim()) return
    setItems([{ id: uid('b'), title: title.trim(), url: url.trim(), tag }, ...items])
    setTitle(''); setUrl('https://')
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" placeholder="標題" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" style={{ flex: 1 }} placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="field" style={{ width: 100 }} value={tag} onChange={(e) => setTag(e.target.value)} />
          <button className="btn accent" onClick={add}>新增</button>
        </div>
        <ul className="list">
          {items.map((b) => (
            <li key={b.id} className="list-item">
              <span className="tag">{b.tag}</span>
              <a href={b.url} target="_blank" rel="noreferrer" style={{ flex: 1 }}>{b.title}</a>
              <button className="btn ghost sm" onClick={() => setItems(items.filter((x) => x.id !== b.id))}>刪除</button>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}`)

write('notes-app', `${h('notes-app', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Note = { id: string; title: string; body: string; updated: number }
export default function Page() {
  const [notes, setNotes] = useLocalStorage<Note[]>('lab:notes-app', [])
  const [id, setId] = useState<string | null>(null)
  const current = notes.find((n) => n.id === id) ?? null
  function create() {
    const n = { id: uid('n'), title: '未命名筆記', body: '', updated: Date.now() }
    setNotes([n, ...notes]); setId(n.id)
  }
  function patch(p: Partial<Note>) {
    if (!current) return
    setNotes(notes.map((n) => n.id === current.id ? { ...n, ...p, updated: Date.now() } : n))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <button className="btn accent" onClick={create}>新筆記</button>
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id} className="list-item" style={{ cursor: 'pointer', background: n.id === id ? 'var(--accent-soft)' : undefined }} onClick={() => setId(n.id)}>
                <span style={{ flex: 1 }}>{n.title}</span>
                <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setNotes(notes.filter((x) => x.id !== n.id)); if (id === n.id) setId(null) }}>刪</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          {current ? (
            <>
              <input className="field" value={current.title} onChange={(e) => patch({ title: e.target.value })} />
              <textarea className="field" style={{ minHeight: 280 }} value={current.body} onChange={(e) => patch({ body: e.target.value })} />
            </>
          ) : <p className="muted">選擇或建立一則筆記</p>}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('markdown-notes', `${h('markdown-notes', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
`)}
export default function Page() {
  const [md, setMd] = useLocalStorage('lab:markdown-notes', '# 我的筆記\\n\\n- 待辦\\n- 靈感')
  const html = useMemo(() => md
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/^- (.*)$/gim, '<li>$1</li>')
    .replace(/\\n/g, '<br/>'), [md])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <textarea className="field panel" style={{ minHeight: 380 }} value={md} onChange={(e) => setMd(e.target.value)} />
        <div className="panel" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ProjectShell>
  )
}`)

write('kanban-board', `${h('kanban-board', `import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
import { useState } from 'react'
`)}
type Card = { id: string; title: string; col: 'todo' | 'doing' | 'done' }
const COLS = [{ id: 'todo' as const, label: '待辦' }, { id: 'doing' as const, label: '進行中' }, { id: 'done' as const, label: '完成' }]
export default function Page() {
  const [cards, setCards] = useLocalStorage<Card[]>('lab:kanban-board', [
    { id: '1', title: '設計導覽', col: 'done' },
    { id: '2', title: '實作 Todo', col: 'doing' },
    { id: '3', title: '寫 README', col: 'todo' },
  ])
  const [title, setTitle] = useState('')
  function add() {
    if (!title.trim()) return
    setCards([{ id: uid('k'), title: title.trim(), col: 'todo' }, ...cards])
    setTitle('')
  }
  function move(id: string, col: Card['col']) {
    setCards(cards.map((c) => c.id === id ? { ...c, col } : c))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="field" style={{ flex: 1 }} placeholder="新卡片…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn accent" onClick={add}>新增</button>
      </div>
      <div className="kanban">
        {COLS.map((col) => (
          <div key={col.id} className="kanban-col">
            <h3>{col.label}</h3>
            <ul className="list">
              {cards.filter((c) => c.col === col.id).map((c) => (
                <li key={c.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
                  <strong>{c.title}</strong>
                  <div className="row">
                    {COLS.filter((x) => x.id !== col.id).map((x) => (
                      <button key={x.id} className="btn ghost sm" onClick={() => move(c.id, x.id)}>{x.label}</button>
                    ))}
                    <button className="btn ghost sm" onClick={() => setCards(cards.filter((x) => x.id !== c.id))}>刪</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ProjectShell>
  )
}`)

write('habit-tracker', `${h('habit-tracker', `import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
import { useState } from 'react'
`)}
type Habit = { id: string; name: string; days: string[] }
const today = () => new Date().toISOString().slice(0, 10)
export default function Page() {
  const [habits, setHabits] = useLocalStorage<Habit[]>('lab:habit-tracker', [])
  const [name, setName] = useState('')
  function toggle(id: string) {
    const d = today()
    setHabits(habits.map((h) => {
      if (h.id !== id) return h
      const has = h.days.includes(d)
      return { ...h, days: has ? h.days.filter((x) => x !== d) : [...h.days, d] }
    }))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="習慣名稱" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn accent" onClick={() => { if (!name.trim()) return; setHabits([{ id: uid('h'), name: name.trim(), days: [] }, ...habits]); setName('') }}>新增</button>
        </div>
        <ul className="list">
          {habits.map((h) => {
            const done = h.days.includes(today())
            const streak = h.days.length
            return (
              <li key={h.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{h.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>打卡 {streak} 天</div>
                  <div className="progress" style={{ marginTop: 6 }}><span style={{ width: \`\${Math.min(100, streak * 10)}%\` }} /></div>
                </div>
                <button className={\`btn sm \${done ? 'teal' : 'ghost'}\`} onClick={() => toggle(h.id)}>{done ? '今日✓' : '打卡'}</button>
                <button className="btn ghost sm" onClick={() => setHabits(habits.filter((x) => x.id !== h.id))}>刪</button>
              </li>
            )
          })}
        </ul>
      </div>
    </ProjectShell>
  )
}`)

write('expense-tracker', `${h('expense-tracker', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Exp = { id: string; title: string; amount: number; cat: string }
export default function Page() {
  const [items, setItems] = useLocalStorage<Exp[]>('lab:expense-tracker', [])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [cat, setCat] = useState('餐飲')
  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items])
  const byCat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of items) m[i.cat] = (m[i.cat] ?? 0) + i.amount
    return Object.entries(m)
  }, [items])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="metric">NT$ {total.toLocaleString()}</div>
          <div className="row">
            <input className="field" placeholder="項目" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="field" type="number" style={{ width: 110 }} value={amount} onChange={(e) => setAmount(+e.target.value)} />
            <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>{['餐飲','交通','娛樂','購物','其他'].map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btn accent" onClick={() => { if (!title.trim()) return; setItems([{ id: uid('e'), title: title.trim(), amount, cat }, ...items]); setTitle(''); setAmount(0) }}>記一筆</button>
          </div>
          <ul className="list">{items.map((i) => (
            <li key={i.id} className="list-item"><span className="tag">{i.cat}</span><span style={{ flex: 1 }}>{i.title}</span><strong>{i.amount}</strong>
              <button className="btn ghost sm" onClick={() => setItems(items.filter((x) => x.id !== i.id))}>刪</button></li>
          ))}</ul>
        </div>
        <div className="panel stack">
          <h3>分類總計</h3>
          {byCat.map(([c, v]) => (
            <div key={c}><div className="row" style={{ justifyContent: 'space-between' }}><span>{c}</span><strong>{v}</strong></div>
              <div className="progress"><span style={{ width: \`\${total ? (v / total) * 100 : 0}%\` }} /></div></div>
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('accounting-app', `${h('accounting-app', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Row = { id: string; label: string; amount: number; type: 'in' | 'out' }
export default function Page() {
  const [rows, setRows] = useLocalStorage<Row[]>('lab:accounting-app', [])
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [type, setType] = useState<'in' | 'out'>('out')
  const bal = useMemo(() => rows.reduce((s, r) => s + (r.type === 'in' ? r.amount : -r.amount), 0), [rows])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="metric" style={{ color: bal >= 0 ? 'var(--teal)' : 'var(--rose)' }}>結餘 {bal.toLocaleString()}</div>
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="說明" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="field" type="number" style={{ width: 120 }} value={amount} onChange={(e) => setAmount(+e.target.value)} />
          <button className={\`btn sm \${type === 'in' ? 'teal' : 'ghost'}\`} onClick={() => setType('in')}>收入</button>
          <button className={\`btn sm \${type === 'out' ? 'accent' : 'ghost'}\`} onClick={() => setType('out')}>支出</button>
          <button className="btn accent" onClick={() => { if (!label.trim()) return; setRows([{ id: uid('a'), label: label.trim(), amount, type }, ...rows]); setLabel(''); setAmount(0) }}>記帳</button>
        </div>
        <ul className="list">{rows.map((r) => (
          <li key={r.id} className="list-item">
            <span className="tag">{r.type === 'in' ? '收入' : '支出'}</span>
            <span style={{ flex: 1 }}>{r.label}</span>
            <strong style={{ color: r.type === 'in' ? 'var(--teal)' : 'var(--rose)' }}>{r.type === 'in' ? '+' : '-'}{r.amount}</strong>
            <button className="btn ghost sm" onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('workout-tracker', `${h('workout-tracker', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Set = { id: string; name: string; reps: number; weight: number; at: string }
export default function Page() {
  const [sets, setSets] = useLocalStorage<Set[]>('lab:workout-tracker', [])
  const [name, setName] = useState('深蹲')
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(40)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" type="number" style={{ width: 90 }} value={reps} onChange={(e) => setReps(+e.target.value)} />
          <input className="field" type="number" style={{ width: 90 }} value={weight} onChange={(e) => setWeight(+e.target.value)} />
          <button className="btn accent" onClick={() => setSets([{ id: uid('w'), name, reps, weight, at: new Date().toLocaleString() }, ...sets])}>記錄組</button>
        </div>
        <ul className="list">{sets.map((s) => (
          <li key={s.id} className="list-item">
            <div style={{ flex: 1 }}><strong>{s.name}</strong><div className="muted">{s.reps} 下 · {s.weight} kg · {s.at}</div></div>
            <button className="btn ghost sm" onClick={() => setSets(sets.filter((x) => x.id !== s.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

console.log('feature part1 done')
