import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, copyText, uid, charCount, clamp, isNonEmpty, limitText, parseNumber } from '../../lib/utils'

const meta = getProject('invoice-generator')!

type Line = { id: string; desc: string; qty: number; price: number }
type Currency = 'TWD' | 'USD' | 'EUR' | 'JPY'

const CURRENCY_META: Record<Currency, { symbol: string; locale: string }> = {
  TWD: { symbol: 'NT$', locale: 'zh-TW' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
  JPY: { symbol: '¥', locale: 'ja-JP' },
}

const MAX_LINES = 50
const MAX_TEXT = 80
const MAX_NOTE = 500
const MAX_DESC = 120
const MAX_QTY = 100000
const MAX_PRICE = 1_000_000_000

export default function Page() {
  const [client, setClient] = useLocalStorage('lab:invoice:client', '客戶有限公司')
  const [from, setFrom] = useLocalStorage('lab:invoice:from', 'Freelancer Kamay')
  const [invNo, setInvNo] = useLocalStorage('lab:invoice:no', 'INV-2026-001')
  const [taxRate, setTaxRate] = useLocalStorage('lab:invoice:tax', 5)
  const [currency, setCurrency] = useLocalStorage<Currency>('lab:invoice:currency', 'TWD')
  const [note, setNote] = useLocalStorage('lab:invoice:note', '感謝惠顧，付款期限 14 天。')
  const [lines, setLines] = useLocalStorage<Line[]>('lab:invoice:lines', [
    { id: '1', desc: '網站設計', qty: 1, price: 25000 },
    { id: '2', desc: '前端實作', qty: 20, price: 1800 },
  ])

  const metaCur = CURRENCY_META[currency]
  const fmt = (n: number) => `${metaCur.symbol}${n.toLocaleString(metaCur.locale)}`

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines])
  const tax = useMemo(() => Math.round(subtotal * (taxRate / 100)), [subtotal, taxRate])
  const total = subtotal + tax
  const invOk = isNonEmpty(invNo)
  const fromOk = isNonEmpty(from)
  const clientOk = isNonEmpty(client)
  const taxOk = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 40
  const linesOk = lines.length > 0 && lines.every((l) => isNonEmpty(l.desc) && l.qty >= 0 && l.price >= 0)
  const canExport = invOk && fromOk && clientOk && taxOk && linesOk

  function bodyTxt() {
    return [
      `發票編號：${invNo}`,
      `開立者：${from}`,
      `客戶：${client}`,
      `幣別：${currency}`,
      '',
      ...lines.map((l) => `${l.desc} × ${l.qty} @ ${fmt(l.price)} = ${fmt(l.qty * l.price)}`),
      '',
      `小計：${fmt(subtotal)}`,
      `稅額（${taxRate}%）：${fmt(tax)}`,
      `合計：${fmt(total)}`,
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
      `- 幣別：${currency}`,
      '',
      '| 項目 | 數量 | 單價 | 金額 |',
      '| --- | ---: | ---: | ---: |',
      ...lines.map((l) => `| ${l.desc} | ${l.qty} | ${l.price} | ${l.qty * l.price} |`),
      '',
      `| 小計 | | | ${fmt(subtotal)} |`,
      `| 稅 ${taxRate}% | | | ${fmt(tax)} |`,
      `| **合計** | | | **${fmt(total)}** |`,
      '',
      note,
    ].join('\n')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!canExport} onClick={() => void copyText(bodyTxt())}>
            複製
          </button>
          <button type="button" className="btn ghost sm" disabled={!canExport} onClick={() => downloadText(`${invNo}.txt`, bodyTxt())}>
            下載 TXT
          </button>
          <button type="button" className="btn accent sm" disabled={!canExport} onClick={() => downloadText(`${invNo}.md`, bodyMd(), 'text/markdown;charset=utf-8')}>
            下載 MD
          </button>
          <button type="button" className="btn ghost sm" disabled={!canExport} onClick={() => window.print()}>
            列印／另存 PDF
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack no-print">
          <label className="label">發票編號</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${!invOk ? ' is-invalid' : ''}`} value={invNo} maxLength={MAX_TEXT} onChange={(e) => setInvNo(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span className={!invOk ? 'warn' : undefined}>{!invOk ? '必填' : ' '}</span><span>{charCount(invNo)} / {MAX_TEXT}</span></div>
          </div>
          <label className="label">開立者</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${!fromOk ? ' is-invalid' : ''}`} value={from} maxLength={MAX_TEXT} onChange={(e) => setFrom(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span /><span>{charCount(from)} / {MAX_TEXT}</span></div>
          </div>
          <label className="label">客戶</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${!clientOk ? ' is-invalid' : ''}`} value={client} maxLength={MAX_TEXT} onChange={(e) => setClient(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span /><span>{charCount(client)} / {MAX_TEXT}</span></div>
          </div>
          <div className="row">
            <label className="stack" style={{ flex: 1 }}>
              <span className="label">稅率 %</span>
              <input className={`field${!taxOk ? ' is-invalid' : ''}`} type="number" min={0} max={40} value={taxRate} onChange={(e) => { const n = parseNumber(e.target.value); setTaxRate(!Number.isFinite(n) ? 0 : clamp(n, 0, 40)) }} />
            </label>
            <label className="stack" style={{ flex: 1 }}>
              <span className="label">幣別</span>
              <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                {(['TWD', 'USD', 'EUR', 'JPY'] as Currency[]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">備註</label>
          <div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={2} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(limitText(e.target.value, MAX_NOTE))} />
            <div className="field-meta"><span /><span>{charCount(note)} / {MAX_NOTE}</span></div>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={lines.length >= MAX_LINES}
            onClick={() => setLines((xs) => xs.length >= MAX_LINES ? xs : [...xs, { id: uid('l'), desc: '新項目', qty: 1, price: 1000 }])}
          >
            加一行
          </button>
          {lines.length >= MAX_LINES && <p className="field-error">已達上限 {MAX_LINES} 行</p>}
          {lines.map((l) => (
            <div key={l.id} className="row">
              <input
                className="field"
                style={{ flex: 2 }}
                value={l.desc}
                maxLength={MAX_DESC} onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, desc: limitText(e.target.value, MAX_DESC) } : x)))}
              />
              <input
                className="field"
                style={{ width: 70 }}
                type="number"
                value={l.qty}
                min={0} max={MAX_QTY} onChange={(e) => { const n = parseNumber(e.target.value); setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, qty: !Number.isFinite(n) ? 0 : clamp(n, 0, MAX_QTY) } : x))) }}
              />
              <input
                className="field"
                style={{ width: 100 }}
                type="number"
                value={l.price}
                min={0} max={MAX_PRICE} onChange={(e) => { const n = parseNumber(e.target.value); setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, price: !Number.isFinite(n) ? 0 : clamp(n, 0, MAX_PRICE) } : x))) }}
              />
              <button type="button" className="btn sm danger" onClick={() => setLines((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="panel stack invoice-print-area">
          <div className="muted no-print">預覽 · {currency}</div>
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
                <span className="mono">{fmt(l.qty * l.price)}</span>
              </li>
            ))}
          </ul>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">小計</span>
            <span className="mono">{fmt(subtotal)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">稅（{taxRate}%）</span>
            <span className="mono">{fmt(tax)}</span>
          </div>
          <div className="metric">合計 {fmt(total)}</div>
          <p className="muted">{note}</p>
        </div>
      </div>
    </ProjectShell>
  )
}
