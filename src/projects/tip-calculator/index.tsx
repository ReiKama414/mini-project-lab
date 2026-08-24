import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('tip-calculator')!

const BILL_MAX = 1_000_000
const PCT_MAX = 100
const PEOPLE_MIN = 1
const PEOPLE_MAX = 50

type HistoryItem = {
  id: string
  at: number
  bill: number
  tip: number
  tax: number
  people: number
  roundUp: boolean
  tipAmt: number
  taxAmt: number
  total: number
  perPerson: number
}

const TIP_PRESETS = [0, 5, 10, 12, 15, 18, 20]
const PEOPLE_PRESETS = [1, 2, 3, 4, 5, 6, 8]

export default function Page() {
  const [bill, setBill] = useLocalStorage('lab:tip-calculator:bill', 1000)
  const [tip, setTip] = useLocalStorage('lab:tip-calculator:tip', 10)
  const [tax, setTax] = useLocalStorage('lab:tip-calculator:tax', 0)
  const [people, setPeople] = useLocalStorage('lab:tip-calculator:people', 2)
  const [roundUp, setRoundUp] = useLocalStorage('lab:tip-calculator:roundUp', false)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:tip-calculator:history', [])
  const [error, setError] = useState('')

  const calc = useMemo(() => {
    const taxAmt = (bill * tax) / 100
    const sub = bill + taxAmt
    const tipAmt = (sub * tip) / 100
    let total = sub + tipAmt
    if (roundUp) total = Math.ceil(total)
    const n = Math.max(1, people)
    const baseEach = Math.floor((total / n) * 100) / 100
    const rows = Array.from({ length: n }, (_, i) => {
      const isLast = i === n - 1
      const amount = isLast ? Math.round((total - baseEach * (n - 1)) * 100) / 100 : baseEach
      const tipShare = Math.round((tipAmt / n) * 100) / 100
      const billShare = Math.round((bill / n) * 100) / 100
      const taxShare = Math.round((taxAmt / n) * 100) / 100
      return { person: i + 1, billShare, taxShare, tipShare, amount }
    })
    return { taxAmt, tipAmt, total, sub, rows, n, perPerson: baseEach }
  }, [bill, tip, tax, people, roundUp])

  const summary = [
    `帳單 $${bill.toFixed(2)}`,
    `稅 $${calc.taxAmt.toFixed(2)}（${tax}%）`,
    `小費 $${calc.tipAmt.toFixed(2)}（${tip}%）`,
    roundUp ? '總額已進位' : null,
    `總計 $${calc.total.toFixed(2)}`,
    `${calc.n} 人分帳`,
    ...calc.rows.map((r) => `#${r.person} 應付 $${r.amount.toFixed(2)}`),
  ]
    .filter(Boolean)
    .join('\n')

  const canSave = !error && Number.isFinite(bill) && bill >= 0

  function setNum(
    raw: string,
    min: number,
    max: number,
    set: (n: number) => void,
  ) {
    const n = parseNumber(raw)
    if (!Number.isFinite(n)) {
      setError('請輸入有效數字')
      return
    }
    setError('')
    set(clamp(n, min, max))
  }

  function saveHistory() {
    if (!canSave) return
    setHistory((h) =>
      [
        {
          id: uid('tip'),
          at: Date.now(),
          bill,
          tip,
          tax,
          people: calc.n,
          roundUp,
          tipAmt: calc.tipAmt,
          taxAmt: calc.taxAmt,
          total: calc.total,
          perPerson: calc.perPerson,
        },
        ...h,
      ].slice(0, 30),
    )
  }

  function restore(item: HistoryItem) {
    setBill(clamp(item.bill, 0, BILL_MAX))
    setTip(clamp(item.tip, 0, PCT_MAX))
    setTax(clamp(item.tax, 0, PCT_MAX))
    setPeople(clamp(item.people, PEOPLE_MIN, PEOPLE_MAX))
    setRoundUp(item.roundUp)
    setError('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={saveHistory} disabled={!canSave}>
            存入歷史
          </button>
          <button type="button" className="btn sm ghost" onClick={() => void copyText(summary)}>
            複製明細
          </button>
        </div>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="grid-2">
          <label className="stack">
            <span className="label">帳單金額</span>
            <input
              className={`field${error ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={BILL_MAX}
              step={0.01}
              value={bill}
              onChange={(e) => setNum(e.target.value, 0, BILL_MAX, setBill)}
            />
            <p className="field-hint">0–{BILL_MAX.toLocaleString()}</p>
          </label>
          <label className="stack">
            <span className="label">稅金 %（可選）</span>
            <input
              className={`field${error ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={PCT_MAX}
              value={tax}
              onChange={(e) => setNum(e.target.value, 0, PCT_MAX, setTax)}
            />
            <p className="field-hint">0–{PCT_MAX}%</p>
          </label>
          <label className="stack">
            <span className="label">小費 %</span>
            <input
              className={`field${error ? ' is-invalid' : ''}`}
              type="number"
              min={0}
              max={PCT_MAX}
              value={tip}
              onChange={(e) => setNum(e.target.value, 0, PCT_MAX, setTip)}
            />
            <p className="field-hint">0–{PCT_MAX}%</p>
          </label>
          <label className="stack">
            <span className="label">分帳人數</span>
            <input
              className={`field${error ? ' is-invalid' : ''}`}
              type="number"
              min={PEOPLE_MIN}
              max={PEOPLE_MAX}
              value={people}
              onChange={(e) => setNum(e.target.value, PEOPLE_MIN, PEOPLE_MAX, setPeople)}
            />
            <p className="field-hint">{PEOPLE_MIN}–{PEOPLE_MAX} 人</p>
          </label>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div>
          <div className="label">小費預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {TIP_PRESETS.map((p) => (
              <button key={p} type="button" className={`btn sm ${tip === p ? 'accent' : 'ghost'}`} onClick={() => setTip(p)}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">人數快捷</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PEOPLE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`btn sm ${people === p ? 'accent' : 'ghost'}`}
                onClick={() => setPeople(p)}
              >
                {p} 人
              </button>
            ))}
          </div>
        </div>

        <label className="row">
          <input type="checkbox" checked={roundUp} onChange={() => setRoundUp(!roundUp)} />
          總額無條件進位到整數
        </label>

        <div className="grid-3">
          <div className="metric">
            <div className="muted">稅金</div>
            <div style={{ fontSize: 22 }}>${calc.taxAmt.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="muted">小費</div>
            <div style={{ fontSize: 22 }}>${calc.tipAmt.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="muted">總計{roundUp ? '（已進位）' : ''}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>${calc.total.toFixed(2)}</div>
            {calc.n > 1 && <div className="muted">約每人 ${calc.perPerson.toFixed(2)}</div>}
          </div>
        </div>

        {calc.n > 1 && (
          <>
            <h3 style={{ margin: '4px 0 0' }}>每人分帳明細</h3>
            <div className="panel" style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr className="muted" style={{ textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>人</th>
                    <th style={{ padding: '10px 12px' }}>帳單</th>
                    <th style={{ padding: '10px 12px' }}>稅</th>
                    <th style={{ padding: '10px 12px' }}>小費</th>
                    <th style={{ padding: '10px 12px' }}>應付</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map((r) => (
                    <tr key={r.person} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 12px' }}>#{r.person}</td>
                      <td className="mono" style={{ padding: '10px 12px' }}>
                        ${r.billShare.toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '10px 12px' }}>
                        ${r.taxShare.toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '10px 12px' }}>
                        ${r.tipShare.toFixed(2)}
                      </td>
                      <td className="mono" style={{ padding: '10px 12px', fontWeight: 700 }}>
                        ${r.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              最後一人會吸收四捨五入差額，確保加總等於總計。
            </p>
          </>
        )}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={saveHistory} disabled={!canSave}>
            存入歷史
          </button>
          <button type="button" className="btn ghost" onClick={() => void copyText(summary)}>
            複製明細
          </button>
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label" style={{ margin: 0 }}>
            計算歷史
          </div>
          <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
            清空
          </button>
        </div>
        <ul className="list">
          {history.map((h) => (
            <li key={h.id} className="list-item row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>${h.total.toFixed(2)}</strong>
                <span className="muted">
                  {' '}
                  · 帳單 ${h.bill.toFixed(2)} · 小費 {h.tip}% · {h.people} 人
                  {h.roundUp ? ' · 進位' : ''}
                </span>
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(h.at).toLocaleString('zh-TW')} · 約每人 ${h.perPerson.toFixed(2)}
                </div>
              </div>
              <div className="row">
                <button type="button" className="btn sm ghost" onClick={() => restore(h)}>
                  套用
                </button>
                <button type="button" className="btn sm danger" onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}>
                  刪除
                </button>
              </div>
            </li>
          ))}
          {!history.length && <li className="list-item muted">尚無歷史，按「存入歷史」保留這次計算</li>}
        </ul>
      </div>
    </ProjectShell>
  )
}
