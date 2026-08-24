import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('sql-playground')!

type Row = { id: number; name: string; role: string; score: number }

const TABLE: Row[] = [
  { id: 1, name: 'Ada', role: 'admin', score: 92 },
  { id: 2, name: 'Ben', role: 'user', score: 71 },
  { id: 3, name: 'Cara', role: 'user', score: 88 },
  { id: 4, name: 'Dan', role: 'editor', score: 64 },
  { id: 5, name: 'Eve', role: 'admin', score: 95 },
]

function runSelect(sql: string): { cols: string[]; rows: Record<string, string | number>[]; error?: string } {
  const q = sql.trim().replace(/;$/, '')
  const m = q.match(/^select\s+(.+?)\s+from\s+users(?:\s+where\s+(.+))?$/i)
  if (!m) return { cols: [], rows: [], error: '僅支援：SELECT <cols> FROM users [WHERE col = value | col > n]' }
  const colPart = m[1]!.trim()
  const where = m[2]?.trim()
  let rows = [...TABLE] as Row[]
  if (where) {
    const eq = where.match(/^(\w+)\s*=\s*'?([^']+)'?$/i)
    const gt = where.match(/^(\w+)\s*>\s*(\d+)$/i)
    const lt = where.match(/^(\w+)\s*<\s*(\d+)$/i)
    if (eq) {
      const [, col, val] = eq
      rows = rows.filter((r) => String((r as Record<string, unknown>)[col!.toLowerCase()]).toLowerCase() === val!.toLowerCase())
    } else if (gt) {
      const [, col, val] = gt
      rows = rows.filter((r) => Number((r as Record<string, unknown>)[col!.toLowerCase()]) > Number(val))
    } else if (lt) {
      const [, col, val] = lt
      rows = rows.filter((r) => Number((r as Record<string, unknown>)[col!.toLowerCase()]) < Number(val))
    } else return { cols: [], rows: [], error: 'WHERE 僅支援 = / > / <' }
  }
  const cols = colPart === '*' ? ['id', 'name', 'role', 'score'] : colPart.split(',').map((c) => c.trim().toLowerCase())
  return {
    cols,
    rows: rows.map((r) => Object.fromEntries(cols.map((c) => [c, (r as Record<string, string | number>)[c]]))),
  }
}

export default function Page() {
  const [sql, setSql] = useLocalStorage('lab:sql-playground', "SELECT * FROM users WHERE role = 'admin'")
  const [result, setResult] = useState<ReturnType<typeof runSelect> | null>(null)
  const preview = useMemo(() => TABLE, [])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">記憶體資料表 users</div>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                {['id', 'name', 'role', 'score'].map((c) => (
                  <th key={c} className="mono">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.role}</td>
                  <td>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel stack">
          <textarea className="field mono" rows={4} value={sql} onChange={(e) => setSql(e.target.value)} />
          <button type="button" className="btn accent" onClick={() => setResult(runSelect(sql))}>
            執行
          </button>
          {result?.error && <p style={{ color: '#f87171' }}>{result.error}</p>}
          {result && !result.error && (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  {result.cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    {result.cols.map((c) => (
                      <td key={c}>{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
