import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const meta = getProject('accounting-app')!

type Entry = {
  id: string
  type: 'income' | 'expense'
  title: string
  amount: number
  category: string
  date: string
}

const INCOME_CATS = ['薪資', '獎金', '投資', '兼職', '其他收入']
const EXPENSE_CATS = ['餐飲', '交通', '居住', '購物', '娛樂', '醫療', '其他支出']

export default function Page() {
  const [entries, setEntries] = useLocalStorage<Entry[]>('lab:accounting-app', [])
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState(EXPENSE_CATS[0]!)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [search, setSearch] = useState('')

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS

  const monthEntries = useMemo(() => {
    const start = startOfMonth(parseISO(`${filterMonth}-01`))
    const end = endOfMonth(start)
    return entries.filter((e) => {
      const d = parseISO(e.date)
      if (!isWithinInterval(d, { start, end })) return false
      if (filterType !== 'all' && e.type !== filterType) return false
      if (search.trim() && !e.title.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [entries, filterMonth, filterType, search])

  const income = useMemo(
    () => monthEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0),
    [monthEntries],
  )
  const expense = useMemo(
    () => monthEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
    [monthEntries],
  )
  const balance = income - expense

  const chartMonths = useMemo(() => {
    const base = parseISO(`${filterMonth}-01`)
    return Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(base, 5 - i)
      const key = format(m, 'yyyy-MM')
      const start = startOfMonth(m)
      const end = endOfMonth(m)
      const inMonth = entries.filter((e) => isWithinInterval(parseISO(e.date), { start, end }))
      const inc = inMonth.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
      const exp = inMonth.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
      return { key, label: format(m, 'M月', { locale: zhTW }), inc, exp, bal: inc - exp }
    })
  }, [entries, filterMonth])

  const maxBar = Math.max(1, ...chartMonths.flatMap((m) => [m.inc, m.exp, Math.abs(m.bal)]))

  function switchType(t: 'income' | 'expense') {
    setType(t)
    setCategory(t === 'income' ? INCOME_CATS[0]! : EXPENSE_CATS[0]!)
  }

  function add() {
    if (!title.trim() || amount <= 0) return
    setEntries([
      { id: uid('acc'), type, title: title.trim(), amount, category, date },
      ...entries,
    ])
    setTitle('')
    setAmount(0)
  }

  function exportCsv() {
    const rows = [
      ['日期', '類型', '分類', '說明', '金額'],
      ...monthEntries.map((e) => [
        e.date,
        e.type === 'income' ? '收入' : '支出',
        e.category,
        e.title,
        String(e.amount),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadText(`accounting-${filterMonth}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={exportCsv} disabled={!monthEntries.length}>
          匯出 CSV
        </button>
      }
    >
      <div className="panel stack">
        <div className="grid-3">
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              本月收入
            </div>
            <div style={{ color: 'var(--teal)', fontSize: 24 }}>${income.toLocaleString()}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              本月支出
            </div>
            <div style={{ color: 'var(--rose)', fontSize: 24 }}>${expense.toLocaleString()}</div>
          </div>
          <div className="metric">
            <div className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
              結餘
            </div>
            <div style={{ fontSize: 24, color: balance >= 0 ? 'var(--teal)' : 'var(--rose)' }}>
              ${balance.toLocaleString()}
            </div>
          </div>
        </div>

        <div>
          <div className="label">近 6 個月收支長條</div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 12, minHeight: 120, padding: '8px 0' }}>
            {chartMonths.map((m) => (
              <div key={m.key} className="stack" style={{ flex: 1, gap: 4, alignItems: 'center' }}>
                <div className="row" style={{ alignItems: 'flex-end', gap: 3, height: 90, width: '100%', justifyContent: 'center' }}>
                  <div
                    title={`收入 $${m.inc.toLocaleString()}`}
                    style={{
                      width: 10,
                      height: `${(m.inc / maxBar) * 90}px`,
                      background: 'var(--teal)',
                      borderRadius: 4,
                      minHeight: m.inc ? 4 : 0,
                    }}
                  />
                  <div
                    title={`支出 $${m.exp.toLocaleString()}`}
                    style={{
                      width: 10,
                      height: `${(m.exp / maxBar) * 90}px`,
                      background: 'var(--rose)',
                      borderRadius: 4,
                      minHeight: m.exp ? 4 : 0,
                    }}
                  />
                  <div
                    title={`結餘 $${m.bal.toLocaleString()}`}
                    style={{
                      width: 10,
                      height: `${(Math.abs(m.bal) / maxBar) * 90}px`,
                      background: m.bal >= 0 ? 'var(--sky)' : 'var(--amber)',
                      borderRadius: 4,
                      minHeight: m.bal ? 4 : 0,
                    }}
                  />
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <div className="row">
            <span className="tag">收入</span>
            <span className="tag" style={{ background: 'var(--rose-soft)', color: '#9a1f45' }}>
              支出
            </span>
            <span className="tag" style={{ background: 'var(--sky-soft)' }}>
              結餘
            </span>
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="row">
          <button className={`btn sm ${type === 'income' ? 'teal' : 'ghost'}`} onClick={() => switchType('income')}>
            收入
          </button>
          <button className={`btn sm ${type === 'expense' ? 'accent' : 'ghost'}`} onClick={() => switchType('expense')}>
            支出
          </button>
        </div>
        <div className="grid-2">
          <input className="field" placeholder="說明" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input
            className="field"
            type="number"
            min={0}
            placeholder="金額"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn accent" onClick={add}>
          記一筆
        </button>
      </div>

      <div className="panel stack">
        <div className="row">
          <input
            className="field"
            type="month"
            style={{ maxWidth: 160 }}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button key={f} className={`btn sm ${filterType === f ? 'accent' : 'ghost'}`} onClick={() => setFilterType(f)}>
              {f === 'all' ? '全部' : f === 'income' ? '收入' : '支出'}
            </button>
          ))}
          <input
            className="field"
            style={{ flex: 1, minWidth: 120 }}
            placeholder="搜尋說明…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="list">
          {monthEntries
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <li key={e.id} className="list-item">
                <span className="tag" style={e.type === 'expense' ? { background: 'var(--rose-soft)', color: '#9a1f45' } : undefined}>
                  {e.type === 'income' ? '收' : '支'}
                </span>
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{e.title}</strong>
                  <span className="muted">
                    {e.date} · {e.category}
                  </span>
                </div>
                <span className="mono" style={{ color: e.type === 'income' ? 'var(--teal)' : 'var(--rose)' }}>
                  {e.type === 'income' ? '+' : '-'}${e.amount.toLocaleString()}
                </span>
                <button className="btn sm ghost" onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}>
                  刪
                </button>
              </li>
            ))}
          {!monthEntries.length && <p className="muted">此篩選條件下尚無紀錄</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
