import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('db-schema-viz')!

type Col = { id: string; name: string; type: string; pk?: boolean; fk?: string }
type Table = { id: string; name: string; cols: Col[]; x: number; y: number }

export default function Page() {
  const [tables, setTables] = useLocalStorage<Table[]>('lab:db-schema-viz', [
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
      x: 340,
      y: 80,
      cols: [
        { id: 'c4', name: 'id', type: 'uuid', pk: true },
        { id: 'c5', name: 'user_id', type: 'uuid', fk: 'users.id' },
        { id: 'c6', name: 'total', type: 'numeric' },
      ],
    },
    {
      id: 'items',
      name: 'order_items',
      x: 640,
      y: 140,
      cols: [
        { id: 'c7', name: 'id', type: 'uuid', pk: true },
        { id: 'c8', name: 'order_id', type: 'uuid', fk: 'orders.id' },
        { id: 'c9', name: 'qty', type: 'int' },
      ],
    },
  ])

  const relations = useMemo(() => {
    const lines: { from: Table; to: Table; label: string }[] = []
    for (const t of tables) {
      for (const c of t.cols) {
        if (!c.fk) continue
        const [refTable] = c.fk.split('.')
        const target = tables.find((x) => x.name === refTable || x.id === refTable)
        if (target) lines.push({ from: t, to: target, label: `${c.name} → ${c.fk}` })
      }
    }
    return lines
  }, [tables])

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
  }

  function updateCol(tableId: string, colId: string, patch: Partial<Col>) {
    setTables((xs) =>
      xs.map((t) => (t.id === tableId ? { ...t, cols: t.cols.map((c) => (c.id === colId ? { ...c, ...patch } : c)) } : t)),
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn accent sm" onClick={addTable}>
          新增資料表
        </button>
      }
    >
      <div
        className="panel"
        style={{
          position: 'relative',
          minHeight: 480,
          overflow: 'auto',
          background:
            'repeating-linear-gradient(0deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, var(--line) 0, var(--line) 1px, transparent 1px, transparent 24px)',
        }}
      >
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {relations.map((r, i) => (
            <g key={i}>
              <line
                x1={r.from.x}
                y1={r.from.y + 50}
                x2={r.to.x + 200}
                y2={r.to.y + 50}
                stroke="var(--sky)"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <title>{r.label}</title>
            </g>
          ))}
        </svg>

        {tables.map((t) => (
          <div
            key={t.id}
            className="panel"
            style={{ position: 'absolute', left: t.x, top: t.y, width: 220, padding: 0, overflow: 'hidden', zIndex: 1 }}
          >
            <div className="row" style={{ background: 'var(--ink)', color: '#fff', padding: '8px 10px', justifyContent: 'space-between' }}>
              <input
                style={{ background: 'transparent', border: 0, color: '#fff', fontWeight: 700, width: 130 }}
                value={t.name}
                onChange={(e) => setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
              />
              <button type="button" className="btn sm ghost" style={{ color: '#fff' }} onClick={() => setTables((xs) => xs.filter((x) => x.id !== t.id))}>
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
                    {c.pk && <span className="tag">PK</span>}
                    {c.fk && <span className="tag">FK</span>}
                    <input
                      className="field"
                      value={c.name}
                      onChange={(e) => updateCol(t.id, c.id, { name: e.target.value })}
                      style={{ flex: 1, padding: 4 }}
                    />
                  </div>
                  <div className="row">
                    <select className="field" value={c.type} onChange={(e) => updateCol(t.id, c.id, { type: e.target.value })} style={{ flex: 1, padding: 4 }}>
                      {['uuid', 'text', 'int', 'numeric', 'bool', 'timestamptz'].map((ty) => (
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
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        關聯線依欄位 FK（例如 users.id）自動繪製 · 目前 {relations.length} 條
      </p>
    </ProjectShell>
  )
}
