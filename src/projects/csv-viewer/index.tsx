import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'

const fallback: ProjectMeta = {
  slug: 'csv-viewer',
  title: 'CSV Viewer',
  description: 'CSV 表格預覽、搜尋排序與欄位統計',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['data'],
}
const meta = getProject('csv-viewer') ?? fallback

const MAX = 300_000
const FILE_MAX = 8 * 1024 * 1024
type PreviewLimit = 50 | 100 | 500 | 'all'
type ViewMode = 'split' | 'edit' | 'table'
type SortDir = 'asc' | 'desc' | null

const SAMPLES: { label: string; delim: string; body: string }[] = [
  {
    label: '人員',
    delim: ',',
    body: `name,age,city,score
Ada,36,Taipei,92
Lin,28,Kaohsiung,88
Mei,41,Taichung,95
Ken,33,Tainan,76`,
  },
  {
    label: 'TSV',
    delim: '\t',
    body: `sku\tqty\tprice
A-01\t12\t199
B-02\t4\t89
C-03\t0\t45`,
  },
  {
    label: '分號歐規',
    delim: ';',
    body: `produkt;preis;land
Käse;3,50;DE
Brot;2,20;AT
Milch;1,10;CH`,
  },
  {
    label: '含引號',
    delim: ',',
    body: `id,note,tag
1,"hello, world",ok
2,"line
break",warn
3,"quote ""here""",ok`,
  },
]

const DELIMS: { id: string; label: string }[] = [
  { id: ',', label: '逗號 ,' },
  { id: ';', label: '分號 ;' },
  { id: '\t', label: 'Tab' },
  { id: '|', label: '管線 |' },
]

function detectDelim(text: string) {
  const sample = text.replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 8).join('\n')
  const candidates = [',', ';', '\t', '|'] as const
  let best: string = ','
  let bestScore = -1
  for (const d of candidates) {
    const counts = sample.split(/\r?\n/).map((line) => {
      let n = 0
      let q = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') q = !q
        else if (!q && ch === d) n++
      }
      return n
    })
    const nonzero = counts.filter((c) => c > 0)
    if (!nonzero.length) continue
    const first = nonzero[0]!
    const consistent = nonzero.every((c) => c === first)
    const score = first * (consistent ? 10 : 1) + nonzero.length
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

