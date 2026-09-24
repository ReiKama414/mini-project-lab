import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'uuid-bulk',
  title: 'UUID 批次產生',
  description: '大量產生 UUID v4 並匯出',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('uuid-bulk') ?? fallback

const MIN = 1
const MAX = 2000
const PRESETS = [10, 50, 100, 500, 1000]
type OutFmt = 'nl' | 'csv' | 'json'

function formatOne(id: string, hyphen: boolean, upper: boolean) {
  const body = hyphen ? id : id.replace(/-/g, '')
  return upper ? body.toUpperCase() : body.toLowerCase()
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-bulk:count', 50)
  const [hyphen, setHyphen] = useLocalStorage('lab:uuid-bulk:hyphen', true)
  const [upper, setUpper] = useLocalStorage('lab:uuid-bulk:upper', false)
  const [fmt, setFmt] = useLocalStorage<OutFmt>('lab:uuid-bulk:fmt', 'nl')
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const n = clamp(Number.isFinite(count) ? count : MIN, MIN, MAX)

  const display = useMemo(() => list.map((id) => formatOne(id, hyphen, upper)), [list, hyphen, upper])

  const joined = useMemo(() => {
    if (!display.length) return ''
    if (fmt === 'csv') return `uuid\n${display.join('\n')}`
    if (fmt === 'json') return JSON.stringify(display, null, 2)
    return display.join('\n')
  }, [display, fmt])

  function generate() {
    setBusy(true)
    setCopied(null)
    window.setTimeout(() => {
      setList(Array.from({ length: n }, () => uuidv4()))
      setBusy(false)
    }, 0)
  }

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function downloadOut() {
    if (!joined) return
    if (fmt === 'csv') downloadText('uuids.csv', joined, 'text/csv')
    else if (fmt === 'json') downloadText('uuids.json', joined, 'application/json')
    else downloadText('uuids.txt', joined)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm accent" disabled={busy} onClick={generate}>
            {busy ? '產生中…' : '產生'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!joined}
            onClick={() => void copyVal(joined, 'all')}
            icon="copy"
          >
            {copied === 'all' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!joined} onClick={downloadOut} icon="download">
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">UUID v4</span>
              <span className="tag">{display.length} 組</span>
              <span className="tag">上限 {MAX}</span>
            </div>
          </div>

          <div className="pw-block">
            <div className="label">數量預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn sm ${n === p ? 'accent' : 'ghost'}`}
                  onClick={() => setCount(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <label className="stack">
            <span className="label">
              數量（{MIN}–{MAX}）
            </span>
            <input
              className="field"
              type="number"
              min={MIN}
              max={MAX}
              value={n}
              onChange={(e) => setCount(clamp(parseNumber(e.target.value, MIN), MIN, MAX))}
            />
          </label>

          <div className="pw-block">
            <div className="label">格式</div>
            <div className="pw-chips">
              {(
                [
                  ['nl', '換行'],
                  ['csv', 'CSV'],
                  ['json', 'JSON'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`}
                  onClick={() => setFmt(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
              連字號
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              大寫
            </label>
          </div>
        </div>

        <div className="xc-main xc-view-out">
          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!joined}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'all' ? '已複製' : '複製'}
                  onClick={() => void copyVal(joined, 'all')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!joined}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={downloadOut}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!list.length}
                  icon="trash"
                  iconOnly
                  tooltip="清除"
                  onClick={() => setList([])}
                />
              </div>
            </div>
            {joined ? (
              <pre className="xc-pre mono">{joined}</pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                按「產生」以 uuid 套件產生 UUID v4
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>UUID v4（亂數），透過 uuid 套件的 v4()</strong>
            </li>
            <li>
              <span className="muted">安全性</span>
              <strong>UUID 是識別碼，不是密鑰或密碼；勿當 secret 使用</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>單次最多 {MAX} 組；大量時會短暫顯示忙碌狀態</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機產生；僅記住數量／格式設定，結果不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>UUID Generator、NanoID、ULID</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
