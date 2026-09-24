import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'
import { parseCsv, stringifyCsv } from '../../lib/csv'

const fallback: ProjectMeta = {
  slug: 'csv-to-tsv',
  title: 'CSV → TSV',
  description: 'CSV 轉 Tab 分隔，並清理欄內 Tab／換行',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['data'],
}
const meta = getProject('csv-to-tsv') ?? fallback

const MAX = 300_000
const FILE_MAX = 8 * 1024 * 1024
type ViewMode = 'split' | 'edit' | 'out'

const SAMPLES = [
  { label: '基本', from: ',', body: 'a,b,c\n1,2,3\n"hello, world",4,5' },
  { label: '分號', from: ';', body: 'x;y;z\n10;20;30' },
  { label: '含換行', from: ',', body: 'id,note\n1,"line1\nline2"\n2,ok' },
]

const DELIMS = [
  { id: ',', label: '逗號' },
  { id: ';', label: '分號' },
  { id: '|', label: '管線' },
]

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:csv-to-tsv:input', 'a,b,c\n1,2,3\n"hello, world",4,5')
  const [fromDelim, setFromDelim] = useLocalStorage('lab:csv-to-tsv:from', ',')
  const [scrubTab, setScrubTab] = useLocalStorage('lab:csv-to-tsv:scrubTab', true)
  const [scrubNl, setScrubNl] = useLocalStorage('lab:csv-to-tsv:scrubNl', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:csv-to-tsv:view', 'split')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!isNonEmpty(input)) return { out: '', err: '', dims: '', rows: [] as string[][] }
    try {
      const rows = parseCsv(input, fromDelim || ',')
      const cleaned = rows.map((r) =>
        r.map((c) => {
          let v = c
          if (scrubTab) v = v.replace(/\t/g, ' ')
          if (scrubNl) v = v.replace(/\r?\n/g, ' ')
          return v
        }),
      )
      const out = stringifyCsv(cleaned, '\t')
      return {
        out,
        err: '',
        dims: `${cleaned.length} 列 × ${cleaned[0]?.length ?? 0} 欄`,
        rows: cleaned,
      }
    } catch {
      return { out: '', err: '轉換失敗', dims: '', rows: [] }
    }
  }, [input, fromDelim, scrubTab, scrubNl])

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
            onClick={() => downloadText('data.tsv', result.out, 'text/tab-separated-values')}
            icon="download"
          >
            下載 TSV
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
            {result.dims && <span className="tag">{result.dims}</span>}
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
                    setFromDelim(s.from)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">來源分隔符</div>
            <div className="pw-chips">
              {DELIMS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`btn sm ${fromDelim === d.id ? 'accent' : 'ghost'}`}
                  onClick={() => setFromDelim(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={scrubTab} onChange={(e) => setScrubTab(e.target.checked)} />
              欄內 Tab → 空白
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={scrubNl} onChange={(e) => setScrubNl(e.target.checked)} />
              欄內換行 → 空白
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
                accept=".csv,text/csv,.txt"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 CSV"
                hint={`上限 ${formatBytes(FILE_MAX)}`}
                onFiles={(files) => {
                  void (async () => {
                    const f = files[0]
                    if (!f) return
                    setBusy(true)
                    try {
                      setInput(limitText(await f.text(), MAX))
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
                <span>RFC4180 解析後輸出 Tab</span>
                <span>
                  {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'out') && (
            <section className="panel xc-out">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">TSV 輸出</h3>
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
                    onClick={() => downloadText('data.tsv', result.out, 'text/tab-separated-values')}
                  />
                </div>
              </div>
              {result.dims && <p className="field-hint">{result.dims}</p>}
              {result.rows.length > 0 && (
                <div className="xc-mini-table-wrap">
                  <table className="xc-mini-table">
                    <tbody>
                      {result.rows.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          {r.slice(0, 6).map((c, j) => (
                            <td key={j} className="mono">
                              {c}
                            </td>
                          ))}
                          {r.length > 6 && <td className="muted">…</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rows.length > 8 && <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: 12 }}>僅預覽前 8 列</p>}
                </div>
              )}
              {result.out ? (
                <pre className="xc-pre mono">{result.out}</pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  有效 CSV 會即時轉成 TSV
                </p>
              )}
            </section>
          )}
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">差異</span>
              <strong>CSV 用逗號（可含引號）；TSV 用 Tab，欄內通常不應再有 Tab</strong>
            </li>
            <li>
              <span className="muted">清理</span>
              <strong>預設把欄內 Tab／換行換成空白，避免破壞列結構</strong>
            </li>
            <li>
              <span className="muted">用途</span>
              <strong>貼到試算表、BigQuery／部分 CLI 工具常偏好 TSV</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機轉換，不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>CSV Viewer、CSV → JSON</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
