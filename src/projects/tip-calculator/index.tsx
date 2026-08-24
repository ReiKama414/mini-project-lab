import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'

const meta = getProject('tip-calculator')!

export default function Page() {
  const [bill, setBill] = useState(1000)
  const [tip, setTip] = useState(10)
  const [tax, setTax] = useState(0)
  const [people, setPeople] = useState(2)
  const [roundUp, setRoundUp] = useState(false)

  const calc = useMemo(() => {
    const taxAmt = (bill * tax) / 100
    const sub = bill + taxAmt
    const tipAmt = (sub * tip) / 100
    let total = sub + tipAmt
    if (roundUp) total = Math.ceil(total)
    const per = people > 0 ? total / people : total
    const tipPer = people > 0 ? tipAmt / people : tipAmt
    return { taxAmt, tipAmt, total, per, tipPer, sub }
  }, [bill, tip, tax, people, roundUp])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span className="label">帳單金額</span>
            <input
              className="field"
              type="number"
              min={0}
              value={bill}
              onChange={(e) => setBill(Number(e.target.value))}
            />
          </label>
          <label className="stack">
            <span className="label">稅金 %（可選）</span>
            <input
              className="field"
              type="number"
              min={0}
              value={tax}
              onChange={(e) => setTax(Number(e.target.value))}
            />
          </label>
          <label className="stack">
            <span className="label">小費 %</span>
            <input
              className="field"
              type="number"
              min={0}
              value={tip}
              onChange={(e) => setTip(Number(e.target.value))}
            />
          </label>
          <label className="stack">
            <span className="label">分帳人數</span>
            <input
              className="field"
              type="number"
              min={1}
              value={people}
              onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>
        <div className="row">
          {[0, 5, 10, 12, 15, 18, 20].map((p) => (
            <button
              key={p}
              className={`btn sm ${tip === p ? 'accent' : 'ghost'}`}
              onClick={() => setTip(p)}
            >
              {p}%
            </button>
          ))}
        </div>
        <label className="row">
          <input type="checkbox" checked={roundUp} onChange={() => setRoundUp(!roundUp)} />
          總額無條件進位到整數
        </label>
        <div className="grid-3">
          <div className="metric">
            <div className="muted">稅金</div>
            <div style={{ fontSize: 22 }}>${calc.taxAmt.toFixed(0)}</div>
          </div>
          <div className="metric">
            <div className="muted">小費</div>
            <div style={{ fontSize: 22 }}>${calc.tipAmt.toFixed(0)}</div>
          </div>
          <div className="metric">
            <div className="muted">總計</div>
            <div style={{ fontSize: 22 }}>${calc.total.toFixed(0)}</div>
          </div>
          <div className="metric">
            <div className="muted">每人應付</div>
            <div style={{ fontSize: 22 }}>${calc.per.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="muted">每人小費</div>
            <div style={{ fontSize: 22 }}>${calc.tipPer.toFixed(2)}</div>
          </div>
          <div className="metric">
            <div className="muted">含稅小計</div>
            <div style={{ fontSize: 22 }}>${calc.sub.toFixed(0)}</div>
          </div>
        </div>
        <button
          className="btn ghost"
          onClick={() =>
            void copyText(
              `帳單 ${bill} · 稅 ${calc.taxAmt.toFixed(0)} · 小費 ${calc.tipAmt.toFixed(0)} · 總計 ${calc.total.toFixed(0)} · 每人 ${calc.per.toFixed(2)}`,
            )
          }
        >
          複製明細
        </button>
      </div>
    </ProjectShell>
  )
}
