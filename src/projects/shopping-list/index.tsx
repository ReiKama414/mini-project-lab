import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('shopping-list')!

type Item = {
  id: string
  name: string
  aisle: string
  done: boolean
  qty: string
}

const AISLES = ['生鮮蔬果', '肉類海鮮', '乳製品', '乾貨雜糧', '零食飲料', '日用品', '冷凍', '其他']

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
    if (!name.trim()) return
    setItems([{ id: uid('shop'), name: name.trim(), aisle, done: false, qty: qty.trim() || '1' }, ...items])
    setName('')
  }

  function checkAll(done: boolean) {
    setItems(items.map((i) => (filterAisle === 'all' || i.aisle === filterAisle ? { ...i, done } : i)))
  }

  async function shareText() {
    const lines = ['購物清單', '────────']
    const groups: [string, Item[]][] = byAisle.length ? [...byAisle] : [['全部', visible]]
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
          <input
            className="field"
            style={{ flex: 1, minWidth: 120 }}
            placeholder="品項"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input className="field" style={{ width: 80 }} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="數量" />
          <select className="field" style={{ maxWidth: 140 }} value={aisle} onChange={(e) => setAisle(e.target.value)}>
            {AISLES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn accent" onClick={add}>
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
          <button className="btn sm ghost" onClick={() => checkAll(true)}>
            全部勾選
          </button>
          <button className="btn sm ghost" onClick={() => checkAll(false)}>
            全部取消
          </button>
          <button
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
