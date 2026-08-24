import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('saas-boilerplate')!

type Customer = { id: string; name: string; email: string; plan: string; mrr: number }
type Page = 'overview' | 'customers' | 'billing' | 'settings'

export default function Page() {
  const [nav, setNav] = useState<Page>('overview')
  const [plan, setPlan] = useLocalStorage('lab:saas-boilerplate:plan', 'Pro')
  const [org, setOrg] = useLocalStorage('lab:saas-boilerplate:org', 'Mini Lab Inc.')
  const [customers, setCustomers] = useLocalStorage<Customer[]>('lab:saas-boilerplate:customers', [
    { id: '1', name: 'Acme Co', email: 'ops@acme.test', plan: 'Pro', mrr: 29 },
    { id: '2', name: 'Northwind', email: 'hello@nw.test', plan: 'Business', mrr: 99 },
    { id: '3', name: 'Indie Dev', email: 'me@indie.test', plan: 'Free', mrr: 0 },
  ])
  const [settings, setSettings] = useLocalStorage('lab:saas-boilerplate:settings', {
    timezone: 'Asia/Taipei',
    notify: true,
    seatLimit: 10,
  })
  const [draft, setDraft] = useState({ name: '', email: '', plan: 'Pro', mrr: 29 })

  const links: { id: Page; label: string }[] = [
    { id: 'overview', label: '總覽' },
    { id: 'customers', label: '客戶' },
    { id: 'billing', label: '帳單' },
    { id: 'settings', label: '設定' },
  ]

  const totalMrr = customers.reduce((a, c) => a + c.mrr, 0)

  function addCustomer() {
    if (!draft.name.trim() || !draft.email.trim()) return
    setCustomers((xs) => [
      ...xs,
      { id: uid('c'), name: draft.name.trim(), email: draft.email.trim(), plan: draft.plan, mrr: Number(draft.mrr) || 0 },
    ])
    setDraft({ name: '', email: '', plan: 'Pro', mrr: 29 })
  }

  return (
    <ProjectShell meta={meta}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, minHeight: 440 }}>
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
              <h3 style={{ margin: 0 }}>總覽</h3>
              <div className="grid-3">
                <div className="metric">MRR ${totalMrr.toLocaleString()}</div>
                <div className="metric">客戶 {customers.length}</div>
                <div className="metric">席次上限 {settings.seatLimit}</div>
              </div>
              <p className="muted">可編輯的迷你 SaaS 骨架：客戶、帳單與設定皆寫入 localStorage。</p>
            </>
          )}

          {nav === 'customers' && (
            <>
              <h3 style={{ margin: 0 }}>客戶</h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input className="field" placeholder="名稱" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                <input className="field" placeholder="Email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                <select className="field" value={draft.plan} onChange={(e) => setDraft((d) => ({ ...d, plan: e.target.value }))} style={{ width: 110 }}>
                  {['Free', 'Pro', 'Business'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  style={{ width: 90 }}
                  value={draft.mrr}
                  onChange={(e) => setDraft((d) => ({ ...d, mrr: Number(e.target.value) }))}
                />
                <button type="button" className="btn accent sm" onClick={addCustomer}>
                  新增
                </button>
              </div>
              <ul className="list">
                {customers.map((c) => (
                  <li key={c.id} className="list-item stack">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <input
                          className="field"
                          value={c.name}
                          onChange={(e) => setCustomers((xs) => xs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                        />
                        <div className="muted mono">{c.email}</div>
                      </div>
                      <button type="button" className="btn sm danger" onClick={() => setCustomers((xs) => xs.filter((x) => x.id !== c.id))}>
                        刪除
                      </button>
                    </div>
                    <div className="row">
                      <select
                        className="field"
                        value={c.plan}
                        onChange={(e) => setCustomers((xs) => xs.map((x) => (x.id === c.id ? { ...x, plan: e.target.value } : x)))}
                        style={{ width: 120 }}
                      >
                        {['Free', 'Pro', 'Business'].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      <input
                        className="field"
                        type="number"
                        value={c.mrr}
                        onChange={(e) =>
                          setCustomers((xs) => xs.map((x) => (x.id === c.id ? { ...x, mrr: Number(e.target.value) || 0 } : x)))
                        }
                        style={{ width: 100 }}
                      />
                      <span className="muted">MRR / 月</span>
                    </div>
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
                組織方案 <strong>{plan}</strong> · 下期扣款 $
                {plan === 'Free' ? 0 : plan === 'Pro' ? 29 : 99}
              </div>
              <ul className="list">
                <li className="list-item row" style={{ justifyContent: 'space-between' }}>
                  <span>2026-08-01 Invoice</span>
                  <span className="mono">${plan === 'Free' ? '0.00' : plan === 'Pro' ? '29.00' : '99.00'}</span>
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
              <label className="label">時區</label>
              <input
                className="field"
                value={settings.timezone}
                onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
              />
              <label className="label">席次上限</label>
              <input
                className="field"
                type="number"
                value={settings.seatLimit}
                onChange={(e) => setSettings((s) => ({ ...s, seatLimit: Number(e.target.value) || 1 }))}
              />
              <label className="row">
                <input
                  type="checkbox"
                  checked={settings.notify}
                  onChange={(e) => setSettings((s) => ({ ...s, notify: e.target.checked }))}
                />
                啟用通知信
              </label>
            </>
          )}
        </main>
      </div>
    </ProjectShell>
  )
}
