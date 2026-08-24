import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, copyText, uid } from '../../lib/utils'

const meta = getProject('invoice-generator')!

type Line = { id: string; desc: string; qty: number; price: number }

export default function Page() {
  const [client, setClient] = useLocalStorage('lab:invoice:client', '客戶有限公司')
  const [from, setFrom] = useLocalStorage('lab:invoice:from', 'Freelancer Kamay')
  const [invNo, setInvNo] = useLocalStorage('lab:invoice:no', 'INV-2026-001')
  const [taxRate, setTaxRate] = useLocalStorage('lab:invoice:tax', 5)
  const [note, setNote] = useLocalStorage('lab:invoice:note', '感謝惠顧，付款期限 14 天。')
  const [lines, setLines] = useLocalStorage<Line[]>('lab:invoice:lines', [
    { id: '1', desc: '網站設計', qty: 1, price: 25000 },
    { id: '2', desc: '前端實作', qty: 20, price: 1800 },
  ])

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines])
  const tax = useMemo(() => Math.round(subtotal * (taxRate / 100)), [subtotal, taxRate])
  const total = subtotal + tax

  function bodyTxt() {
    return [
      `發票編號：${invNo}`,
      `開立者：${from}`,
      `客戶：${client}`,
      '',
      ...lines.map((l) => `${l.desc} × ${l.qty} @ $${l.price.toLocaleString()} = $${(l.qty * l.price).toLocaleString()}`),
      '',
      `小計：$${subtotal.toLocaleString()}`,
      `稅額（${taxRate}%）：$${tax.toLocaleString()}`,
      `合計：$${total.toLocaleString()}`,
      '',
      note,
    ].join('\n')
  }

  function bodyMd() {
    return [
      `# 發票 ${invNo}`,
      '',
      `- 開立者：${from}`,
      `- 客戶：${client}`,
      '',
      '| 項目 | 數量 | 單價 | 金額 |',
      '| --- | ---: | ---: | ---: |',
      ...lines.map((l) => `| ${l.desc} | ${l.qty} | ${l.price} | ${l.qty * l.price} |`),
      '',
      `| 小計 | | | $${subtotal.toLocaleString()} |`,
      `| 稅 ${taxRate}% | | | $${tax.toLocaleString()} |`,
      `| **合計** | | | **$${total.toLocaleString()}** |`,
      '',
      note,
    ].join('\n')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => copyText(bodyTxt())}>
            複製
          </button>
          <button type="button" className="btn ghost sm" onClick={() => downloadText(`${invNo}.txt`, bodyTxt())}>
            下載 TXT
          </button>
          <button type="button" className="btn accent sm" onClick={() => downloadText(`${invNo}.md`, bodyMd(), 'text/markdown;charset=utf-8')}>
            下載 MD
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">發票編號</label>
          <input className="field" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <label className="label">開立者</label>
          <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="label">客戶</label>
          <input className="field" value={client} onChange={(e) => setClient(e.target.value)} />
          <label className="label">稅率 %</label>
          <input className="field" type="number" min={0} max={40} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} />
          <label className="label">備註</label>
          <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setLines((xs) => [...xs, { id: uid('l'), desc: '新項目', qty: 1, price: 1000 }])}
          >
            加一行
          </button>
          {lines.map((l) => (
            <div key={l.id} className="row">
              <input
                className="field"
                style={{ flex: 2 }}
                value={l.desc}
                onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, desc: e.target.value } : x)))}
              />
              <input
                className="field"
                style={{ width: 70 }}
                type="number"
                value={l.qty}
                onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, qty: Number(e.target.value) || 0 } : x)))}
              />
              <input
                className="field"
                style={{ width: 100 }}
                type="number"
                value={l.price}
                onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, price: Number(e.target.value) || 0 } : x)))}
              />
              <button type="button" className="btn sm danger" onClick={() => setLines((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="panel stack">
          <div className="label">預覽</div>
          <h3 style={{ margin: 0 }}>{invNo}</h3>
          <div className="muted">
            {from} → {client}
          </div>
          <ul className="list">
            {lines.map((l) => (
              <li key={l.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
                <span>
                  {l.desc} × {l.qty}
                </span>
                <span className="mono">${(l.qty * l.price).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">小計</span>
            <span className="mono">${subtotal.toLocaleString()}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">稅（{taxRate}%）</span>
            <span className="mono">${tax.toLocaleString()}</span>
          </div>
          <div className="metric">合計 ${total.toLocaleString()}</div>
          <p className="muted">{note}</p>
        </div>
      </div>
    </ProjectShell>
  )
}
