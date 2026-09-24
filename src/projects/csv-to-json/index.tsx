import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv } from '../../lib/csv'

const fallback: ProjectMeta = {
  slug: 'csv-to-json',
  title: 'CSV → JSON',
  description: 'CSV 轉 JSON 陣列，可選數值推斷與美化',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['data'],
}
const meta = getProject('csv-to-json') ?? fallback

const MAX = 300_000
const FILE_MAX = 8 * 1024 * 1024
const ROW_MAX = 8_000
type ViewMode = 'split' | 'edit' | 'out'

const SAMPLES = [
  {
    label: '人員',
    delim: ',',
    body: `name,age,city\nAda,36,Taipei\nLin,28,Kaohsiung\nMei,41,Taichung`,
  },
  {
    label: '含引號',
    delim: ',',
    body: `id,note\n1,"hello, world"\n2,"say ""hi"""`,
  },
  {
    label: '分號',
    delim: ';',
    body: `sku;qty;price\nA01;3;12.5\nB02;0;9`,
  },
]

const DELIMS = [
  { id: ',', label: '逗號' },
  { id: ';', label: '分號' },
  { id: '\t', label: 'Tab' },
  { id: '|', label: '管線' },
]

function detectDelim(text: string) {
  const sample = text.replace(/^\uFEFF/, '').split(/\r?\n/).slice(0, 8).join('\n')
  let best = ','
  let bestScore = -1
  for (const d of [',', ';', '\t', '|'] as const) {
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
    const nz = counts.filter((c) => c > 0)
    if (!nz.length) continue
    const first = nz[0]!
    const score = first * (nz.every((c) => c === first) ? 10 : 1) + nz.length
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

function coerce(v: string, asNumber: boolean, asBool: boolean) {
  const t = v.trim()
  if (asBool) {
    if (/^(true|yes)$/i.test(t)) return true
    if (/^(false|no)$/i.test(t)) return false
  }
  if (asNumber && t !== '' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t)
  return v
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:csv-to-json:input', 'name,age\nAda,36\nLin,28')
  const [delim, setDelim] = useLocalStorage('lab:csv-to-json:delim', ',')
  const [pretty, setPretty] = useLocalStorage('lab:csv-to-json:pretty', true)
  const [asNumber, setAsNumber] = useLocalStorage('lab:csv-to-json:num', true)
  const [asBool, setAsBool] = useLocalStorage('lab:csv-to-json:bool', false)
  const [skipEmpty, setSkipEmpty] = useLocalStorage('lab:csv-to-json:skip', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:csv-to-json:view', 'split')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!isNonEmpty(input)) return { out: '', err: '', dims: '', keys: [] as string[], count: 0 }
    try {
      let rows = parseCsv(input, delim || ',')
      if (skipEmpty) rows = rows.filter((r) => r.some((c) => c.trim() !== ''))
      if (rows.length < 2) throw new Error('至少需要標題列與一筆資料')
      if (rows.length > ROW_MAX) throw new Error(`列數上限 ${ROW_MAX}`)
      const headers = rows[0]!.map((h, i) => (h.trim() ? h.trim() : `col_${i + 1}`))
      const data = rows.slice(1).map((r) => {
        const o: Record<string, string | number | boolean> = {}
        headers.forEach((h, i) => {
          o[h] = coerce(r[i] ?? '', asNumber, asBool)
        })
        return o
      })
      const out = JSON.stringify(data, null, pretty ? 2 : 0)
      return {
        out,
        err: '',
        dims: `${rows.length} 列（含表頭）· ${headers.length} 欄 · ${data.length} 筆物件`,
        keys: headers,
        count: data.length,
      }
    } catch (e) {
      return { out: '', err: e instanceof Error ? e.message : '轉換失敗', dims: '', keys: [], count: 0 }
    }
  }, [input, delim, pretty, asNumber, asBool, skipEmpty])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!result.out} onClick={() => void copyVal(result.out, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.out}
            onClick={() => downloadText('data.json', result.out, 'application/json')}
            icon="download"
          >
            下載 JSON
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row xc-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '輸入'],
                  ['out', '輸出'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`btn sm ${view === id ? 'accent' : 'ghost'}`} onClick={() => setView(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-stats">
            <span className="tag">{result.count} 筆</span>
            {result.keys.length > 0 && <span className="tag">{result.keys.length} 鍵</span>}
            {result.out && <span className="tag">{formatBytes(new Blob([result.out]).size)}</span>}
            {result.err && <span className="tag xc-tag-warn">有錯誤</span>}
          </div>
          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setInput(s.body)
                    setDelim(s.delim)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
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
                  setHint(`已偵測：${d === '\t' ? 'Tab' : d}`)
                }}
              >
                自動偵測
              </button>
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} />
              美化 JSON
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={asNumber} onChange={(e) => setAsNumber(e.target.checked)} />
              數字推斷
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={asBool} onChange={(e) => setAsBool(e.target.checked)} />
              布林推斷
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
              略過空列
            </label>
          </div>
        </div>

        <div className={`xc-main xc-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel xc-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">CSV 輸入</h3>
                <ActionButton className="btn sm ghost" icon="trash" disabled={!input} onClick={() => setInput('')}>
                  清除
                </ActionButton>
              </div>
              {result.err && <p className="field-error">{result.err}</p>}
              {hint && !result.err && <p className="field-hint">{hint}</p>}
              <FileDrop
                accept=".csv,text/csv,.tsv,text/tab-separated-values,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 CSV／TSV"
                hint={`上限 ${formatBytes(FILE_MAX)} · 列數上限 ${ROW_MAX}`}
                onFiles={(files) => {
                  void (async () => {
                    const f = files[0]
                    if (!f) return
                    setBusy(true)
                    try {
                      const text = limitText(await f.text(), MAX)
                      setInput(text)
                      setDelim(/\t/.test(f.name) || /\.tsv$/i.test(f.name) ? '\t' : detectDelim(text))
                      setHint(`已載入「${f.name}」`)
                    } catch {
                      setHint('')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              />
              <textarea
                className={`field mono xc-textarea${!isNonEmpty(input) ? ' is-invalid' : ''}`}
                value={input}
                maxLength={MAX}
                disabled={busy}
                spellCheck={false}
                onChange={(e) => setInput(limitText(e.target.value, MAX))}
                aria-label="CSV"
              />
              <div className="field-meta">
                <span>第一列為欄名</span>
                <span>
                  {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'out') && (
            <section className="panel xc-out">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">JSON 輸出</h3>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!result.out}
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'out' ? '已複製' : '複製'}
                    onClick={() => void copyVal(result.out, 'out')}
                  />
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!result.out}
                    icon="download"
                    iconOnly
                    tooltip="下載"
                    onClick={() => downloadText('data.json', result.out, 'application/json')}
                  />
                </div>
              </div>
              {result.dims && <p className="field-hint">{result.dims}</p>}
              {result.keys.length > 0 && (
                <div className="pw-chips">
                  {result.keys.slice(0, 12).map((k) => (
                    <span key={k} className="tag mono">
                      {k}
                    </span>
                  ))}
                  {result.keys.length > 12 && <span className="tag muted">+{result.keys.length - 12}</span>}
                </div>
              )}
              {result.out ? (
                <pre className="xc-pre mono">{result.out}</pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  有效 CSV 會即時轉成 JSON 陣列
                </p>
              )}
            </section>
          )}
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">輸出形狀</span>
              <strong>物件陣列；鍵名來自第一列表頭</strong>
            </li>
            <li>
              <span className="muted">推斷</span>
              <strong>可選把純數字／true·false·yes·no 轉成 number／boolean</strong>
            </li>
            <li>
              <span className="muted">限制</span>
              <strong>
                最多約 {ROW_MAX} 列、輸入 {MAX.toLocaleString()} 字元
              </strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機轉換，不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>CSV Viewer、CSV → TSV、JSON → CSV</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
