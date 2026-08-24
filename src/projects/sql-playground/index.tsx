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
  { id: 6, name: 'Finn', role: 'editor', score: 77 },
  { id: 7, name: 'Gina', role: 'user', score: 55 },
]

const EXAMPLES = [
  "SELECT * FROM users WHERE role = 'admin'",
  'SELECT name, score FROM users WHERE score > 80 ORDER BY score DESC',
  "SELECT * FROM users WHERE role = 'user' ORDER BY name ASC LIMIT 2",
  'SELECT id, name FROM users WHERE score >= 70 AND score < 90',
]

function getVal(row: Row, col: string) {
  return (row as Record<string, string | number>)[col.toLowerCase()]
}

function runSelect(sql: string): { cols: string[]; rows: Record<string, string | number>[]; error?: string } {
  const q = sql.trim().replace(/;$/, '')
  const m = q.match(
    /^select\s+(.+?)\s+from\s+users(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i,
  )
  if (!m) {
    return {
      cols: [],
      rows: [],
      error: '支援：SELECT cols FROM users [WHERE ...] [ORDER BY col ASC|DESC] [LIMIT n]',
    }
  }

  const colPart = m[1]!.trim()
  const where = m[2]?.trim()
  const orderCol = m[3]?.toLowerCase()
  const orderDir = (m[4] || 'asc').toLowerCase()
  const limit = m[5] ? Number(m[5]) : undefined

  let rows = [...TABLE]

  if (where) {
    const parts = where.split(/\s+and\s+/i)
    for (const part of parts) {
      const eq = part.match(/^(\w+)\s*=\s*'?([^']+)'?$/i)
      const cmp = part.match(/^(\w+)\s*(>=|<=|>|<)\s*(\d+)$/i)
      const like = part.match(/^(\w+)\s+like\s+'%?([^%']+)%?'$/i)
      if (eq) {
        const [, col, val] = eq
        rows = rows.filter((r) => String(getVal(r, col!)).toLowerCase() === val!.toLowerCase())
      } else if (cmp) {
        const [, col, op, val] = cmp
        const n = Number(val)
        rows = rows.filter((r) => {
          const v = Number(getVal(r, col!))
          if (op === '>') return v > n
          if (op === '<') return v < n
          if (op === '>=') return v >= n
          return v <= n
        })
      } else if (like) {
        const [, col, val] = like
        rows = rows.filter((r) => String(getVal(r, col!)).toLowerCase().includes(val!.toLowerCase()))
      } else {
        return { cols: [], rows: [], error: `無法解析 WHERE：${part}` }
      }
    }
  }

  if (orderCol) {
    rows.sort((a, b) => {
      const av = getVal(a, orderCol)
      const bv = getVal(b, orderCol)
      if (typeof av === 'number' && typeof bv === 'number') return orderDir === 'desc' ? bv - av : av - bv
      return orderDir === 'desc'
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv))
    })
  }

  if (limit !== undefined) rows = rows.slice(0, limit)

  const cols = colPart === '*' ? ['id', 'name', 'role', 'score'] : colPart.split(',').map((c) => c.trim().toLowerCase())
  for (const c of cols) {
    if (!['id', 'name', 'role', 'score'].includes(c)) {
      return { cols: [], rows: [], error: `未知欄位：${c}` }
    }
  }

  return {
    cols,
    rows: rows.map((r) => Object.fromEntries(cols.map((c) => [c, getVal(r, c)!]))),
  }
}

export default function Page() {
  const [sql, setSql] = useLocalStorage('lab:sql-playground', EXAMPLES[0]!)
  const [result, setResult] = useState<ReturnType<typeof runSelect> | null>(null)
  const preview = useMemo(() => TABLE, [])

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="btn sm ghost" onClick={() => setSql(ex)}>
            {ex.slice(0, 28)}…
          </button>
        ))}
      </div>
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
          <p className="muted" style={{ fontSize: 12 }}>
            WHERE 支援 = / &gt; / &lt; / &gt;= / &lt;= / LIKE，以及 AND；另支援 ORDER BY、LIMIT
          </p>
        </div>
        <div className="panel stack">
          <textarea className="field mono" rows={5} value={sql} onChange={(e) => setSql(e.target.value)} />
          <button type="button" className="btn accent" onClick={() => setResult(runSelect(sql))}>
            執行
          </button>
          {result?.error && <p style={{ color: 'var(--rose)' }}>{result.error}</p>}
          {result && !result.error && (
            <>
              <div className="muted">{result.rows.length} rows</div>
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
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
