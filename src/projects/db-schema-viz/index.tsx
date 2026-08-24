import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid } from '../../lib/utils'

const meta = getProject('db-schema-viz')!

type Col = { id: string; name: string; type: string; pk?: boolean; fk?: string }
type Table = { id: string; name: string; cols: Col[]; x: number; y: number }

const TYPES = ['uuid', 'text', 'int', 'numeric', 'bool', 'timestamptz']

const DEFAULT_TABLES: Table[] = [
  {
    id: 'users',
    name: 'users',
    x: 40,
    y: 40,
    cols: [
      { id: 'c1', name: 'id', type: 'uuid', pk: true },
      { id: 'c2', name: 'email', type: 'text' },
      { id: 'c3', name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    id: 'orders',
    name: 'orders',
    x: 320,
    y: 40,
    cols: [
      { id: 'c4', name: 'id', type: 'uuid', pk: true },
      { id: 'c5', name: 'user_id', type: 'uuid', fk: 'users.id' },
      { id: 'c6', name: 'total', type: 'numeric' },
      { id: 'c6b', name: 'status', type: 'text' },
    ],
  },
  {
    id: 'items',
    name: 'order_items',
    x: 600,
    y: 60,
    cols: [
      { id: 'c7', name: 'id', type: 'uuid', pk: true },
      { id: 'c8', name: 'order_id', type: 'uuid', fk: 'orders.id' },
      { id: 'c9', name: 'product_id', type: 'uuid', fk: 'products.id' },
      { id: 'c10', name: 'qty', type: 'int' },
    ],
  },
  {
    id: 'products',
    name: 'products',
    x: 600,
    y: 280,
    cols: [
      { id: 'c11', name: 'id', type: 'uuid', pk: true },
      { id: 'c12', name: 'sku', type: 'text' },
      { id: 'c13', name: 'price', type: 'numeric' },
      { id: 'c14', name: 'category_id', type: 'uuid', fk: 'categories.id' },
    ],
  },
  {
    id: 'categories',
    name: 'categories',
    x: 320,
    y: 300,
    cols: [
      { id: 'c15', name: 'id', type: 'uuid', pk: true },
      { id: 'c16', name: 'name', type: 'text' },
    ],
  },
  {
    id: 'payments',
    name: 'payments',
    x: 40,
    y: 280,
    cols: [
      { id: 'c17', name: 'id', type: 'uuid', pk: true },
      { id: 'c18', name: 'order_id', type: 'uuid', fk: 'orders.id' },
      { id: 'c19', name: 'amount', type: 'numeric' },
      { id: 'c20', name: 'paid_at', type: 'timestamptz' },
    ],
  },
]

function toMermaid(tables: Table[]) {
  const lines = ['erDiagram']
  for (const t of tables) {
    lines.push(`  ${t.name} {`)
    for (const c of t.cols) {
      const flags = [c.pk ? 'PK' : '', c.fk ? 'FK' : ''].filter(Boolean).join(',')
      lines.push(`    ${c.type} ${c.name}${flags ? ` ${flags}` : ''}`)
    }
    lines.push('  }')
  }
  for (const t of tables) {
    for (const c of t.cols) {
      if (!c.fk) continue
      const [refTable] = c.fk.split('.')
      if (refTable) lines.push(`  ${t.name} }o--|| ${refTable} : "${c.name}"`)
    }
  }
  return lines.join('\n')
}

export default function Page() {
  const [tables, setTables] = useLocalStorage<Table[]>('lab:db-schema-viz:v2', DEFAULT_TABLES)
  const [relFrom, setRelFrom] = useState('')
  const [relTo, setRelTo] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const pkOptions = useMemo(
    () =>
      tables.flatMap((t) =>
        t.cols.filter((c) => c.pk).map((c) => ({ value: `${t.name}.${c.name}`, label: `${t.name}.${c.name}` })),
      ),
    [tables],
  )

  const colOptions = useMemo(
    () => tables.flatMap((t) => t.cols.map((c) => ({ value: `${t.id}:${c.id}`, label: `${t.name}.${c.name}` }))),
    [tables],
  )

  const relations = useMemo(() => {
    const lines: { from: Table; to: Table; label: string; fromId: string; toId: string }[] = []
    for (const t of tables) {
      for (const c of t.cols) {
        if (!c.fk) continue
        const [refTable] = c.fk.split('.')
        const target = tables.find((x) => x.name === refTable || x.id === refTable)
        if (target) lines.push({ from: t, to: target, label: `${t.name}.${c.name} → ${c.fk}`, fromId: t.id, toId: target.id })
      }
    }
    return lines
  }, [tables])

  const mermaid = useMemo(() => toMermaid(tables), [tables])

  const relatedIds = useMemo(() => {
    if (!selected) return new Set<string>()
    const ids = new Set<string>([selected])
    for (const r of relations) {
      if (r.fromId === selected) ids.add(r.toId)
      if (r.toId === selected) ids.add(r.fromId)
    }
    return ids
  }, [selected, relations])

  function addTable() {
    const id = uid('t')
    setTables((xs) => [
      ...xs,
      {
        id,
        name: `table_${xs.length + 1}`,
        x: 60 + (xs.length % 4) * 40,
        y: 200 + xs.length * 12,
        cols: [{ id: uid('c'), name: 'id', type: 'int', pk: true }],
      },
    ])
    setSelected(id)
  }

  function updateCol(tableId: string, colId: string, patch: Partial<Col>) {
    setTables((xs) =>
      xs.map((t) => (t.id === tableId ? { ...t, cols: t.cols.map((c) => (c.id === colId ? { ...c, ...patch } : c)) } : t)),
    )
  }

  function linkRelation() {
    if (!relFrom || !relTo) return
    const [tid, cid] = relFrom.split(':')
    setTables((xs) =>
      xs.map((t) => (t.id === tid ? { ...t, cols: t.cols.map((c) => (c.id === cid ? { ...c, fk: relTo } : c)) } : t)),
    )
    if (tid) setSelected(tid)
    setRelFrom('')
    setRelTo('')
  }

  async function copyMermaid() {
    await copyText(mermaid)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={copyMermaid}>
            {copied ? '已複製' : '複製 Mermaid'}
          </button>
          <button type="button" className="btn sm teal" onClick={() => downloadText('schema.mmd', mermaid, 'text/plain;charset=utf-8')}>
            匯出 Mermaid
          </button>
          <button type="button" className="btn accent sm" onClick={addTable}>
            新增資料表
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>
          定義關聯
        </span>
        <select className="field" style={{ minWidth: 160 }} value={relFrom} onChange={(e) => setRelFrom(e.target.value)}>
          <option value="">來源欄位</option>
          {colOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="muted">→</span>
        <select className="field" style={{ minWidth: 160 }} value={relTo} onChange={(e) => setRelTo(e.target.value)}>
          <option value="">目標 PK</option>
          {pkOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn sm teal" onClick={linkRelation}>
          建立 FK
        </button>
        <span className="muted">
          {tables.length} 表 · {relations.length} 關聯
        </span>
        {selected && (
          <button type="button" className="btn sm ghost" onClick={() => setSelected(null)}>
            取消選取
          </button>
        )}
      </div>

      <div
        className="panel"
        style={{
          position: 'relative',
          minHeight: 520,
          overflow: 'auto',
          background:
            'repeating-linear-gradient(0deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 24px)',
        }}
        onClick={() => setSelected(null)}
      >
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {relations.map((r, i) => {
            const active = !selected || relatedIds.has(r.fromId) || relatedIds.has(r.toId)
            const focus = selected && (r.fromId === selected || r.toId === selected)
            return (
              <g key={i}>
                <line
                  x1={r.from.x + 110}
                  y1={r.from.y + 50}
                  x2={r.to.x + 110}
                  y2={r.to.y + 50}
                  stroke={focus ? 'var(--accent)' : 'var(--sky)'}
                  strokeWidth={focus ? 3 : 2}
                  strokeDasharray="6 4"
                  opacity={active ? 1 : 0.2}
                />
                <title>{r.label}</title>
              </g>
            )
          })}
        </svg>

        {tables.map((t) => {
          const isSel = selected === t.id
          const isRel = relatedIds.has(t.id)
          return (
            <div
              key={t.id}
              className="panel"
              style={{
                position: 'absolute',
                left: t.x,
                top: t.y,
                width: 220,
                padding: 0,
                overflow: 'hidden',
                zIndex: isSel ? 3 : 1,
                outline: isSel ? '2px solid var(--accent)' : isRel && selected ? '2px solid var(--sky)' : undefined,
                boxShadow: isSel ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)' : undefined,
                opacity: !selected || isRel ? 1 : 0.45,
              }}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(t.id)
              }}
            >
              <div className="row" style={{ background: 'var(--ink)', color: '#fff', padding: '8px 10px', justifyContent: 'space-between' }}>
                <input
                  style={{ background: 'transparent', border: 0, color: '#fff', fontWeight: 700, width: 130 }}
                  value={t.name}
                  onChange={(e) => setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className="btn sm ghost"
                  style={{ color: '#fff' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTables((xs) => xs.filter((x) => x.id !== t.id))
                    if (selected === t.id) setSelected(null)
                  }}
                >
                  ×
                </button>
              </div>
              <div className="row" style={{ padding: '4px 8px', gap: 4 }}>
                <input
                  className="field"
                  type="number"
                  title="x"
                  value={t.x}
                  onChange={(e) => setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, x: Number(e.target.value) } : x)))}
                  style={{ width: 70, padding: 4 }}
                />
                <input
                  className="field"
                  type="number"
                  title="y"
                  value={t.y}
                  onChange={(e) => setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, y: Number(e.target.value) } : x)))}
                  style={{ width: 70, padding: 4 }}
                />
              </div>
              <ul className="list" style={{ margin: 0 }}>
                {t.cols.map((c) => (
                  <li key={c.id} className="list-item stack" style={{ padding: '6px 10px', gap: 4 }}>
                    <div className="row">
                      <label className="row" title="Primary key">
                        <input type="checkbox" checked={!!c.pk} onChange={(e) => updateCol(t.id, c.id, { pk: e.target.checked })} />
                        PK
                      </label>
                      {c.fk && <span className="tag">FK</span>}
                      <input
                        className="field"
                        value={c.name}
                        onChange={(e) => updateCol(t.id, c.id, { name: e.target.value })}
                        style={{ flex: 1, padding: 4 }}
                      />
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() =>
                          setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, cols: x.cols.filter((col) => col.id !== c.id) } : x)))
                        }
                      >
                        ×
                      </button>
                    </div>
                    <div className="row">
                      <select className="field" value={c.type} onChange={(e) => updateCol(t.id, c.id, { type: e.target.value })} style={{ flex: 1, padding: 4 }}>
                        {TYPES.map((ty) => (
                          <option key={ty}>{ty}</option>
                        ))}
                      </select>
                      <input
                        className="field mono"
                        placeholder="fk table.col"
                        value={c.fk || ''}
                        onChange={(e) => updateCol(t.id, c.id, { fk: e.target.value || undefined })}
                        style={{ flex: 1, padding: 4, fontSize: 11 }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn sm ghost"
                style={{ width: '100%' }}
                onClick={() =>
                  setTables((xs) =>
                    xs.map((x) => (x.id === t.id ? { ...x, cols: [...x.cols, { id: uid('c'), name: 'col', type: 'text' }] } : x)),
                  )
                }
              >
                + 欄位
              </button>
            </div>
          )
        })}
      </div>

      <div className="grid-2" style={{ marginTop: 8 }}>
        <ul className="list">
          {relations.map((r, i) => (
            <li
              key={i}
              className="list-item muted mono"
              style={{
                fontSize: 12,
                cursor: 'pointer',
                outline: selected && (r.fromId === selected || r.toId === selected) ? '1px solid var(--accent)' : undefined,
              }}
              onClick={() => setSelected(r.fromId)}
            >
              {r.label}
            </li>
          ))}
          {!relations.length && <li className="list-item muted">尚無關聯</li>}
        </ul>
        <pre className="panel mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 11, maxHeight: 220, overflow: 'auto' }}>
          {mermaid}
        </pre>
      </div>
    </ProjectShell>
  )
}
