import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

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
const MAX_ITEMS = 500
const MAX_TITLE = 80
const MAX_SEARCH = 80
const MAX_AMOUNT = 1_000_000_000

const ENTRY_SAMPLES = [
  { label: '薪資', type: 'income' as const, title: '月薪', amount: 45000, category: '薪資' },
  { label: '午餐', type: 'expense' as const, title: '午餐', amount: 120, category: '餐飲' },
  { label: '房租', type: 'expense' as const, title: '房租', amount: 12000, category: '居住' },
]

function isValidDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

export default function Page() {
  const [entries, setEntries] = useLocalStorage<Entry[]>('lab:accounting-app', [])
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATS[0]!)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [search, setSearch] = useState('')

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS
  const amount = parseNumber(amountStr)
  const titleOk = isNonEmpty(title)
  const amountOk = Number.isFinite(amount) && amount >= 0
  const dateOk = isValidDate(date)
  const atLimit = entries.length >= MAX_ITEMS
  const canAdd = titleOk && amountOk && dateOk && !atLimit

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
    if (!canAdd || !Number.isFinite(amount)) return
    setEntries([
      {
        id: uid('acc'),
        type,
        title: title.trim(),
        amount: clamp(amount, 0, MAX_AMOUNT),
        category,
        date,
      },
      ...entries,
    ])
    setTitle('')
    setAmountStr('')
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

  function applySample(s: (typeof ENTRY_SAMPLES)[0]) {
    setType(s.type)
    setTitle(s.title)
    setAmountStr(String(s.amount))
    setCategory(s.category)
  }

  return (
    <FeatureLayout
      variant="unified"
      meta={meta}
      actions={
        <ActionButton className="btn sm ghost" onClick={exportCsv} disabled={!monthEntries.length} icon="download">
          匯出 CSV
        </ActionButton>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h2 className="pw-panel-title">快速帶入</h2>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {ENTRY_SAMPLES.map((s) => (
              <button key={s.label} type="button" className="btn sm ghost" onClick={() => applySample(s)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ft-stats-row">
            <span className="tag">{filterMonth} 列表 {monthEntries.length} 筆</span>
            <span className="tag">資料庫 {entries.length} / {MAX_ITEMS}</span>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '筆數上限', value: `${MAX_ITEMS} 筆` },
        { label: '匯出', value: '依篩選月份之 CSV（含 BOM）' },
      ]}
      faq={[ftPrivacyLocal, { title: '結餘', body: '上方指標與長條圖依日曆月份計算；列表可再依類型與關鍵字篩選。' }]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="📒"
          title={
            <span style={{ color: balance >= 0 ? 'var(--teal)' : 'var(--rose)' }} className="mono">
              ${balance.toLocaleString()}
            </span>
          }
          subtitle={`${filterMonth} 結餘`}
          meta={
            <>
              收入 ${income.toLocaleString()} · 支出 ${expense.toLocaleString()}
              <br />
              篩選：{filterType === 'all' ? '全部類型' : filterType === 'income' ? '僅收入' : '僅支出'}
              {search.trim() ? ` · 搜尋「${search.trim()}」` : ''}
            </>
          }
          badge={balance < 0 ? <span className="tag">赤字</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="本月收入" value={`$${income.toLocaleString()}`} mono />
          <FtMetric label="本月支出" value={`$${expense.toLocaleString()}`} mono />
          <FtMetric label="列表筆數" value={monthEntries.length} />
          <FtMetric label="總紀錄" value={`${entries.length} / ${MAX_ITEMS}`} />
        </FtMetricGrid>

        <FtSection title="近 6 個月收支" hint="收入／支出／結餘長條">
        <div>
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
        </FtSection>

        <FtSection title="記一筆">
        <div className="row">
          <button type="button" className={`btn sm ${type === 'income' ? 'teal' : 'ghost'}`} onClick={() => switchType('income')}>
            收入
          </button>
          <button type="button" className={`btn sm ${type === 'expense' ? 'accent' : 'ghost'}`} onClick={() => switchType('expense')}>
            支出
          </button>
        </div>
        <div className="grid-2">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="說明"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入說明' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${amountStr !== '' && !amountOk ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={MAX_AMOUNT}
              step="0.01"
              placeholder="金額"
              value={amountStr}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) setAmountStr(e.target.value)
                else setAmountStr(String(clamp(n, 0, MAX_AMOUNT)))
              }}
            />
            <div className="field-meta">
              <span className={amountStr !== '' && !amountOk ? 'warn' : undefined}>
                {amountStr !== '' && !amountOk ? '金額須為 ≥ 0 的數字' : '\u00a0'}
              </span>
              <span className="field-hint">0 – {MAX_AMOUNT.toLocaleString()}</span>
            </div>
          </div>
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${!dateOk ? ' is-invalid' : ''}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {!dateOk && <p className="field-error">請選擇有效日期</p>}
          </div>
        </div>
        <ActionButton className="btn accent" onClick={add} disabled={!canAdd}>
          記一筆
        </ActionButton>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 筆，請先刪除再新增</p>}
        </FtSection>

        <FtSection title="明細與篩選">
        <div className="row">
          <input
            className="field"
            type="month"
            style={{ maxWidth: 160 }}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button type="button" key={f} className={`btn sm ${filterType === f ? 'accent' : 'ghost'}`} onClick={() => setFilterType(f)}>
              {f === 'all' ? '全部' : f === 'income' ? '收入' : '支出'}
            </button>
          ))}
          <div className="field-wrap" style={{ flex: 1, minWidth: 120 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋說明…"
              value={search}
              maxLength={MAX_SEARCH}
              onChange={(e) => setSearch(limitText(e.target.value, MAX_SEARCH))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(search)} / {MAX_SEARCH}
              </span>
            </div>
          </div>
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
                <button type="button" className="btn sm ghost" onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}>
                  刪
                </button>
              </li>
            ))}
          {!monthEntries.length && <p className="muted">此篩選條件下尚無紀錄</p>}
        </ul>
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
