import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('sql-playground')!

const SQL_MAX = 2000

type Row = { id: number; name: string; role: string; score: number }

const SCHEMA = [
  { name: 'id', type: 'INTEGER', pk: true, note: '主鍵' },
  { name: 'name', type: 'TEXT', pk: false, note: '顯示名稱' },
  { name: 'role', type: 'TEXT', pk: false, note: 'admin / user / editor' },
  { name: 'score', type: 'INTEGER', pk: false, note: '0–100' },
]

const TABLE: Row[] = [
  { id: 1, name: 'Ada', role: 'admin', score: 92 },
  { id: 2, name: 'Ben', role: 'user', score: 71 },
  { id: 3, name: 'Cara', role: 'user', score: 88 },
  { id: 4, name: 'Dan', role: 'editor', score: 64 },
  { id: 5, name: 'Eve', role: 'admin', score: 95 },
  { id: 6, name: 'Finn', role: 'editor', score: 77 },
  { id: 7, name: 'Gina', role: 'user', score: 55 },
  { id: 8, name: 'Hugo', role: 'user', score: 81 },
]

const EXAMPLES = [
  "SELECT * FROM users WHERE role = 'admin'",
  'SELECT name, score FROM users WHERE score > 80 ORDER BY score DESC',
  "SELECT * FROM users WHERE name LIKE '%a%' ORDER BY name ASC LIMIT 3",
  "SELECT * FROM users WHERE role = 'user' ORDER BY name ASC LIMIT 2",
  'SELECT id, name FROM users WHERE score >= 70 AND score < 90',
  'SELECT COUNT(*) FROM users',
  "SELECT COUNT(*) FROM users WHERE role = 'editor'",
  'SELECT COUNT(*) FROM users WHERE score >= 80',
  "SELECT name, role FROM users WHERE role = 'admin' AND score > 90",
]

function getVal(row: Row, col: string) {
  return (row as Record<string, string | number>)[col.toLowerCase()]
}

function runSelect(sql: string): { cols: string[]; rows: Record<string, string | number>[]; error?: string } {
  const q = sql.trim().replace(/;$/, '')
  if (!q) return { cols: [], rows: [], error: '請輸入 SQL' }
  if (!/^select\b/i.test(q)) return { cols: [], rows: [], error: '僅支援 SELECT 查詢' }

  const countM = q.match(
    /^select\s+count\s*\(\s*\*\s*\)\s+from\s+users(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+\w+(?:\s+(?:asc|desc))?)?(?:\s+limit\s+\d+)?$/i,
  )
  if (countM) {
    let rows = [...TABLE]
    const where = countM[1]?.trim()
    if (where) {
      const filtered = applyWhere(rows, where)
      if ('error' in filtered) return { cols: [], rows: [], error: filtered.error }
      rows = filtered
    }
    return { cols: ['count'], rows: [{ count: rows.length }] }
  }

  const m = q.match(
    /^select\s+(.+?)\s+from\s+users(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i,
  )
  if (!m) {
    return {
      cols: [],
      rows: [],
      error: '語法錯誤。支援：SELECT cols|COUNT(*) FROM users [WHERE ...] [ORDER BY col ASC|DESC] [LIMIT n]',
    }
  }

  const colPart = m[1]!.trim()
  const where = m[2]?.trim()
  const orderCol = m[3]?.toLowerCase()
  const orderDir = (m[4] || 'asc').toLowerCase()
  const limit = m[5] ? Number(m[5]) : undefined

  let rows = [...TABLE]

  if (where) {
    const filtered = applyWhere(rows, where)
    if ('error' in filtered) return { cols: [], rows: [], error: filtered.error }
    rows = filtered
  }

  if (orderCol) {
    if (!['id', 'name', 'role', 'score'].includes(orderCol)) {
      return { cols: [], rows: [], error: `ORDER BY 未知欄位：${orderCol}` }
    }
    rows.sort((a, b) => {
      const av = getVal(a, orderCol)
      const bv = getVal(b, orderCol)
      if (typeof av === 'number' && typeof bv === 'number') return orderDir === 'desc' ? bv - av : av - bv
      return orderDir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
    })
  }

  if (limit !== undefined) {
    if (Number.isNaN(limit) || limit < 0) return { cols: [], rows: [], error: 'LIMIT 必須為非負整數' }
    rows = rows.slice(0, limit)
  }

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

function applyWhere(rows: Row[], where: string): Row[] | { error: string } {
  const parts = where.split(/\s+and\s+/i)
  let out = [...rows]
  for (const part of parts) {
    const eq = part.match(/^(\w+)\s*=\s*'?([^']+)'?$/i)
    const cmp = part.match(/^(\w+)\s*(>=|<=|>|<)\s*(\d+)$/i)
    const like = part.match(/^(\w+)\s+like\s+'([^']*)'$/i)
    if (eq) {
      const [, col, val] = eq
      out = out.filter((r) => String(getVal(r, col!)).toLowerCase() === val!.toLowerCase())
    } else if (cmp) {
      const [, col, op, val] = cmp
      const n = Number(val)
      out = out.filter((r) => {
        const v = Number(getVal(r, col!))
        if (op === '>') return v > n
        if (op === '<') return v < n
        if (op === '>=') return v >= n
        return v <= n
      })
    } else if (like) {
      const [, col, pattern] = like
      const raw = pattern!
      const starts = raw.startsWith('%')
      const ends = raw.endsWith('%')
      const needle = raw.replace(/%/g, '').toLowerCase()
      out = out.filter((r) => {
        const v = String(getVal(r, col!)).toLowerCase()
        if (starts && ends) return v.includes(needle)
        if (starts) return v.endsWith(needle)
        if (ends) return v.startsWith(needle)
        return v === needle
      })
    } else {
      return { error: `無法解析 WHERE：${part}` }
    }
  }
  return out
}

