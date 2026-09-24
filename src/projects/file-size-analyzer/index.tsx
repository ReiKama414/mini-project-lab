import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, formatBytes, uid } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'file-size-analyzer',
  title: '檔案大小分析',
  description: '本機分析多檔大小、佔比與副檔名分布',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['file'],
}
const meta = getProject('file-size-analyzer') ?? fallback

const MAX_FILES = 300
const FILE_MAX = 200 * 1024 * 1024

type Row = {
  id: string
  name: string
  size: number
  type: string
  ext: string
  lastModified: number
}

type SortKey = 'size-desc' | 'size-asc' | 'name' | 'ext' | 'type'
type UnitMode = 'auto' | 'b' | 'kb' | 'mb' | 'gb'
type GroupBy = 'ext' | 'type'
type ViewMode = 'split' | 'list' | 'chart'

function extOf(name: string) {
  const base = name.split(/[/\\]/).pop() || name
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return '(無副檔名)'
  return base.slice(dot).toLowerCase()
}

function formatFixed(bytes: number, unit: UnitMode) {
  if (unit === 'auto') {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
    return formatBytes(bytes)
  }
  if (unit === 'b') return `${bytes.toLocaleString()} B`
  if (unit === 'kb') return `${(bytes / 1024).toFixed(bytes < 1024 * 10 ? 2 : 1)} KB`
  if (unit === 'mb') return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(3)} GB`
}

function median(nums: number[]) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

const UNIT_CHIPS: { id: UnitMode; label: string }[] = [
  { id: 'auto', label: '自動' },
  { id: 'b', label: 'B' },
  { id: 'kb', label: 'KB' },
  { id: 'mb', label: 'MB' },
  { id: 'gb', label: 'GB' },
]

const SORT_CHIPS: { id: SortKey; label: string }[] = [
  { id: 'size-desc', label: '大小↓' },
  { id: 'size-asc', label: '大小↑' },
  { id: 'name', label: '名稱' },
  { id: 'ext', label: '副檔名' },
  { id: 'type', label: '類型' },
]

export default function Page() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [sort, setSort] = useLocalStorage<SortKey>('lab:file-size-analyzer:sort', 'size-desc')
  const [unit, setUnit] = useLocalStorage<UnitMode>('lab:file-size-analyzer:unit', 'auto')
  const [groupBy, setGroupBy] = useLocalStorage<GroupBy>('lab:file-size-analyzer:group', 'ext')
  const [filterExt, setFilterExt] = useLocalStorage<string>('lab:file-size-analyzer:filter', '')
  const [append, setAppend] = useLocalStorage('lab:file-size-analyzer:append', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:file-size-analyzer:view', 'split')

  const total = useMemo(() => rows.reduce((s, r) => s + r.size, 0), [rows])

  const extOptions = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.ext, (map.get(r.ext) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
  }, [rows])

  const filtered = useMemo(() => {
    if (!filterExt) return rows
    return rows.filter((r) => r.ext === filterExt)
  }, [rows, filterExt])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      if (sort === 'size-desc') return b.size - a.size
      if (sort === 'size-asc') return a.size - b.size
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-Hant')
      if (sort === 'ext') return a.ext.localeCompare(b.ext, 'en') || b.size - a.size
      return a.type.localeCompare(b.type, 'en') || b.size - a.size
    })
    return list
  }, [filtered, sort])

  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.size, 0), [filtered])

  const stats = useMemo(() => {
    if (!filtered.length) {
      return { count: 0, total: 0, avg: 0, med: 0, max: null as Row | null, min: null as Row | null }
    }
    const sizes = filtered.map((r) => r.size)
    let max = filtered[0]!
    let min = filtered[0]!
    for (const r of filtered) {
      if (r.size > max.size) max = r
      if (r.size < min.size) min = r
    }
    return {
      count: filtered.length,
      total: filteredTotal,
      avg: filteredTotal / filtered.length,
      med: median(sizes),
      max,
      min,
    }
  }, [filtered, filteredTotal])

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; size: number; count: number }>()
    for (const r of filtered) {
      const key = groupBy === 'ext' ? r.ext : r.type || 'unknown'
      const cur = map.get(key) || { key, size: 0, count: 0 }
      cur.size += r.size
      cur.count += 1
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.size - a.size)
  }, [filtered, groupBy])

  function onFiles(files: File[]) {
    if (!files.length) return
    if (files.length > MAX_FILES) {
      setError(`一次最多 ${MAX_FILES} 個檔案`)
      return
    }
    for (const f of files) {
      if (f.size > FILE_MAX) {
        setError(`「${f.name}」過大（單檔上限 ${formatBytes(FILE_MAX)}）`)
        return
      }
    }
    const next = files.map((f) => ({
      id: uid('f'),
      name: f.name,
      size: f.size,
      type: f.type || 'unknown',
      ext: extOf(f.name),
      lastModified: f.lastModified || 0,
    }))
    setError('')
    setRows((prev) => {
      const merged = append ? [...prev, ...next] : next
      if (merged.length > MAX_FILES) {
        setError(`合計最多 ${MAX_FILES} 個（目前會截斷）`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
    setHint(`已${append && rows.length ? '追加' : '載入'} ${next.length} 個檔案`)
  }

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function summaryText() {
    const lines = [
      `檔案數 ${stats.count}`,
      `總計 ${formatFixed(stats.total, unit)}`,
      `平均 ${formatFixed(stats.avg, unit)}`,
      `中位數 ${formatFixed(stats.med, unit)}`,
      stats.max ? `最大 ${stats.max.name}（${formatFixed(stats.max.size, unit)}）` : '',
      stats.min ? `最小 ${stats.min.name}（${formatFixed(stats.min.size, unit)}）` : '',
      '',
      ...sorted.map(
        (r) =>
          `${r.name}\t${formatFixed(r.size, unit)}\t${filteredTotal ? ((r.size / filteredTotal) * 100).toFixed(1) : 0}%\t${r.ext}\t${r.type}`,
      ),
    ].filter(Boolean)
    return lines.join('\n')
  }

  function downloadCsv() {
    const body = [
      'name,size_bytes,size_label,percent,ext,type,last_modified',
      ...sorted.map((r) => {
        const pct = filteredTotal ? ((r.size / filteredTotal) * 100).toFixed(2) : '0'
        const lm = r.lastModified ? new Date(r.lastModified).toISOString() : ''
        return `"${r.name.replace(/"/g, '""')}",${r.size},"${formatFixed(r.size, unit)}",${pct},"${r.ext}","${r.type}","${lm}"`
      }),
    ].join('\n')
    downloadText('file-size-analysis.csv', body, 'text/csv;charset=utf-8')
  }

  function clearAll() {
    setRows([])
    setFilterExt('')
    setError('')
    setHint('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row fsa-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!rows.length} onClick={clearAll} icon="trash">
            清除
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!sorted.length}
            onClick={() => void copyVal(summaryText(), 'sum')}
            icon="copy"
          >
            {copied === 'sum' ? '已複製' : '複製摘要'}
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!sorted.length} onClick={downloadCsv} icon="download">
            CSV
          </ActionButton>
        </div>
      }
    >
      <div className="fsa-calc">
        <div className="panel fsa-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row fsa-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['list', '清單'],
                  ['chart', '分布'],
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
            <span className="tag">{stats.count} 個檔案</span>
            <span className="tag">{formatFixed(stats.total, unit)}</span>
            {stats.count > 0 && <span className="tag">平均 {formatFixed(stats.avg, unit)}</span>}
            {filterExt && <span className="tag">篩選 {filterExt}</span>}
            {rows.length !== filtered.length && <span className="tag muted">全部 {rows.length}</span>}
          </div>

          <FileDrop
            multiple
            maxFiles={MAX_FILES}
            maxBytes={FILE_MAX}
            label="拖放檔案到此，或點擊選擇（可多選）"
            hint={`最多 ${MAX_FILES} 個 · 單檔上限 ${formatBytes(FILE_MAX)} · 僅讀大小／檔名`}
            onFiles={onFiles}
          />

          {error && <p className="field-error">{error}</p>}
          {hint && !error && <p className="field-hint">{hint}</p>}

          <div className="pw-block">
            <div className="label">單位</div>
            <div className="pw-chips">
              {UNIT_CHIPS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`btn sm ${unit === u.id ? 'accent' : 'ghost'}`}
                  onClick={() => setUnit(u.id)}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">排序</div>
            <div className="pw-chips">
              {SORT_CHIPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn sm ${sort === s.id ? 'accent' : 'ghost'}`}
                  onClick={() => setSort(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row fsa-options">
            <label className="fsa-check">
              <input type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} />
              追加到清單（關閉則覆蓋）
            </label>
          </div>

          {extOptions.length > 0 && (
            <div className="pw-block">
              <div className="label">副檔名篩選</div>
              <div className="pw-chips">
                <button
                  type="button"
                  className={`btn sm ${!filterExt ? 'accent' : 'ghost'}`}
                  onClick={() => setFilterExt('')}
                >
                  全部
                </button>
                {extOptions.map(([ext, n]) => (
                  <button
                    key={ext}
                    type="button"
                    className={`btn sm ${filterExt === ext ? 'accent' : 'ghost'}`}
                    onClick={() => setFilterExt(filterExt === ext ? '' : ext)}
                  >
                    {ext} ({n})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`fsa-main fsa-view-${view}`}>
          {(view === 'split' || view === 'list') && (
            <section className="panel fsa-list">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">檔案清單</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {sorted.length} 項
                </span>
              </div>

              <ul className="fsa-file-list">
                {sorted.map((r) => {
                  const pct = filteredTotal ? (r.size / filteredTotal) * 100 : 0
                  return (
                    <li key={r.id}>
                      <div className="fsa-file-head">
                        <strong className="mono fsa-name">{r.name}</strong>
                        <ActionButton
                          className="btn sm ghost"
                          icon="copy"
                          iconOnly
                          tooltip={copied === r.id ? '已複製' : '複製檔名'}
                          onClick={() => void copyVal(r.name, r.id)}
                        />
                      </div>
                      <div className="row fsa-file-meta">
                        <span className="tag">{formatFixed(r.size, unit)}</span>
                        <span className="tag">{pct.toFixed(1)}%</span>
                        <span className="tag">{r.ext}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {r.type}
                        </span>
                      </div>
                      <div className="fsa-bar" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
                {!sorted.length && (
                  <li className="muted" style={{ listStyle: 'none' }}>
                    尚未選擇檔案
                  </li>
                )}
              </ul>
            </section>
          )}

          {(view === 'split' || view === 'chart') && (
            <section className="panel fsa-side">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">統計與分布</h3>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className={`btn sm ${groupBy === 'ext' ? 'accent' : 'ghost'}`}
                    onClick={() => setGroupBy('ext')}
                  >
                    副檔名
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${groupBy === 'type' ? 'accent' : 'ghost'}`}
                    onClick={() => setGroupBy('type')}
                  >
                    MIME
                  </button>
                </div>
              </div>

              <div className="fsa-stat-grid">
                <div className="fsa-stat">
                  <span className="muted">總計</span>
                  <strong>{formatFixed(stats.total, unit)}</strong>
                </div>
                <div className="fsa-stat">
                  <span className="muted">平均</span>
                  <strong>{stats.count ? formatFixed(stats.avg, unit) : '—'}</strong>
                </div>
                <div className="fsa-stat">
                  <span className="muted">中位數</span>
                  <strong>{stats.count ? formatFixed(stats.med, unit) : '—'}</strong>
                </div>
                <div className="fsa-stat">
                  <span className="muted">檔案數</span>
                  <strong>{stats.count}</strong>
                </div>
              </div>

              {stats.max && (
                <div className="fsa-extremes">
                  <div>
                    <span className="muted">最大</span>
                    <code className="mono">{stats.max.name}</code>
                    <span className="tag">{formatFixed(stats.max.size, unit)}</span>
                  </div>
                  <div>
                    <span className="muted">最小</span>
                    <code className="mono">{stats.min!.name}</code>
                    <span className="tag">{formatFixed(stats.min!.size, unit)}</span>
                  </div>
                </div>
              )}

              <div className="label">{groupBy === 'ext' ? '依副檔名' : '依 MIME 類型'}</div>
              <ul className="fsa-group-list">
                {groups.map((g) => {
                  const pct = filteredTotal ? (g.size / filteredTotal) * 100 : 0
                  return (
                    <li key={g.key}>
                      <div className="fsa-group-head">
                        <strong className="mono">{g.key}</strong>
                        <span className="muted">
                          {g.count} 個 · {formatFixed(g.size, unit)} · {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="fsa-bar" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
                {!groups.length && (
                  <li className="muted" style={{ listStyle: 'none' }}>
                    載入檔案後顯示分布
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        <section className="panel fsa-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">資料來源</span>
              <strong>瀏覽器 File API（name／size／type／lastModified），不讀取檔案內容</strong>
            </li>
            <li>
              <span className="muted">目前總量</span>
              <strong>
                {stats.count} 個 · {formatFixed(stats.total, unit)}
                {filterExt ? `（已篩 ${filterExt}）` : ''}
              </strong>
            </li>
            <li>
              <span className="muted">平均／中位</span>
              <strong>
                {stats.count
                  ? `${formatFixed(stats.avg, unit)} / ${formatFixed(stats.med, unit)}`
                  : '—'}
              </strong>
            </li>
            <li>
              <span className="muted">單位說明</span>
              <strong>以 1024 進位（KiB／MiB 習慣的 formatBytes）；可強制固定 B／KB／MB／GB</strong>
            </li>
            <li>
              <span className="muted">MIME</span>
              <strong>依瀏覽器偵測，部分副檔名可能顯示 unknown</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>不上傳伺服器；關閉分頁即清除記憶體中的清單</strong>
            </li>
            <li>
              <span className="muted">限制</span>
              <strong>
                最多 {MAX_FILES} 個、單檔 {formatBytes(FILE_MAX)}（僅為介面保護，非硬碟限制）
              </strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>找最大檔可先按「大小↓」；要比對完整性請用 File Hash Checker</strong>
            </li>
            <li>
              <span className="muted">相關工具</span>
              <strong>檔名清理、批次重新命名、檔案雜湊核對</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
