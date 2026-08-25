import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, uid } from '../../lib/utils'

const meta = getProject('shopping-list')!

type Item = {
  id: string
  name: string
  aisle: string
  done: boolean
  qty: string
}

const AISLES = ['生鮮蔬果', '肉類海鮮', '乳製品', '乾貨雜糧', '零食飲料', '日用品', '冷凍', '其他']
const MAX_ITEMS = 200
const MAX_NAME = 80
const MAX_QTY = 20

const LEGACY_AISLE: Record<string, string> = {
  生鮮: '生鮮蔬果',
  日用品: '日用品',
  零食: '零食飲料',
  其他: '其他',
}

function normalizeItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x: Record<string, unknown>) => {
    const aisleRaw = String(x.aisle ?? x.category ?? '其他')
    return {
      id: String(x.id ?? uid('shop')),
      name: String(x.name ?? ''),
      aisle: LEGACY_AISLE[aisleRaw] ?? (AISLES.includes(aisleRaw) ? aisleRaw : '其他'),
      done: Boolean(x.done),
      qty: String(x.qty ?? '1'),
    }
  })
}

export default function Page() {
  const [stored, setStored] = useLocalStorage<unknown>('lab:shopping-list', [])
  const items = normalizeItems(stored)
  const setItems = (next: Item[] | ((prev: Item[]) => Item[])) => {
    setStored(typeof next === 'function' ? next(items) : next)
  }
  const [name, setName] = useState('')
  const [aisle, setAisle] = useState(AISLES[0]!)
  const [qty, setQty] = useState('1')
  const [filterAisle, setFilterAisle] = useState('all')
  const [copied, setCopied] = useState(false)

  const nameOk = isNonEmpty(name)
  const qtyOk = isNonEmpty(qty)
  const atLimit = items.length >= MAX_ITEMS
  const canAdd = nameOk && qtyOk && !atLimit

  const pending = items.filter((i) => !i.done).length
  const doneCount = items.length - pending

  const visible = useMemo(
    () => (filterAisle === 'all' ? items : items.filter((i) => i.aisle === filterAisle)),
    [items, filterAisle],
  )

  const byAisle = useMemo(() => {
    const map: Record<string, Item[]> = {}
    for (const i of visible) {
      ;(map[i.aisle] ??= []).push(i)
    }
    return AISLES.filter((a) => map[a]?.length).map((a) => [a, map[a]!] as const)
  }, [visible])

  function add() {
    if (!canAdd) return
    setItems([{ id: uid('shop'), name: name.trim(), aisle, done: false, qty: qty.trim() }, ...items])
    setName('')
  }

  function checkAll(done: boolean) {
    setItems(items.map((i) => (filterAisle === 'all' || i.aisle === filterAisle ? { ...i, done } : i)))
  }

  async function shareText() {
    const lines = ['購物清單', '────────']
    const groups: [string, Item[]][] = byAisle.length
      ? byAisle.map(([a, list]) => [a, list])
      : [['全部', visible]]
    for (const [a, list] of groups) {
      lines.push(`【${a}】`)
      for (const i of list) {
        lines.push(`${i.done ? '☑' : '☐'} ${i.name} ×${i.qty}`)
      }
      lines.push('')
    }
    if (!visible.length) lines.push('（空白）')
    await copyText(lines.join('\n').trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={shareText}>
          {copied ? '已複製！' : '複製分享文字'}
        </button>
      }
    >
      <div className="panel stack">
        <div className="row">
          <div className="metric" style={{ fontSize: 22 }}>
            未購 {pending}
          </div>
          <span className="tag">已購 {doneCount}</span>
          <span className="muted">共 {items.length} 項</span>
        </div>
        <div className="row">
          <div className="field-wrap" style={{ flex: 1, minWidth: 120 }}>
            <input
              className={`field${name.length > 0 && !nameOk ? ' is-invalid' : ''}`}
              style={{ width: '100%' }}
              placeholder="品項"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(limitText(e.target.value, MAX_NAME))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <div className="field-meta">
              <span className={atLimit || (!nameOk && name.length > 0) ? 'warn' : undefined}>
                {atLimit
                  ? `已達上限 ${MAX_ITEMS} 項`
                  : !nameOk && name.length > 0
                    ? '請輸入品項'
                    : '\u00a0'}
              </span>
              <span>
                {charCount(name)} / {MAX_NAME} · 數量 {charCount(qty)} / {MAX_QTY}
              </span>
            </div>
          </div>
          <input
            className={`field${!qtyOk ? ' is-invalid' : ''}`}
            style={{ width: 80 }}
            value={qty}
            maxLength={MAX_QTY}
            onChange={(e) => setQty(limitText(e.target.value, MAX_QTY))}
            placeholder="數量"
          />
          <select className="field" style={{ maxWidth: 140 }} value={aisle} onChange={(e) => setAisle(e.target.value)}>
            {AISLES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="button" className="btn accent" onClick={add} disabled={!canAdd}>
            加入
          </button>
        </div>
        <div className="row">
          <select
            className="field"
            style={{ maxWidth: 160 }}
            value={filterAisle}
            onChange={(e) => setFilterAisle(e.target.value)}
          >
            <option value="all">所有走道</option>
            {AISLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="btn sm ghost" onClick={() => checkAll(true)}>
            全部勾選
          </button>
          <button type="button" className="btn sm ghost" onClick={() => checkAll(false)}>
            全部取消
          </button>
          <button
            type="button"
            className="btn sm ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => setItems(items.filter((i) => !i.done))}
          >
            清除已購
          </button>
        </div>
      </div>

      <div className="panel stack">
        {byAisle.map(([a, list]) => (
          <div key={a} className="stack" style={{ gap: 6 }}>
            <strong>
              {a}
              <span className="muted" style={{ fontWeight: 500, marginLeft: 8 }}>
                {list.filter((i) => !i.done).length}/{list.length}
              </span>
            </strong>
            <ul className="list">
              {list.map((i) => (
                <li key={i.id} className={`list-item ${i.done ? 'done' : ''}`}>
                  <label className="row" style={{ flex: 1, gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={i.done}
                      onChange={() => setItems(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))}
                    />
                    <span>
                      {i.name} ×{i.qty}
                    </span>
                  </label>
                  <button className="btn sm ghost" onClick={() => setItems(items.filter((x) => x.id !== i.id))}>
                    刪
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!visible.length && <p className="muted">清單是空的，開始加入品項吧</p>}
      </div>
    </ProjectShell>
  )
}
