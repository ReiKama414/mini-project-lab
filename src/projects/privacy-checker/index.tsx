import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'privacy-checker',
  title: '隱私風險檢查',
  description: '本機掃描文字中的 email／電話／卡號等模式',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['security'],
}
const meta = getProject('privacy-checker') ?? fallback

const MAX = 50_000

const SAMPLES = [
  {
    label: '聯絡資訊',
    body: '聯絡我：ada@example.com 或 +886-912-345-678',
  },
  {
    label: '含卡號示範',
    body: '客服回覆：請用卡號 4111-1111-1111-1111 測試（示範用）',
  },
  {
    label: '乾淨文字',
    body: '本段落沒有個資，僅說明產品功能與使用流程。',
  },
]

function scanText(text: string) {
  const out: { type: string; value: string }[] = []
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  email.forEach((v) => out.push({ type: 'Email', value: v }))
  const phone = text.match(/\+?\d[\d\s-]{7,}\d/g) || []
  phone.forEach((v) => out.push({ type: '電話樣式', value: v.trim() }))
  const card = text.match(/\b(?:\d[ -]*?){13,19}\b/g) || []
  card.forEach((v) => out.push({ type: '可能卡號', value: v.trim() }))
  return out
}

export default function Page() {
  const [text, setText] = useLocalStorage('lab:privacy-checker:text', SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const findings = useMemo(() => (isNonEmpty(text) ? scanText(text) : []), [text])
  const report = findings.map((f) => `${f.type}\t${f.value}`).join('\n')
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of findings) m.set(f.type, (m.get(f.type) || 0) + 1)
    return [...m.entries()]
  }, [findings])

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!findings.length}
            onClick={() => void copyVal(report, 'report')}
            icon="copy"
          >
            {copied === 'report' ? '已複製' : '複製結果'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!findings.length}
            onClick={() => downloadText('privacy-findings.txt', report)}
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
              {isNonEmpty(text) && (
                <span className={`tag${findings.length ? ' xc-tag-warn' : ''}`}>發現 {findings.length} 項</span>
              )}
              {byType.map(([t, n]) => (
                <span key={t} className="tag">
                  {t} ×{n}
                </span>
              ))}
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
                    setText(s.body)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">文字輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!text} onClick={() => setText('')}>
                清除
              </ActionButton>
            </div>
            {!isNonEmpty(text) && <p className="field-error">請輸入文字</p>}
            {hint && isNonEmpty(text) && <p className="field-hint">{hint}</p>}
            <textarea
              className={`field xc-textarea${!isNonEmpty(text) ? ' is-invalid' : ''}`}
              value={text}
              maxLength={MAX}
              onChange={(e) => {
                setText(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="掃描文字"
            />
            <div className="field-meta">
              <span>即時掃描 · 本機</span>
              <span>
                {charCount(text).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">發現項目</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!findings.length}
                icon="copy"
                iconOnly
                tooltip={copied === 'report' ? '已複製' : '複製'}
                onClick={() => void copyVal(report, 'report')}
              />
            </div>
            {isNonEmpty(text) ? (
              findings.length ? (
                <ul className="list" style={{ margin: 0 }}>
                  {findings.map((f, i) => (
                    <li key={`${f.type}-${f.value}-${i}`} className="list-item">
                      <span className="tag">{f.type}</span>
                      <code className="mono">{f.value}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint" style={{ margin: 0 }}>
                  未偵測到符合模式的內容
                </p>
              )
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入文字後即時顯示可能個資
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">範圍</span>
              <strong>簡易正則啟發式（Email、電話樣式、可能卡號），可能誤判或漏判</strong>
            </li>
            <li>
              <span className="muted">限制</span>
              <strong>不能取代正式個資審查或合規稽核</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>文字僅在本機處理</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Tracking URL Cleaner、EXIF Cleaner</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
