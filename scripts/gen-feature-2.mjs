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

write('reading-tracker', `${h('reading-tracker', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, clamp } from '../../lib/utils'
`)}
type Book = { id: string; title: string; pages: number; read: number }
export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:reading-tracker', [])
  const [title, setTitle] = useState('')
  const [pages, setPages] = useState(300)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="書名" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" type="number" style={{ width: 100 }} value={pages} onChange={(e) => setPages(+e.target.value)} />
          <button className="btn accent" onClick={() => { if (!title.trim()) return; setBooks([{ id: uid('r'), title: title.trim(), pages, read: 0 }, ...books]); setTitle('') }}>加入</button>
        </div>
        <ul className="list">{books.map((b) => (
          <li key={b.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{b.title}</strong>
              <span className="muted">{b.read}/{b.pages} 頁</span>
            </div>
            <div className="progress"><span style={{ width: \`\${b.pages ? (b.read / b.pages) * 100 : 0}%\` }} /></div>
            <div className="row">
              <button className="btn sm ghost" onClick={() => setBooks(books.map((x) => x.id === b.id ? { ...x, read: clamp(x.read + 10, 0, x.pages) } : x))}>+10 頁</button>
              <button className="btn sm ghost" onClick={() => setBooks(books.filter((x) => x.id !== b.id))}>刪除</button>
            </div>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('movie-watchlist', `${h('movie-watchlist', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Movie = { id: string; title: string; status: 'want' | 'watched' }
export default function Page() {
  const [items, setItems] = useLocalStorage<Movie[]>('lab:movie-watchlist', [])
  const [title, setTitle] = useState('')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="電影名稱" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (title.trim() && (setItems([{ id: uid('m'), title: title.trim(), status: 'want' }, ...items]), setTitle('')))} />
          <button className="btn accent" onClick={() => { if (!title.trim()) return; setItems([{ id: uid('m'), title: title.trim(), status: 'want' }, ...items]); setTitle('') }}>加入想看</button>
        </div>
        <ul className="list">{items.map((m) => (
          <li key={m.id} className="list-item">
            <span style={{ flex: 1 }} className={m.status === 'watched' ? 'muted' : ''}>{m.title}</span>
            <span className="tag">{m.status === 'want' ? '想看' : '已看'}</span>
            <button className="btn ghost sm" onClick={() => setItems(items.map((x) => x.id === m.id ? { ...x, status: x.status === 'want' ? 'watched' : 'want' } : x))}>切換</button>
            <button className="btn ghost sm" onClick={() => setItems(items.filter((x) => x.id !== m.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('book-tracker', `${h('book-tracker', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Book = { id: string; title: string; status: string; rating: number }
export default function Page() {
  const [books, setBooks] = useLocalStorage<Book[]>('lab:book-tracker', [])
  const [title, setTitle] = useState('')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="書名" />
          <button className="btn accent" onClick={() => { if (!title.trim()) return; setBooks([{ id: uid('b'), title: title.trim(), status: '在讀', rating: 0 }, ...books]); setTitle('') }}>新增</button>
        </div>
        <ul className="list">{books.map((b) => (
          <li key={b.id} className="list-item">
            <div style={{ flex: 1 }}>
              <strong>{b.title}</strong>
              <div className="row" style={{ marginTop: 6 }}>
                {['想讀', '在讀', '讀完'].map((s) => (
                  <button key={s} className={\`btn sm \${b.status === s ? 'accent' : 'ghost'}\`} onClick={() => setBooks(books.map((x) => x.id === b.id ? { ...x, status: s } : x))}>{s}</button>
                ))}
                <select className="field" style={{ width: 90 }} value={b.rating} onChange={(e) => setBooks(books.map((x) => x.id === b.id ? { ...x, rating: +e.target.value } : x))}>
                  {[0,1,2,3,4,5].map((n) => <option key={n} value={n}>{n}★</option>)}
                </select>
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => setBooks(books.filter((x) => x.id !== b.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('recipe-manager', `${h('recipe-manager', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Recipe = { id: string; name: string; ingredients: string; steps: string }
export default function Page() {
  const [list, setList] = useLocalStorage<Recipe[]>('lab:recipe-manager', [])
  const [name, setName] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" placeholder="食譜名稱" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="field" placeholder="食材（一行一個）" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
          <textarea className="field" placeholder="步驟" value={steps} onChange={(e) => setSteps(e.target.value)} />
          <button className="btn accent" onClick={() => { if (!name.trim()) return; setList([{ id: uid('rc'), name: name.trim(), ingredients, steps }, ...list]); setName(''); setIngredients(''); setSteps('') }}>儲存食譜</button>
        </div>
        <div className="panel stack">
          <ul className="list">{list.map((r) => (
            <li key={r.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
              <div className="row">
                <strong style={{ flex: 1 }}>{r.name}</strong>
                <button className="btn ghost sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? '收合' : '展開'}</button>
                <button className="btn ghost sm" onClick={() => setList(list.filter((x) => x.id !== r.id))}>刪</button>
              </div>
              {open === r.id && (
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                  <div><strong>食材</strong>\\n{r.ingredients}</div>
                  <div style={{ marginTop: 8 }}><strong>步驟</strong>\\n{r.steps}</div>
                </div>
              )}
            </li>
          ))}</ul>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('shopping-list', `${h('shopping-list', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Item = { id: string; name: string; done: boolean; aisle: string }
export default function Page() {
  const [items, setItems] = useLocalStorage<Item[]>('lab:shopping-list', [])
  const [name, setName] = useState('')
  const [aisle, setAisle] = useState('雜貨')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="商品" onKeyDown={(e) => e.key === 'Enter' && name.trim() && (setItems([{ id: uid('s'), name: name.trim(), done: false, aisle }, ...items]), setName(''))} />
          <select className="field" style={{ width: 110 }} value={aisle} onChange={(e) => setAisle(e.target.value)}>{['雜貨','生鮮','日用品','其他'].map((a) => <option key={a}>{a}</option>)}</select>
          <button className="btn accent" onClick={() => { if (!name.trim()) return; setItems([{ id: uid('s'), name: name.trim(), done: false, aisle }, ...items]); setName('') }}>加入</button>
        </div>
        <ul className="list">{items.map((i) => (
          <li key={i.id} className={\`list-item \${i.done ? 'done' : ''}\`}>
            <input type="checkbox" checked={i.done} onChange={() => setItems(items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x))} />
            <span className="tag">{i.aisle}</span>
            <span style={{ flex: 1 }}>{i.name}</span>
            <button className="btn ghost sm" onClick={() => setItems(items.filter((x) => x.id !== i.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('packing-list', `${h('packing-list', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
const PRESETS: Record<string, string[]> = {
  商務: ['筆電', '充電器', '名片', '正裝', '洗漱包'],
  海島: ['泳裝', '防曬', '拖鞋', '墨鏡', '薄外套'],
  登山: ['登山鞋', '水壺', '雨衣', '頭燈', '急救包'],
}
type Item = { id: string; name: string; done: boolean }
export default function Page() {
  const [trip, setTrip] = useState('商務')
  const [items, setItems] = useLocalStorage<Item[]>('lab:packing-list', [])
  function generate() {
    setItems(PRESETS[trip]!.map((name) => ({ id: uid('p'), name, done: false })))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          {Object.keys(PRESETS).map((t) => (
            <button key={t} className={\`btn sm \${trip === t ? 'accent' : 'ghost'}\`} onClick={() => setTrip(t)}>{t}</button>
          ))}
          <button className="btn teal" onClick={generate}>產生清單</button>
        </div>
        <ul className="list">{items.map((i) => (
          <li key={i.id} className={\`list-item \${i.done ? 'done' : ''}\`}>
            <input type="checkbox" checked={i.done} onChange={() => setItems(items.map((x) => x.id === i.id ? { ...x, done: !x.done } : x))} />
            <span style={{ flex: 1 }}>{i.name}</span>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('event-countdown', `${h('event-countdown', `import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Ev = { id: string; title: string; date: string }
export default function Page() {
  const [events, setEvents] = useLocalStorage<Ev[]>('lab:event-countdown', [])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  const sorted = useMemo(() => [...events].sort((a, b) => +new Date(a.date) - +new Date(b.date)), [events])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="活動名稱" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn accent" onClick={() => { if (!title.trim() || !date) return; setEvents([{ id: uid('ev'), title: title.trim(), date }, ...events]); setTitle(''); setDate('') }}>新增</button>
        </div>
        <ul className="list">{sorted.map((e) => {
          const days = Math.ceil((+new Date(e.date) - now) / 86400000)
          return (
            <li key={e.id} className="list-item">
              <div style={{ flex: 1 }}><strong>{e.title}</strong><div className="muted">{e.date}</div></div>
              <div className="metric" style={{ fontSize: '1.4rem' }}>{days >= 0 ? \`D-\${days}\` : \`過了 \${-days} 天\`}</div>
              <button className="btn ghost sm" onClick={() => setEvents(events.filter((x) => x.id !== e.id))}>刪</button>
            </li>
          )
        })}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('birthday-reminder', `${h('birthday-reminder', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type P = { id: string; name: string; md: string }
function nextDays(md: string) {
  const [m, d] = md.split('-').map(Number)
  const now = new Date()
  let next = new Date(now.getFullYear(), (m ?? 1) - 1, d ?? 1)
  if (next < now) next = new Date(now.getFullYear() + 1, (m ?? 1) - 1, d ?? 1)
  return Math.ceil((+next - +now) / 86400000)
}
export default function Page() {
  const [people, setPeople] = useLocalStorage<P[]>('lab:birthday-reminder', [])
  const [name, setName] = useState('')
  const [md, setMd] = useState('01-01')
  const sorted = useMemo(() => [...people].sort((a, b) => nextDays(a.md) - nextDays(b.md)), [people])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} placeholder="名字" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder="MM-DD" value={md} onChange={(e) => setMd(e.target.value)} style={{ width: 120 }} />
          <button className="btn accent" onClick={() => { if (!name.trim()) return; setPeople([{ id: uid('bd'), name: name.trim(), md }, ...people]); setName('') }}>新增</button>
        </div>
        <ul className="list">{sorted.map((p) => (
          <li key={p.id} className="list-item">
            <div style={{ flex: 1 }}><strong>{p.name}</strong><div className="muted">{p.md}</div></div>
            <span className="tag">{nextDays(p.md)} 天後</span>
            <button className="btn ghost sm" onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('flashcard-app', `${h('flashcard-app', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Card = { id: string; front: string; back: string }
export default function Page() {
  const [cards, setCards] = useLocalStorage<Card[]>('lab:flashcard-app', [
    { id: '1', front: 'Hello', back: '你好' },
    { id: '2', front: 'React', back: '用於建構 UI 的函式庫' },
  ])
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const card = cards[i]
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack" style={{ minHeight: 220, justifyContent: 'center', textAlign: 'center', cursor: 'pointer' }} onClick={() => setFlip((f) => !f)}>
          {card ? <div className="metric" style={{ fontSize: '1.6rem' }}>{flip ? card.back : card.front}</div> : <p className="muted">沒有卡片</p>}
          <p className="muted">{card ? \`\${i + 1} / \${cards.length} · 點擊翻面\` : ''}</p>
        </div>
        <div className="panel stack">
          <div className="row">
            <button className="btn ghost" disabled={!cards.length} onClick={() => { setI((x) => (x - 1 + cards.length) % cards.length); setFlip(false) }}>上一張</button>
            <button className="btn ghost" disabled={!cards.length} onClick={() => { setI((x) => (x + 1) % cards.length); setFlip(false) }}>下一張</button>
          </div>
          <input className="field" placeholder="正面" value={front} onChange={(e) => setFront(e.target.value)} />
          <input className="field" placeholder="背面" value={back} onChange={(e) => setBack(e.target.value)} />
          <button className="btn accent" onClick={() => { if (!front.trim() || !back.trim()) return; setCards([...cards, { id: uid('f'), front: front.trim(), back: back.trim() }]); setFront(''); setBack('') }}>新增卡片</button>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('quiz-app', `${h('quiz-app', `import { useState } from 'react'\n`)}
const QUESTIONS = [
  { q: 'React 用來描述 UI 的基本單位是？', options: ['Component', 'Controller', 'Classloader', 'Packet'], a: 0 },
  { q: '哪個 hook 用來處理副作用？', options: ['useMemo', 'useEffect', 'useId', 'useRef'], a: 1 },
  { q: 'Vite 主要特色？', options: ['僅支援 PHP', '極快的開發伺服器', '只能 SSR', '內建資料庫'], a: 1 },
]
export default function Page() {
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const cur = QUESTIONS[i]!
  function answer(idx: number) {
    if (idx === cur.a) setScore((s) => s + 1)
    if (i + 1 >= QUESTIONS.length) setDone(true)
    else setI((x) => x + 1)
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 560 }}>
        {done ? (
          <>
            <div className="metric">{score} / {QUESTIONS.length}</div>
            <button className="btn accent" onClick={() => { setI(0); setScore(0); setDone(false) }}>再測一次</button>
          </>
        ) : (
          <>
            <p className="muted">題目 {i + 1}/{QUESTIONS.length}</p>
            <h2 style={{ fontSize: '1.25rem' }}>{cur.q}</h2>
            <div className="stack">{cur.options.map((o, idx) => (
              <button key={o} className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => answer(idx)}>{o}</button>
            ))}</div>
          </>
        )}
      </div>
    </ProjectShell>
  )
}`)

write('form-builder', `${h('form-builder', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Field = { id: string; label: string; type: 'text' | 'email' | 'select' }
export default function Page() {
  const [fields, setFields] = useLocalStorage<Field[]>('lab:form-builder', [
    { id: '1', label: '姓名', type: 'text' },
    { id: '2', label: 'Email', type: 'email' },
  ])
  const [label, setLabel] = useState('')
  const [type, setType] = useState<Field['type']>('text')
  const [values, setValues] = useState<Record<string, string>>({})
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <h3>編輯欄位</h3>
          <div className="row">
            <input className="field" style={{ flex: 1 }} placeholder="標籤" value={label} onChange={(e) => setLabel(e.target.value)} />
            <select className="field" value={type} onChange={(e) => setType(e.target.value as Field['type'])}>
              <option value="text">text</option><option value="email">email</option><option value="select">select</option>
            </select>
            <button className="btn accent" onClick={() => { if (!label.trim()) return; setFields([...fields, { id: uid('f'), label: label.trim(), type }]); setLabel('') }}>加入</button>
          </div>
          <ul className="list">{fields.map((f) => (
            <li key={f.id} className="list-item"><span style={{ flex: 1 }}>{f.label} <span className="muted">({f.type})</span></span>
              <button className="btn ghost sm" onClick={() => setFields(fields.filter((x) => x.id !== f.id))}>刪</button></li>
          ))}</ul>
        </div>
        <div className="panel stack">
          <h3>預覽表單</h3>
          {fields.map((f) => (
            <div key={f.id}>
              <label className="label">{f.label}</label>
              {f.type === 'select' ? (
                <select className="field" value={values[f.id] ?? ''} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}>
                  <option value="">請選擇</option><option>A</option><option>B</option>
                </select>
              ) : (
                <input className="field" type={f.type} value={values[f.id] ?? ''} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
              )}
            </div>
          ))}
          <button className="btn teal" onClick={() => alert(JSON.stringify(values, null, 2))}>送出（示範）</button>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('survey-app', `${h('survey-app', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
`)}
const Q = ['整體滿意度', '推薦意願', '介面好用嗎']
export default function Page() {
  const [votes, setVotes] = useLocalStorage<number[][]>('lab:survey-app', Q.map(() => [0, 0, 0, 0, 0]))
  const [answers, setAnswers] = useState<number[]>(Q.map(() => 3))
  const totals = useMemo(() => votes.map((v) => v.reduce((a, b) => a + b, 0)), [votes])
  function submit() {
    setVotes(votes.map((row, qi) => row.map((c, i) => (i === answers[qi]! - 1 ? c + 1 : c))))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          {Q.map((q, qi) => (
            <div key={q}>
              <label className="label">{q}</label>
              <div className="row">{[1,2,3,4,5].map((n) => (
                <button key={n} className={\`btn sm \${answers[qi] === n ? 'accent' : 'ghost'}\`} onClick={() => setAnswers(answers.map((a, i) => i === qi ? n : a))}>{n}</button>
              ))}</div>
            </div>
          ))}
          <button className="btn accent" onClick={submit}>送出問卷</button>
        </div>
        <div className="panel stack">
          <h3>統計</h3>
          {Q.map((q, qi) => (
            <div key={q} className="stack">
              <strong>{q}</strong>
              <div className="row">{votes[qi]!.map((c, i) => (
                <span key={i} className="tag">{i + 1}★ {c}</span>
              ))}</div>
              <p className="muted">回收 {totals[qi]} 份</p>
            </div>
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('anonymous-feedback', `${h('anonymous-feedback', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type FB = { id: string; text: string; at: number }
export default function Page() {
  const [list, setList] = useLocalStorage<FB[]>('lab:anonymous-feedback', [])
  const [text, setText] = useState('')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 640 }}>
        <textarea className="field" placeholder="匿名寫下回饋…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn accent" onClick={() => { if (!text.trim()) return; setList([{ id: uid('fb'), text: text.trim(), at: Date.now() }, ...list]); setText('') }}>送出匿名回饋</button>
        <ul className="list">{list.map((f) => (
          <li key={f.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
            <p>{f.text}</p>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{new Date(f.at).toLocaleString()}</span>
              <button className="btn ghost sm" onClick={() => setList(list.filter((x) => x.id !== f.id))}>刪除</button>
            </div>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

console.log('feature part2 done')
