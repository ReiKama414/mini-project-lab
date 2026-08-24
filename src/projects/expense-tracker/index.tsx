import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('expense-tracker')!

type Expense = {
  id: string
  title: string
  amount: number
  category: string
  date: string
  note?: string
}

const CATS = ['餐飲', '交通', '購物', '娛樂', '居住', '醫療', '其他']

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function escapeCsv(v: string | number) {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Expense[]>('lab:expense-tracker', [
    {
      id: '1',
      title: '午餐',
      amount: 180,
      category: '餐飲',
      date: new Date().toISOString().slice(0, 10),
    },
    {
      id: '2',
      title: '捷運',
      amount: 45,
      category: '交通',
      date: new Date().toISOString().slice(0, 10),
    },
  ])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(100)
  const [category, setCategory] = useState(CATS[0]!)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [month, setMonth] = useLocalStorage('lab:expense-tracker:month', currentMonth())
  const [filterCat, setFilterCat] = useState('全部')

  const months = useMemo(() => {
    const set = new Set(items.map((i) => monthKey(i.date)))
    set.add(month)
    set.add(currentMonth())
    return [...set].sort().reverse()
  }, [items, month])

  const filtered = useMemo(() => {
    return items
      .filter((i) => monthKey(i.date) === month)
      .filter((i) => filterCat === '全部' || i.category === filterCat)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [items, month, filterCat])

  const total = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered])

  const byCat = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of filtered) map[i.category] = (map[i.category] || 0) + i.amount
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const maxCat = byCat[0]?.[1] || 1

  function add() {
    if (!title.trim() || amount <= 0) return
    setItems([
      {
        id: uid('exp'),
        title: title.trim(),
        amount,
        category,
        date,
        note: note.trim() || undefined,
      },
      ...items,
    ])
    setMonth(monthKey(date))
    setTitle('')
    setNote('')
  }

  function exportCsv() {
    const rows = [
      ['日期', '項目', '分類', '金額', '備註'].join(','),
      ...filtered.map((i) =>
        [i.date, i.title, i.category, i.amount, i.note || ''].map(escapeCsv).join(','),
      ),
    ]
    downloadText(`expenses-${month}.csv`, rows.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">月份</span>
            <select className="field" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="metric" style={{ flex: 1 }}>
            <div className="muted">{month} 支出</div>
            <div style={{ fontSize: 28 }}>${total.toLocaleString()}</div>
          </div>
          <button className="btn teal" onClick={exportCsv} disabled={!filtered.length}>
            匯出 CSV
          </button>
        </div>

        <div className="grid-2">
          <input
            className="field"
            placeholder="項目"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            className="field"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            className="field"
            style={{ gridColumn: '1 / -1' }}
            placeholder="備註（選填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button className="btn accent" onClick={add}>
          新增支出
        </button>

        {byCat.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <span className="label">分類長條圖</span>
            {byCat.map(([c, v]) => (
              <div key={c} className="stack" style={{ gap: 4 }}>
                <div className="row">
                  <span>{c}</span>
                  <span className="mono muted">
                    ${v.toLocaleString()}（{total ? Math.round((v / total) * 100) : 0}%）
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${(v / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {['全部', ...CATS].map((c) => (
            <button
              key={c}
              className={`btn sm ${filterCat === c ? 'accent' : 'ghost'}`}
              onClick={() => setFilterCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <ul className="list">
          {filtered.map((i) => (
            <li key={i.id} className="list-item">
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <strong>{i.title}</strong>
                <span className="muted">
                  {i.date} · {i.category}
                  {i.note ? ` · ${i.note}` : ''}
                </span>
              </div>
              <span className="mono">${i.amount.toLocaleString()}</span>
              <button
                className="btn sm ghost"
                onClick={() => setItems(items.filter((x) => x.id !== i.id))}
              >
                刪除
              </button>
            </li>
          ))}
          {!filtered.length && <p className="muted">此月份尚無支出</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