function colStats(values: string[]) {
  const nonEmpty = values.filter((v) => v.trim().length > 0)
  const empty = values.length - nonEmpty.length
  const unique = new Set(nonEmpty).size
  const nums = nonEmpty
    .map((v) => Number(String(v).replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
  const numeric = nums.length >= Math.max(1, Math.floor(nonEmpty.length * 0.6))
  let min = 0
  let max = 0
  let avg = 0
  if (numeric && nums.length) {
    min = Math.min(...nums)
    max = Math.max(...nums)
    avg = nums.reduce((s, n) => s + n, 0) / nums.length
  }
  return { nonEmpty: nonEmpty.length, empty, unique, numeric, min, max, avg, sample: nonEmpty.slice(0, 3) }
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:csv-viewer:input',
    'name,age,city\nAda,36,Taipei\nLin,28,Kaohsiung',
  )
  const [delim, setDelim] = useLocalStorage('lab:csv-viewer:delim', ',')
  const [previewLimit, setPreviewLimit] = useLocalStorage<PreviewLimit>('lab:csv-viewer:preview', 100)
  const [hasHeader, setHasHeader] = useLocalStorage('lab:csv-viewer:header', true)
  const [wrap, setWrap] = useLocalStorage('lab:csv-viewer:wrap', false)
  const [view, setView] = useLocalStorage<ViewMode>('lab:csv-viewer:view', 'split')
  const [query, setQuery] = useState('')
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [activeCol, setActiveCol] = useState(0)

  const parsed = useMemo(() => {
    if (!isNonEmpty(input)) return { rows: null as string[][] | null, err: '' }
    try {
      const rows = parseCsv(input, delim || ',')
      if (!rows.length) return { rows: null, err: '無資料列' }
      return { rows, err: '' }
    } catch (e) {
      return { rows: null, err: e instanceof Error ? e.message : '解析失敗' }
    }
  }, [input, delim])

  const rows = parsed.rows
  const headers = useMemo(() => {
    if (!rows?.length) return [] as string[]
    if (hasHeader) {
      return rows[0]!.map((h, i) => h.trim() || `欄 ${i + 1}`)
    }
    return rows[0]!.map((_, i) => `欄 ${i + 1}`)
  }, [rows, hasHeader])

  const dataRows = useMemo(() => {
    if (!rows?.length) return [] as string[][]
    return hasHeader ? rows.slice(1) : rows
  }, [rows, hasHeader])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return dataRows
    return dataRows.filter((r) => r.some((c) => c.toLowerCase().includes(q)))
  }, [dataRows, query])

  const sorted = useMemo(() => {
    if (sortCol == null || !sortDir) return filtered
    const idx = sortCol
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[idx] ?? ''
      const bv = b[idx] ?? ''
      const an = Number(String(av).replace(/,/g, ''))
      const bn = Number(String(bv).replace(/,/g, ''))
      if (Number.isFinite(an) && Number.isFinite(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        return (an - bn) * dir
      }
      return av.localeCompare(bv, 'zh-Hant', { numeric: true }) * dir
    })
  }, [filtered, sortCol, sortDir])

  const visible = useMemo(() => {
    if (previewLimit === 'all') return sorted
    return sorted.slice(0, previewLimit)
  }, [sorted, previewLimit])

  const truncated = previewLimit !== 'all' && sorted.length > previewLimit

  const jagged = useMemo(() => {
    if (!rows?.length) return false
    const w = rows[0]!.length
    return rows.some((r) => r.length !== w)
  }, [rows])

  const stats = useMemo(() => {
    if (!headers.length) return null
    const col = Math.min(Math.max(0, activeCol), headers.length - 1)
    const values = dataRows.map((r) => r[col] ?? '')
    return { col, name: headers[col]!, ...colStats(values) }
  }, [headers, dataRows, activeCol])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function toggleSort(col: number) {
    setActiveCol(col)
    if (sortCol !== col) {
      setSortCol(col)
      setSortDir('asc')
      return
    }
    if (sortDir === 'asc') setSortDir('desc')
    else if (sortDir === 'desc') {
      setSortCol(null)
      setSortDir(null)
    } else setSortDir('asc')
  }

  function exportVisible() {
    if (!headers.length) return
    const out = hasHeader ? [headers, ...visible] : visible
    downloadText('csv-preview.csv', stringifyCsv(out, delim || ','), 'text/csv;charset=utf-8')
  }

  function applySample(s: (typeof SAMPLES)[number]) {
    setInput(s.body)
    setDelim(s.delim)
    setHint(`已套用「${s.label}」範例`)
    setError('')
    setQuery('')
    setSortCol(null)
    setSortDir(null)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row csvv-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!rows}
            onClick={() => void copyVal(stringifyCsv(hasHeader ? [headers, ...sorted] : sorted, delim || ','), 'all')}
            icon="copy"
          >
            {copied === 'all' ? '已複製' : '複製全部'}
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!visible.length} onClick={exportVisible} icon="download">
            匯出預覽
          </ActionButton>
        </div>
      }
    >
      <div className="csvv-calc">
        <div className="panel csvv-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row csvv-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '輸入'],
                  ['table', '表格'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-stats">
            <span className="tag">{dataRows.length.toLocaleString()} 資料列</span>
            <span className="tag">{headers.length} 欄</span>
            {query.trim() && <span className="tag">篩選後 {filtered.length}</span>}
            {jagged && <span className="tag csvv-tag-warn">欄數不一致</span>}
            {truncated && <span className="tag muted">預覽 {visible.length}</span>}
          </div>

          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button key={s.label} type="button" className="btn sm ghost" onClick={() => applySample(s)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">分隔符</div>
            <div className="pw-chips">
              {DELIMS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`btn sm ${delim === d.id ? 'accent' : 'ghost'}`}
                  onClick={() => setDelim(d.id)}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  const d = detectDelim(input)
                  setDelim(d)
                  setHint(`已偵測分隔符：${d === '\t' ? 'Tab' : d}`)
                }}
              >
                自動偵測
              </button>
            </div>
          </div>

          <div className="pw-block">
            <div className="label">預覽列數</div>
            <div className="pw-chips">
              {([50, 100, 500, 'all'] as const).map((n) => (
                <button
                  key={String(n)}
                  type="button"
                  className={`btn sm ${previewLimit === n ? 'accent' : 'ghost'}`}
                  onClick={() => setPreviewLimit(n)}
                >
                  {n === 'all' ? '全部' : `前 ${n}`}
                </button>
              ))}
            </div>
          </div>

          <div className="row csvv-options">
            <label className="csvv-check">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              第一列為表頭
            </label>
            <label className="csvv-check">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
              儲存格換行
            </label>
          </div>
        </div>

        <div className={`csvv-main csvv-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel csvv-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">輸入</h3>
                <ActionButton
                  className="btn sm ghost"
                  icon="trash"
                  disabled={!input}
                  onClick={() => {
                    setInput('')
                    setHint('')
                    setError('')
                    setQuery('')
                  }}
                >
                  清除
                </ActionButton>
              </div>

              {(error || parsed.err) && <p className="field-error">{error || parsed.err}</p>}
              {hint && !error && !parsed.err && <p className="field-hint">{hint}</p>}

              <FileDrop
                accept=".csv,text/csv,.tsv,text/tab-separated-values,.txt,text/plain"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 CSV／TSV，或點擊選擇"
                hint={`上限 ${formatBytes(FILE_MAX)}`}
                onFiles={(files) => {
                  void (async () => {
                    const f = files[0]
                    if (!f) return
                    setBusy(true)
                    setError('')
                    try {
                      const text = limitText(await f.text(), MAX)
                      setInput(text)
                      if (/\.tsv$/i.test(f.name)) setDelim('\t')
                      else {
                        const d = detectDelim(text)
                        setDelim(d)
                      }
                      setHint(`已載入「${f.name}」`)
                      setQuery('')
                      setSortCol(null)
                      setSortDir(null)
                    } catch {
                      setError('讀取失敗')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              />

              <label className="stack">
                <span className="label">CSV 內容</span>
                <textarea
                  className={`field mono csvv-textarea${!isNonEmpty(input) ? ' is-invalid' : ''}`}
                  value={input}
                  maxLength={MAX}
                  disabled={busy}
                  spellCheck={false}
                  onChange={(e) => {
                    setInput(limitText(e.target.value, MAX))
                    setError('')
                  }}
                  aria-label="CSV 內容"
                />
                <div className="field-meta">
                  <span>RFC4180 引號欄位</span>
                  <span>
                    {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                  </span>
                </div>
              </label>

              {stats && (
                <div className="csvv-col-card">
                  <div className="label">欄位統計 · {stats.name}</div>
                  <ul className="pw-info-list">
                    <li>
                      <span className="muted">非空／空值</span>
                      <strong>
                        {stats.nonEmpty} / {stats.empty}
                      </strong>
                    </li>
                    <li>
                      <span className="muted">不重複</span>
                      <strong>{stats.unique}</strong>
                    </li>
                    <li>
                      <span className="muted">型態</span>
                      <strong>{stats.numeric ? '偏數值' : '文字為主'}</strong>
                    </li>
                    {stats.numeric && (
                      <li>
                        <span className="muted">min／avg／max</span>
                        <strong className="mono">
                          {stats.min} / {Number(stats.avg.toFixed(4))} / {stats.max}
                        </strong>
                      </li>
                    )}
                    {stats.sample.length > 0 && (
                      <li>
                        <span className="muted">樣本</span>
                        <strong className="mono">{stats.sample.join(' · ')}</strong>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </section>
          )}

          {(view === 'split' || view === 'table') && (
            <section className="panel csvv-table-panel">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">表格</h3>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!visible.length}
                    onClick={() => void copyVal(stringifyCsv(hasHeader ? [headers, ...visible] : visible, delim || ','), 'vis')}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'vis' ? '已複製' : '複製預覽'}
                  />
                  <ActionButton className="btn sm ghost" disabled={!visible.length} onClick={exportVisible} icon="download" iconOnly tooltip="匯出預覽" />
                </div>
              </div>

              <label className="stack">
                <span className="label">搜尋（篩選列）</span>
                <input
                  className="field"
                  value={query}
                  maxLength={120}
                  placeholder="關鍵字…"
                  onChange={(e) => setQuery(limitText(e.target.value, 120))}
                  disabled={!rows}
                />
              </label>

              {rows ? (
                <>
                  <p className="muted csvv-table-meta">
                    顯示 {visible.length.toLocaleString()} / {sorted.length.toLocaleString()} 列
                    {truncated ? `（上限前 ${previewLimit}）` : ''}
                    {sortCol != null && sortDir ? ` · 依「${headers[sortCol]}」${sortDir === 'asc' ? '升冪' : '降冪'}` : ''}
                  </p>
                  <div className={`csvv-table-wrap${wrap ? ' is-wrap' : ''}`}>
                    <table className="csvv-table">
                      <thead>
                        <tr>
                          <th className="csvv-rownum">#</th>
                          {headers.map((h, j) => (
                            <th key={j}>
                              <button
                                type="button"
                                className={`csvv-th${activeCol === j ? ' is-active' : ''}`}
                                onClick={() => toggleSort(j)}
                              >
                                <span>{h}</span>
                                <span className="muted">
                                  {sortCol === j ? (sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '') : ''}
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r, i) => (
                          <tr key={i}>
                            <td className="csvv-rownum muted">{i + 1}</td>
                            {headers.map((_, j) => (
                              <td
                                key={j}
                                className={`mono${activeCol === j ? ' is-active' : ''}`}
                                onClick={() => setActiveCol(j)}
                                title={r[j] ?? ''}
                              >
                                {r[j] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {!visible.length && (
                          <tr>
                            <td colSpan={headers.length + 1} className="muted">
                              沒有符合搜尋的列
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  貼上或上傳 CSV 後顯示表格
                </p>
              )}
            </section>
          )}
        </div>

        <section className="panel csvv-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">解析</span>
              <strong>RFC4180 風格（引號、跳脫、欄內換行）；可選逗號／分號／Tab／管線</strong>
            </li>
            <li>
              <span className="muted">目前資料</span>
              <strong>
                {rows
                  ? `${dataRows.length.toLocaleString()} 列 × ${headers.length} 欄${jagged ? '（有列欄數不一致）' : ''}`
                  : '尚無有效表格'}
              </strong>
            </li>
            <li>
              <span className="muted">表頭</span>
              <strong>{hasHeader ? '第一列作為欄名' : '自動命名「欄 n」'}</strong>
            </li>
            <li>
              <span className="muted">效能</span>
              <strong>預設限制預覽列數；「全部」可能造成大型 CSV 卡頓</strong>
            </li>
            <li>
              <span className="muted">排序</span>
              <strong>點欄名切換升／降／取消；可辨識數字與文字</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機解析，不上傳伺服器</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>要改儲存格請用 CSV Editor；去重清理用 CSV 清理器；轉 JSON／TSV 有專用工具</strong>
            </li>
            <li>
              <span className="muted">相關工具</span>
              <strong>CSV Editor、CSV 清理器、CSV → JSON、CSV → TSV</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
