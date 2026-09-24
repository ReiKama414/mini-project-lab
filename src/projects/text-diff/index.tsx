import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'text-diff',
  title: '文字 Diff',
  description: '逐行對齊比對兩段文字，可複製差異報告',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['dev'],
}
const meta = getProject('text-diff') ?? fallback

const MAX = 100_000
const FILE_MAX = 4 * 1024 * 1024
const LINE_CAP = 5000

const SAMPLES = [
  {
    label: '大小寫',
    a: 'hello\nworld\nfoo',
    b: 'hello\nWORLD\nbar',
  },
  {
    label: '多一行',
    a: 'one\ntwo',
    b: 'one\ntwo\nthree',
  },
  {
    label: '完全相同',
    a: 'same\nline',
    b: 'same\nline',
  },
]

type Row = { i: number; left: string; right: string; same: boolean }

export default function Page() {
  const [a, setA] = useLocalStorage('lab:text-diff:a', SAMPLES[0]!.a)
  const [b, setB] = useLocalStorage('lab:text-diff:b', SAMPLES[0]!.b)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [onlyDiff, setOnlyDiff] = useLocalStorage('lab:text-diff:onlyDiff', false)

  const result = useMemo(() => {
    if (!isNonEmpty(a) && !isNonEmpty(b)) {
      return { rows: [] as Row[], error: '請輸入文字', ready: false, diffCount: 0 }
    }
    const la = a.split(/\r?\n/)
    const lb = b.split(/\r?\n/)
    const n = Math.max(la.length, lb.length)
    if (n > LINE_CAP) {
      return { rows: [] as Row[], error: `行數過多（上限 ${LINE_CAP} 行）`, ready: false, diffCount: 0 }
    }
    const rows: Row[] = []
    for (let i = 0; i < n; i++) {
      const left = la[i] ?? ''
      const right = lb[i] ?? ''
      rows.push({ i: i + 1, left, right, same: left === right })
    }
    return { rows, error: '', ready: true, diffCount: rows.filter((r) => !r.same).length }
  }, [a, b])

  const visible = onlyDiff ? result.rows.filter((r) => !r.same) : result.rows
  const report = result.rows
    .filter((r) => !r.same)
    .map((r) => `L${r.i}\n- ${r.left || '∅'}\n+ ${r.right || '∅'}`)
    .join('\n\n')

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function loadSide(side: 'a' | 'b', file: File) {
    setBusy(true)
    try {
      const text = limitText(await file.text(), MAX)
      if (side === 'a') setA(text)
      else setB(text)
      setHint(`已載入「${file.name}」到${side === 'a' ? '左側' : '右側'}`)
    } catch {
      setHint('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!result.diffCount}
            onClick={() => void copyVal(report, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製差異'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.diffCount}
            onClick={() => downloadText('text-diff.txt', report)}
            icon="download"
          >
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
              {result.ready && !result.error && (
                <span className="tag">{result.diffCount ? `${result.diffCount} 行不同` : '全部相同'}</span>
              )}
              {result.error && <span className="tag xc-tag-warn">無法比對</span>}
            </div>
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
                    setA(s.a)
                    setB(s.b)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="row xc-options">
            <label className="xc-check">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
              只顯示不同行
            </label>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">左側</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!a} onClick={() => setA('')}>
                清除
              </ActionButton>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
            <FileDrop
              accept=".txt,.md,.csv,text/plain,text/markdown"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放左側文字"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => {
                const f = files[0]
                if (f) void loadSide('a', f)
              }}
            />
            <textarea
              className="field mono xc-textarea"
              value={a}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setA(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="左側文字"
            />
            <div className="field-meta">
              <span>逐行對齊</span>
              <span>
                {charCount(a).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">右側</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!b} onClick={() => setB('')}>
                清除
              </ActionButton>
            </div>
            <FileDrop
              accept=".txt,.md,.csv,text/plain,text/markdown"
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放右側文字"
              hint={`上限 ${formatBytes(FILE_MAX)}`}
              onFiles={(files) => {
                const f = files[0]
                if (f) void loadSide('b', f)
              }}
            />
            <textarea
              className="field mono xc-textarea"
              value={b}
              maxLength={MAX}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                setB(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="右側文字"
            />
            <div className="field-meta">
              <span>即時比對</span>
              <span>
                {charCount(b).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>
        </div>

        <section className="panel xc-out">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">比對結果</h3>
            <div className="row" style={{ gap: 6 }}>
              <ActionButton
                className="btn sm ghost"
                disabled={!result.diffCount}
                icon="copy"
                iconOnly
                tooltip={copied === 'out' ? '已複製' : '複製'}
                onClick={() => void copyVal(report, 'out')}
              />
              <ActionButton
                className="btn sm ghost"
                disabled={!result.diffCount}
                icon="download"
                iconOnly
                tooltip="下載"
                onClick={() => downloadText('text-diff.txt', report)}
              />
            </div>
          </div>
          {result.error && <p className="field-error">{result.error}</p>}
          {result.ready && !result.error && result.diffCount === 0 && (
            <p className="field-hint">全部相同</p>
          )}
          {visible.length > 0 ? (
            <ul className="list">
              {visible.map((r) => (
                <li key={r.i} className="list-item stack" style={{ opacity: r.same ? 0.55 : 1 }}>
                  <span className="tag">
                    L{r.i}
                    {r.same ? ' · 相同' : ' · 不同'}
                  </span>
                  <code className="mono" style={{ fontSize: 12 }}>
                    {r.left || '∅'}
                  </code>
                  <code className="mono" style={{ fontSize: 12 }}>
                    {r.right || '∅'}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            !result.error && <p className="muted" style={{ margin: 0 }}>輸入兩側文字後即時比對</p>
          )}
        </section>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>逐行對齊比較（非 LCS／Myers）；插入或刪除整行時後續行可能錯位</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>最多 {LINE_CAP.toLocaleString()} 行、{MAX.toLocaleString()} 字元／側</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機比對，不上傳；相關：JSON Diff</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
