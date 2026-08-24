import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('db-schema-viz')!

type Col = { name: string; type: string; pk?: boolean }
type Table = { id: string; name: string; cols: Col[]; x: number; y: number }

export default function Page() {
  const [tables, setTables] = useLocalStorage<Table[]>('lab:db-schema-viz', [
    {
      id: '1',
      name: 'users',
      x: 40,
      y: 40,
      cols: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
      ],
    },
    {
      id: '2',
      name: 'orders',
      x: 320,
      y: 80,
      cols: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid' },
        { name: 'total', type: 'numeric' },
      ],
    },
  ])

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="btn accent"
          onClick={() =>
            setTables((xs) => [
              ...xs,
              { id: uid('t'), name: `table_${xs.length + 1}`, x: 80 + xs.length * 24, y: 160, cols: [{ name: 'id', type: 'int', pk: true }] },
            ])
          }
        >
          新增資料表
        </button>
      </div>
      <div className="panel" style={{ position: 'relative', minHeight: 420, background: 'repeating-linear-gradient(0deg,#1e293b 0,#1e293b 1px,transparent 1px,transparent 24px),repeating-linear-gradient(90deg,#1e293b 0,#1e293b 1px,transparent 1px,transparent 24px)' }}>
        {tables.map((t) => (
          <div
            key={t.id}
            className="panel"
            style={{ position: 'absolute', left: t.x, top: t.y, width: 200, padding: 0, overflow: 'hidden' }}
          >
            <div className="row" style={{ background: '#0ea5e9', color: '#fff', padding: '8px 10px', justifyContent: 'space-between' }}>
              <input
                style={{ background: 'transparent', border: 0, color: '#fff', fontWeight: 700, width: 120 }}
                value={t.name}
                onChange={(e) => setTables((xs) => xs.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
              />
              <button type="button" className="btn sm ghost" style={{ color: '#fff' }} onClick={() => setTables((xs) => xs.filter((x) => x.id !== t.id))}>
                ×
              </button>
            </div>
            <ul className="list" style={{ margin: 0 }}>
              {t.cols.map((c, i) => (
                <li key={i} className="list-item row" style={{ justifyContent: 'space-between', padding: '6px 10px' }}>
                  <span>
                    {c.pk && <span className="tag">PK</span>} {c.name}
                  </span>
                  <span className="mono muted">{c.type}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn sm ghost"
              style={{ width: '100%' }}
              onClick={() =>
                setTables((xs) =>
                  xs.map((x) => (x.id === t.id ? { ...x, cols: [...x.cols, { name: 'col', type: 'text' }] } : x)),
                )
              }
            >
              + 欄位
            </button>
          </div>
        ))}
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
          {tables.length >= 2 && (
            <line x1={tables[0]!.x + 200} y1={tables[0]!.y + 60} x2={tables[1]!.x} y2={tables[1]!.y + 60} stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" />
          )}
        </svg>
      </div>
    </ProjectShell>
  )
}
