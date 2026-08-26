import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('finance-dashboard')!

const LABEL_MAX = 80
const AMOUNT_MAX = 100_000_000
const BUDGET_MIN = 0
const BUDGET_MAX = 100_000_000

type Tx = {
  id: string
  label: string
  amount: number
  type: 'in' | 'out'
  cat: string
  date: string
}

const CATS_OUT = ['居住', '生活', '交通', '娛樂', '投資', '其他']
const CATS_IN = ['薪水', '投資', '其他收入']

const seed: Tx[] = [
  { id: '1', label: '薪水', amount: 52000, type: 'in', cat: '薪水', date: new Date().toISOString().slice(0, 7) + '-01' },
  { id: '2', label: '房租', amount: 18000, type: 'out', cat: '居住', date: new Date().toISOString().slice(0, 7) + '-02' },
  { id: '3', label: '餐飲', amount: 4200, type: 'out', cat: '生活', date: new Date().toISOString().slice(0, 7) + '-05' },
  { id: '4', label: '交通', amount: 1200, type: 'out', cat: '交通', date: new Date().toISOString().slice(0, 7) + '-08' },
  { id: '5', label: '投資配息', amount: 800, type: 'in', cat: '投資', date: new Date().toISOString().slice(0, 7) + '-10' },
  { id: '6', label: '訂閱服務', amount: 590, type: 'out', cat: '娛樂', date: new Date().toISOString().slice(0, 7) + '-12' },
]

export default function Page() {
  const [txs, setTxs] = useLocalStorage<Tx[]>('lab:finance-dashboard', seed)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'in' | 'out'>('out')
  const [cat, setCat] = useState('生活')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [budget, setBudget] = useLocalStorage('lab:finance-dashboard:budget', 30000)
  const [amountError, setAmountError] = useState('')

  const amountNum = parseNumber(amount)
  const amountOk = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= AMOUNT_MAX
  const labelOk = isNonEmpty(label)
  const canAdd = labelOk && amountOk && !amountError

  const monthTxs = useMemo(
    () => txs.filter((t) => t.date.startsWith(month)),
    [txs, month],
  )

  const { income, expense, balance, byCat } = useMemo(() => {
    const income = monthTxs.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0)
    const byCat: Record<string, number> = {}
    monthTxs
      .filter((t) => t.type === 'out')
      .forEach((t) => {
        byCat[t.cat] = (byCat[t.cat] || 0) + t.amount
      })
    return { income, expense, balance: income - expense, byCat }
  }, [monthTxs])

  const budgetPct = budget ? Math.min(100, (expense / budget) * 100) : 0

  function add() {
    if (!canAdd || !Number.isFinite(amountNum)) return
    setTxs((t) => [
      {
        id: uid('tx'),
        label: label.trim(),
        amount: clamp(amountNum, 0.01, AMOUNT_MAX),
        type,
        cat,
        date,
      },
      ...t,
    ])
    setLabel('')
    setAmount('')
    setAmountError('')
  }

  function exportCsv() {
    const lines = [
      'date,type,category,label,amount',
      ...monthTxs.map(
        (t) => `${t.date},${t.type},${t.cat},"${t.label.replace(/"/g, '""')}",${t.amount}`,
      ),
    ]
    downloadText(`finance-${month}.csv`, lines.join('\n'), 'text/csv')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={exportCsv}>
          匯出本月 CSV
        </button>
      }
    >
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="label" style={{ margin: 0 }}>
          月份
        </label>
        <input
          className="field"
          type="month"
          style={{ width: 180 }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <label className="label" style={{ margin: 0 }}>
          月預算
        </label>
        <input
          className="field"
          type="number"
          style={{ width: 140 }}
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          value={budget}
          onChange={(e) => {
            const n = parseNumber(e.target.value)
            if (!Number.isFinite(n)) return
            setBudget(clamp(n, BUDGET_MIN, BUDGET_MAX))
          }}
        />
        <p className="field-hint" style={{ margin: 0 }}>
          預算 {BUDGET_MIN}–{BUDGET_MAX.toLocaleString()}
        </p>
      </div>

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">
          <div className="muted">收入</div>
          <div style={{ fontSize: 28 }}>${income.toLocaleString()}</div>
        </div>
        <div className="metric panel">
          <div className="muted">支出</div>
          <div style={{ fontSize: 28 }}>${expense.toLocaleString()}</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <span
              style={{
                width: `${budgetPct}%`,
                background: budgetPct > 90 ? 'var(--rose)' : 'var(--accent)',
              }}
            />
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            預算使用 {budgetPct.toFixed(0)}%
          </div>
        </div>
        <div className="metric panel">
          <div className="muted">結餘</div>
          <div style={{ fontSize: 28, color: balance >= 0 ? 'var(--teal)' : 'var(--rose)' }}>
            ${balance.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="label">新增交易</div>
          <input
            className={`field${!labelOk && label.length > 0 ? ' is-invalid' : ''}`}
            placeholder="項目"
            value={label}
            maxLength={LABEL_MAX}
            onChange={(e) => setLabel(limitText(e.target.value, LABEL_MAX))}
          />
          <div className="field-meta">
            <span className={!labelOk ? 'warn' : undefined}>{!labelOk ? '請輸入項目' : ' '}</span>
            <span>
              {charCount(label)} / {LABEL_MAX}
            </span>
          </div>
          <div className="grid-2">
            <div className="stack">
              <input
                className={`field${(amount && !amountOk) || amountError ? ' is-invalid' : ''}`}
                placeholder="金額"
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value
                  setAmount(raw)
                  const n = parseNumber(raw)
                  if (raw.trim() && !Number.isFinite(n)) setAmountError('請輸入有效數字')
                  else if (Number.isFinite(n) && (n <= 0 || n > AMOUNT_MAX)) setAmountError(`金額須為 0.01–${AMOUNT_MAX.toLocaleString()}`)
                  else setAmountError('')
                }}
              />
              {amountError && <p className="field-error">{amountError}</p>}
              <p className="field-hint">0.01–{AMOUNT_MAX.toLocaleString()}</p>
            </div>
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="row">
            <button
              type="button"
              className={`btn sm ${type === 'in' ? 'teal' : 'ghost'}`}
              onClick={() => {
                setType('in')
                setCat('薪水')
              }}
            >
              收入
            </button>
            <button
              type="button"
              className={`btn sm ${type === 'out' ? 'danger' : 'ghost'}`}
              onClick={() => {
                setType('out')
                setCat('生活')
              }}
            >
              支出
            </button>
            <select
              className="field"
              style={{ flex: 1 }}
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              {(type === 'in' ? CATS_IN : CATS_OUT).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <AddButton type="button"  onClick={add} disabled={!canAdd}>
              新增</AddButton>
          </div>
          <div className="label">支出分類</div>
          {Object.entries(byCat)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div key={k}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{k}</span>
                  <span className="mono">${v.toLocaleString()}</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${expense ? (v / expense) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          {!Object.keys(byCat).length && <p className="muted">本月尚無支出</p>}
        </div>
        <div className="panel">
          <ul className="list">
            {monthTxs.map((t) => (
              <li key={t.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{t.label}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.date} · {t.cat}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{ color: t.type === 'in' ? 'var(--teal)' : 'var(--rose)' }}
                >
                  {t.type === 'in' ? '+' : '-'}${t.amount.toLocaleString()}
                </span>
                <button
                  className="btn ghost sm"
                  onClick={() => setTxs((xs) => xs.filter((x) => x.id !== t.id))}
                >
                  刪
                </button>
              </li>
            ))}
            {!monthTxs.length && <p className="muted">本月尚無交易</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
