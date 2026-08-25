import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useEffect, useMemo, useState } from 'react'
import { charCount, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('password-strength') ?? {
  slug: 'password-strength',
  title: '密碼強度檢查',
  description: '本機評估密碼強度與改進建議。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}

const MAX = 128
const LABELS = ['很弱', '弱', '普通', '強', '很強'] as const
const COLORS = ['#c0392b', '#e67e22', '#e9a319', '#2a9d8f', '#1b7a6e']

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
  return { s: Math.min(4, Math.max(0, s)), tips, entropy }
}

export default function Page() {
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const result = useMemo(() => score(pwd), [pwd])

  useEffect(() => {
    try {
      localStorage.removeItem('lab:password-strength:pwd')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          密碼只留在記憶體，不會寫入 localStorage，也不會上傳。
        </p>
        <label className="stack">
          <span className="label">密碼（僅本機評估）</span>
          <div className="row" style={{ gap: 8 }}>
            <input
              className={`field mono${!isNonEmpty(pwd) ? ' is-invalid' : ''}`}
              type={show ? 'text' : 'password'}
              value={pwd}
              maxLength={MAX}
              autoComplete="new-password"
              onChange={(e) => setPwd(limitText(e.target.value, MAX))}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn sm ghost" onClick={() => setShow((v) => !v)}>
              {show ? '隱藏' : '顯示'}
            </button>
          </div>
          <div className="field-meta">
            <span>{charCount(pwd)} / {MAX}</span>
          </div>
        </label>
        {!isNonEmpty(pwd) && <p className="field-error">請輸入密碼</p>}
        {isNonEmpty(pwd) && (
          <>
            <div className="progress">
              <span style={{ width: `${(result.s / 4) * 100}%`, background: COLORS[result.s] }} />
            </div>
            <p className="metric" style={{ color: COLORS[result.s] }}>
              強度：{LABELS[result.s]}
              <span className="muted" style={{ marginLeft: 12, fontSize: 13, fontWeight: 400 }}>
                約 {Math.round(result.entropy)} bit 熵（粗估）
              </span>
            </p>
            {result.tips.length > 0 ? (
              <ul className="list">
                {result.tips.map((t) => (
                  <li key={t} className="list-item">
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">看起來不錯。正式環境仍建議使用密碼管理器。</p>
            )}
          </>
        )}
      </div>
    </ProjectShell>
  )
}
