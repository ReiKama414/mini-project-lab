import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('invoice-generator')!

type Line = { id: string; desc: string; qty: number; price: number }

export default function Page() {
  const [client, setClient] = useLocalStorage('lab:invoice:client', '客戶有限公司')
  const [from, setFrom] = useLocalStorage('lab:invoice:from', 'Freelancer Kamay')
  const [invNo, setInvNo] = useLocalStorage('lab:invoice:no', 'INV-2026-001')
  const [lines, setLines] = useLocalStorage<Line[]>('lab:invoice:lines', [
    { id: '1', desc: '網站設計', qty: 1, price: 25000 },
    { id: '2', desc: '前端實作', qty: 20, price: 1800 },
  ])

  const total = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines])

  function exportTxt() {
    const body = [
      `發票編號：${invNo}`,
      `開立者：${from}`,
      `客戶：${client}`,
      '',
      ...lines.map((l) => `${l.desc} × ${l.qty} @ ${l.price} = ${l.qty * l.price}`),
      '',
      `合計：$${total.toLocaleString()}`,
    ].join('\n')
    downloadText(`${invNo}.txt`, body)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn accent sm" onClick={exportTxt}>下載發票</button>}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">發票編號</label>
          <input className="field" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <label className="label">開立者</label>
          <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="label">客戶</label>
          <input className="field" value={client} onChange={(e) => setClient(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setLines((xs) => [...xs, { id: uid('l'), desc: '新項目', qty: 1, price: 1000 }])}
          >
            加一行
          </button>
        </div>
        <div className="panel stack">
          {lines.map((l) => (
            <div key={l.id} className="row">
              <input className="field" style={{ flex: 2 }} value={l.desc} onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, desc: e.target.value } : x)))} />
              <input className="field" style={{ width: 70 }} type="number" value={l.qty} onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, qty: Number(e.target.value) || 0 } : x)))} />
              <input className="field" style={{ width: 100 }} type="number" value={l.price} onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
              <button type="button" className="btn sm danger" onClick={() => setLines((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
          <div className="metric">合計 ${total.toLocaleString()}</div>
        </div>
      </div>
    </ProjectShell>
  )
}