function toCsv(cols: string[], rows: Record<string, string | number>[]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c]!)).join(','))].join('\n')
}

export default function Page() {
  const [sql, setSql] = useLocalStorage('lab:sql-playground', EXAMPLES[0]!)
  const [result, setResult] = useState<ReturnType<typeof runSelect> | null>(null)
  const [history, setHistory] = useLocalStorage<string[]>('lab:sql-playground:hist', [])
  const [showSchema, setShowSchema] = useLocalStorage('lab:sql-playground:schema', true)
  const preview = useMemo(() => TABLE, [])

  function run() {
    if (!isNonEmpty(sql)) {
      setResult({ cols: [], rows: [], error: '請輸入 SQL' })
      return
    }
    if (charCount(sql) > SQL_MAX) {
      setResult({ cols: [], rows: [], error: `SQL 超過 ${SQL_MAX} 字上限` })
      return
    }
    const q = limitText(sql, SQL_MAX)
    const r = runSelect(q)
    setResult(r)
    if (!r.error) setHistory((h) => [q.trim(), ...h.filter((x) => x !== q.trim())].slice(0, 12))
  }

  const canRun = isNonEmpty(sql) && charCount(sql) <= SQL_MAX

  function exportCsv() {
    if (!result || result.error || !result.cols.length) return
    downloadText('sql-result.csv', toCsv(result.cols, result.rows), 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm ghost" disabled={!result || !!result.error} onClick={exportCsv}>
          匯出 CSV
        </button>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="btn sm ghost" onClick={() => setSql(ex)} title={ex}>
            {ex.length > 36 ? `${ex.slice(0, 36)}…` : ex}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label" style={{ margin: 0 }}>
              記憶體資料表 users
            </div>
            <button type="button" className={`btn sm ${showSchema ? 'teal' : 'ghost'}`} onClick={() => setShowSchema((v) => !v)}>
              {showSchema ? '隱藏 Schema' : '顯示 Schema'}
            </button>
          </div>
          {showSchema && (
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  {['欄位', '型別', 'PK', '說明'].map((h) => (
                    <th key={h} className="mono">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCHEMA.map((c) => (
                  <tr key={c.name}>
                    <td className="mono">{c.name}</td>
                    <td className="mono muted">{c.type}</td>
                    <td>{c.pk ? '✓' : ''}</td>
                    <td className="muted">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            支援 COUNT(*)、WHERE（= / 比較 / LIKE / AND）、ORDER BY、LIMIT
          </p>
          {history.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="label" style={{ margin: 0 }}>
                  查詢歷史
                </div>
                <button type="button" className="btn sm ghost" onClick={() => setHistory([])}>
                  清空
                </button>
              </div>
              {history.map((h) => (
                <button key={h} type="button" className="btn sm ghost" style={{ textAlign: 'left' }} onClick={() => setSql(h)}>
                  <span className="mono" style={{ fontSize: 11 }}>
                    {h}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="panel stack">
          <textarea
            className={cn('field mono', (!isNonEmpty(sql) || charCount(sql) > SQL_MAX) && 'is-invalid')}
            rows={5}
            maxLength={SQL_MAX}
            value={sql}
            onChange={(e) => setSql(limitText(e.target.value, SQL_MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canRun) run()
            }}
          />
          <div className="field-meta">
            <span className={!canRun ? 'warn' : undefined}>{canRun ? '可執行' : '請輸入有效 SELECT（有長度上限）'}</span>
            <span>{charCount(sql)}/{SQL_MAX}</span>
          </div>
          {!isNonEmpty(sql) && <p className="field-error">SQL 不可空白</p>}
          <div className="row">
            <button type="button" className="btn accent" onClick={run} disabled={!canRun}>
              執行（Ctrl/⌘+Enter）
            </button>
            <button type="button" className="btn ghost sm" onClick={exportCsv} disabled={!result || !!result.error}>
              匯出結果 CSV
            </button>
          </div>
          {result?.error && <p className="field-error">SQL 錯誤：{result.error}</p>}
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
              {!result.rows.length && <p className="muted">查無資料</p>}
            </>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
