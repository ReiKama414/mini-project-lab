import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('saas-boilerplate')!

type User = { id: string; name: string; email: string; role: 'admin' | 'member' }
type Page = 'overview' | 'users' | 'billing' | 'settings'

export default function Page() {
  const [nav, setNav] = useState<Page>('overview')
  const [plan, setPlan] = useLocalStorage('lab:saas-boilerplate:plan', 'Pro')
  const [users, setUsers] = useLocalStorage<User[]>('lab:saas-boilerplate:users', [
    { id: '1', name: 'Owner', email: 'owner@lab.app', role: 'admin' },
    { id: '2', name: 'Jamie', email: 'jamie@lab.app', role: 'member' },
  ])
  const [org, setOrg] = useLocalStorage('lab:saas-boilerplate:org', 'Mini Lab Inc.')

  const links: { id: Page; label: string }[] = [
    { id: 'overview', label: '總覽' },
    { id: 'users', label: '成員' },
    { id: 'billing', label: '帳單' },
    { id: 'settings', label: '設定' },
  ]

  return (
    <ProjectShell meta={meta}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, minHeight: 420 }}>
        <aside className="panel stack">
          <strong>{org}</strong>
          <span className="tag">{plan}</span>
          {links.map((l) => (
            <button key={l.id} type="button" className={`btn ${nav === l.id ? 'accent' : 'ghost'}`} onClick={() => setNav(l.id)}>
              {l.label}
            </button>
          ))}
        </aside>
        <main className="panel stack">
          {nav === 'overview' && (
            <>
              <h3 style={{ margin: 0 }}>Dashboard</h3>
              <div className="grid-3">
                <div className="metric">MRR $1,280</div>
                <div className="metric">活躍 {users.length}</div>
                <div className="metric">轉換 4.2%</div>
              </div>
              <p className="muted">這是迷你 SaaS 骨架：側欄導覽、成員與假帳單頁。</p>
            </>
          )}
          {nav === 'users' && (
            <>
              <div className="row">
                <h3 style={{ margin: 0, flex: 1 }}>成員</h3>
                <button
                  type="button"
                  className="btn accent sm"
                  onClick={() => setUsers((xs) => [...xs, { id: uid('u'), name: 'New User', email: `u${xs.length}@lab.app`, role: 'member' }])}
                >
                  邀請
                </button>
              </div>
              <ul className="list">
                {users.map((u) => (
                  <li key={u.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <strong>{u.name}</strong>
                      <div className="muted mono">{u.email}</div>
                    </div>
                    <span className="tag">{u.role}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {nav === 'billing' && (
            <>
              <h3 style={{ margin: 0 }}>帳單</h3>
              <div className="row">
                {['Free', 'Pro', 'Business'].map((p) => (
                  <button key={p} type="button" className={`btn ${plan === p ? 'accent' : 'ghost'}`} onClick={() => setPlan(p)}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="list-item">
                目前方案 <strong>{plan}</strong> · 下期扣款 $
                {plan === 'Free' ? 0 : plan === 'Pro' ? 29 : 99}
              </div>
              <ul className="list">
                <li className="list-item row" style={{ justifyContent: 'space-between' }}>
                  <span>2026-08-01 Invoice</span>
                  <span className="mono">$29.00</span>
                </li>
                <li className="list-item row" style={{ justifyContent: 'space-between' }}>
                  <span>2026-07-01 Invoice</span>
                  <span className="mono">$29.00</span>
                </li>
              </ul>
            </>
          )}
          {nav === 'settings' && (
            <>
              <h3 style={{ margin: 0 }}>設定</h3>
              <label className="label">組織名稱</label>
              <input className="field" value={org} onChange={(e) => setOrg(e.target.value)} />
              <p className="muted">設定會寫入 localStorage。</p>
            </>
          )}
        </main>
      </div>
    </ProjectShell>
  )
}
