import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { charCount, copyText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'password-strength',
  title: '密碼強度檢查',
  description: '本機評估密碼強度、熵與改進建議',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('password-strength') ?? fallback

const MAX = 128
const LABELS = ['很弱', '弱', '普通', '強', '很強'] as const
const COLORS = ['#c0392b', '#e67e22', '#e9a319', '#2a9d8f', '#1b7a6e']

const SAMPLES = [
  { label: '弱', body: 'password' },
  { label: '普通', body: 'Hello123' },
  { label: '強', body: 'Tr0ub4dor&3' },
  { label: '很強', body: 'xK9#mP2$vL7@nQ4!' },
]

function score(pwd: string) {
  let s = 0
  const tips: string[] = []
  if (pwd.length >= 8) s++
  else tips.push('至少 8 字元')
  if (pwd.length >= 12) s++
  else if (pwd.length >= 8) tips.push('建議 12 字元以上')
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++
  else tips.push('同時包含大小寫')
  if (/\d/.test(pwd)) s++
  else tips.push('加入數字')
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  else tips.push('加入符號')
  if (/(.)\1{2,}/.test(pwd)) tips.push('避免連續重複字元')
  if (/password|123456|qwerty|admin|letmein/i.test(pwd)) {
    tips.push('避免常見弱密碼')
    s = Math.max(0, s - 2)
  }
  const charset =
    (/[a-z]/.test(pwd) ? 26 : 0) +
    (/[A-Z]/.test(pwd) ? 26 : 0) +
    (/\d/.test(pwd) ? 10 : 0) +
    (/[^A-Za-z0-9]/.test(pwd) ? 20 : 0)
  const entropy = pwd.length * Math.log2(Math.max(charset, 1))
  return { s: Math.min(4, Math.max(0, s)), tips, entropy, charset }
}

export default function Page() {
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const result = useMemo(() => score(pwd), [pwd])

  useEffect(() => {
    try {
      localStorage.removeItem('lab:password-strength:pwd')
    } catch {
      /* ignore */
    }
  }, [])

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
            disabled={!pwd}
            onClick={() => void copyVal(pwd, 'pwd')}
            icon="copy"
          >
            {copied === 'pwd' ? '已複製' : '複製密碼'}
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              {isNonEmpty(pwd) && (
                <span className="tag" style={{ color: COLORS[result.s] }}>
                  {LABELS[result.s]}
                </span>
              )}
              {isNonEmpty(pwd) && <span className="tag">≈ {Math.round(result.entropy)} bit</span>}
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
                    setPwd(s.body)
                    setShow(true)
                    setHint(`已套用「${s.label}」範例`)
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
              <h3 className="pw-panel-title">密碼輸入</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!pwd} onClick={() => setPwd('')}>
                清除
              </ActionButton>
            </div>
            {!isNonEmpty(pwd) && <p className="field-error">請輸入密碼</p>}
            {hint && isNonEmpty(pwd) && <p className="field-hint">{hint}</p>}
            <div className="row" style={{ gap: 8 }}>
              <input
                className={`field mono${!isNonEmpty(pwd) ? ' is-invalid' : ''}`}
                type={show ? 'text' : 'password'}
                value={pwd}
                maxLength={MAX}
                autoComplete="new-password"
                onChange={(e) => {
                  setPwd(limitText(e.target.value, MAX))
                  setHint('')
                }}
                style={{ flex: 1 }}
                aria-label="密碼"
              />
              <button type="button" className="btn sm ghost" onClick={() => setShow((v) => !v)}>
                {show ? '隱藏' : '顯示'}
              </button>
            </div>
            <div className="field-meta">
              <span>僅本機評估</span>
              <span>
                {charCount(pwd)} / {MAX}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">強度結果</h3>
            </div>
            {isNonEmpty(pwd) ? (
              <div className="stack" style={{ gap: 12 }}>
                <div className="progress">
                  <span style={{ width: `${(result.s / 4) * 100}%`, background: COLORS[result.s] }} />
                </div>
                <p className="metric" style={{ color: COLORS[result.s], margin: 0 }}>
                  {LABELS[result.s]}
                  <span className="muted" style={{ marginLeft: 12, fontSize: 13, fontWeight: 400 }}>
                    約 {Math.round(result.entropy)} bit 熵（粗估）
                  </span>
                </p>
                <div className="pw-stats">
                  <span className="tag">字元集 ≈ {result.charset}</span>
                  <span className="tag">{pwd.length} 字元</span>
                </div>
                {result.tips.length > 0 ? (
                  <ul className="list">
                    {result.tips.map((t) => (
                      <li key={t} className="list-item">
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="field-hint" style={{ margin: 0 }}>
                    看起來不錯；正式環境仍建議使用密碼管理器
                  </p>
                )}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入密碼後即時顯示強度與建議
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">評分</span>
              <strong>依長度、大小寫、數字、符號與常見弱密碼啟發式計分（0–4）</strong>
            </li>
            <li>
              <span className="muted">熵</span>
              <strong>以字元集大小粗估，非正式密碼學保證</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>密碼只留在記憶體，不寫入 localStorage、不上傳</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Secure Password、Secret Generator</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
