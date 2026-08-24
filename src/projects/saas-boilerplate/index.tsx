import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('saas-boilerplate')!

type Customer = { id: string; name: string; email: string; plan: string; mrr: number }
type Member = { id: string; name: string; email: string; role: 'owner' | 'admin' | 'member' }
type Invoice = { id: string; date: string; amount: number; status: 'paid' | 'open' | 'void' }
type Nav = 'overview' | 'customers' | 'team' | 'billing' | 'settings'
type SettingsTab = 'general' | 'notifications' | 'security'

const PLANS = ['Free', 'Pro', 'Business'] as const
const PLAN_PRICE: Record<string, number> = { Free: 0, Pro: 29, Business: 99 }

export default function Page() {
  const [nav, setNav] = useState<Nav>('overview')
  const [settingsTab, setSettingsTab] = useLocalStorage<SettingsTab>('lab:saas-boilerplate:stab', 'general')
  const [plan, setPlan] = useLocalStorage('lab:saas-boilerplate:plan', 'Pro')
  const [org, setOrg] = useLocalStorage('lab:saas-boilerplate:org', 'Mini Lab Inc.')
  const [metrics, setMetrics] = useLocalStorage('lab:saas-boilerplate:metrics', {
    churn: 2.4,
    nps: 48,
    trials: 12,
  })
  const [customers, setCustomers] = useLocalStorage<Customer[]>('lab:saas-boilerplate:customers', [
    { id: '1', name: 'Acme Co', email: 'ops@acme.test', plan: 'Pro', mrr: 29 },
    { id: '2', name: 'Northwind', email: 'hello@nw.test', plan: 'Business', mrr: 99 },
    { id: '3', name: 'Indie Dev', email: 'me@indie.test', plan: 'Free', mrr: 0 },
  ])
  const [members, setMembers] = useLocalStorage<Member[]>('lab:saas-boilerplate:team', [
    { id: '1', name: 'Kamay', email: 'kamay@lab.test', role: 'owner' },
    { id: '2', name: 'Ada', email: 'ada@lab.test', role: 'admin' },
    { id: '3', name: 'Ben', email: 'ben@lab.test', role: 'member' },
  ])
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('lab:saas-boilerplate:invoices', [
    { id: 'inv_0801', date: '2026-08-01', amount: 29, status: 'paid' },
    { id: 'inv_0701', date: '2026-07-01', amount: 29, status: 'paid' },
    { id: 'inv_0601', date: '2026-06-01', amount: 29, status: 'void' },
  ])
  const [settings, setSettings] = useLocalStorage('lab:saas-boilerplate:settings', {
    timezone: 'Asia/Taipei',
    notify: true,
    seatLimit: 10,
    supportEmail: 'support@lab.test',
    twoFactor: false,
    sessionDays: 14,
  })
  const [draft, setDraft] = useState({ name: '', email: '', plan: 'Pro', mrr: 29 })
  const [memberDraft, setMemberDraft] = useState({ name: '', email: '', role: 'member' as Member['role'] })
  const [billingNote, setBillingNote] = useState('')

  const links: { id: Nav; label: string }[] = [
    { id: 'overview', label: '總覽' },
    { id: 'customers', label: '客戶' },
    { id: 'team', label: '團隊' },
    { id: 'billing', label: '帳單' },
    { id: 'settings', label: '設定' },
  ]

  const totalMrr = customers.reduce((a, c) => a + c.mrr, 0)
  const planPrice = PLAN_PRICE[plan] ?? 0

  function addCustomer() {
    if (!draft.name.trim() || !draft.email.trim()) return
    setCustomers((xs) => [
      ...xs,
      { id: uid('c'), name: draft.name.trim(), email: draft.email.trim(), plan: draft.plan, mrr: Number(draft.mrr) || 0 },
    ])
    setDraft({ name: '', email: '', plan: 'Pro', mrr: 29 })
  }

  function addMember() {
    if (!memberDraft.name.trim() || !memberDraft.email.trim()) return
    if (members.length >= settings.seatLimit) {
      setBillingNote(`已達席次上限 ${settings.seatLimit}`)
      return
    }
    setMembers((xs) => [
      ...xs,
      { id: uid('m'), name: memberDraft.name.trim(), email: memberDraft.email.trim(), role: memberDraft.role },
    ])
    setMemberDraft({ name: '', email: '', role: 'member' })
    setBillingNote('')
  }

  function switchPlan(p: string) {
    setPlan(p)
    const amount = PLAN_PRICE[p] ?? 0
    const inv: Invoice = {
      id: uid('inv'),
      date: new Date().toISOString().slice(0, 10),
      amount,
      status: amount === 0 ? 'void' : 'open',
    }
    setInvoices((xs) => [inv, ...xs].slice(0, 12))
    setBillingNote(`已切換至 ${p}，產生模擬帳單 ${inv.id}`)
  }

  function payOpen() {
    setInvoices((xs) => xs.map((i) => (i.status === 'open' ? { ...i, status: 'paid' } : i)))
    setBillingNote('已模擬付款所有未結帳單')
  }

  return (
    <ProjectShell meta={meta}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, minHeight: 480 }}>
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
                <div className="metric stack">
                  <span className="muted">MRR</span>
                  <strong>${totalMrr.toLocaleString()}</strong>
                </div>
                <div className="metric stack">
                  <span className="muted">客戶 / 成員</span>
                  <strong>
                    {customers.length} / {members.length}
                  </strong>
                </div>
                <div className="metric stack">
                  <span className="muted">席次</span>
                  <strong>
                    {members.length}/{settings.seatLimit}
                  </strong>
                </div>
              </div>
              <div className="grid-3">
                <label className="stack">
                  <span className="label">Churn %</span>
                  <input
                    className="field"
                    type="number"
                    step={0.1}
                    value={metrics.churn}
                    onChange={(e) => setMetrics((m) => ({ ...m, churn: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label className="stack">
                  <span className="label">NPS</span>
                  <input
                    className="field"
                    type="number"
                    value={metrics.nps}
                    onChange={(e) => setMetrics((m) => ({ ...m, nps: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label className="stack">
                  <span className="label">試用中</span>
                  <input
                    className="field"
                    type="number"
                    value={metrics.trials}
                    onChange={(e) => setMetrics((m) => ({ ...m, trials: Number(e.target.value) || 0 }))}
                  />
                </label>
              </div>
            </>
          )}

          {nav === 'customers' && (
            <>
              <h3 style={{ margin: 0 }}>客戶</h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input className="field" placeholder="名稱" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                <input className="field" placeholder="Email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                <select className="field" value={draft.plan} onChange={(e) => setDraft((d) => ({ ...d, plan: e.target.value }))} style={{ width: 110 }}>
                  {PLANS.map((p) => (
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
                      <div style={{ flex: 1 }}>
                        <input
                          className="field"
                          value={c.name}
                          onChange={(e) => setCustomers((xs) => xs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                        />
                        <input
                          className="field mono"
                          style={{ marginTop: 4 }}
                          value={c.email}
                          onChange={(e) => setCustomers((xs) => xs.map((x) => (x.id === c.id ? { ...x, email: e.target.value } : x)))}
                        />
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
                        {PLANS.map((p) => (
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

          {nav === 'team' && (
            <>
              <h3 style={{ margin: 0 }}>
                團隊成員（{members.length}/{settings.seatLimit}）
              </h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="field"
                  placeholder="姓名"
                  value={memberDraft.name}
                  onChange={(e) => setMemberDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <input
                  className="field"
                  placeholder="Email"
                  value={memberDraft.email}
                  onChange={(e) => setMemberDraft((d) => ({ ...d, email: e.target.value }))}
                />
                <select
                  className="field"
                  value={memberDraft.role}
                  onChange={(e) => setMemberDraft((d) => ({ ...d, role: e.target.value as Member['role'] }))}
                  style={{ width: 110 }}
                >
                  {(['owner', 'admin', 'member'] as const).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn accent sm" onClick={addMember}>
                  邀請
                </button>
              </div>
              {billingNote && <p className="muted">{billingNote}</p>}
              <ul className="list">
                {members.map((m) => (
                  <li key={m.id} className="list-item row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{m.name}</strong>
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        {m.email}
                      </div>
                    </div>
                    <div className="row">
                      <select
                        className="field"
                        value={m.role}
                        onChange={(e) =>
                          setMembers((xs) => xs.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Member['role'] } : x)))
                        }
                        style={{ width: 110 }}
                      >
                        {(['owner', 'admin', 'member'] as const).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn sm danger"
                        disabled={m.role === 'owner'}
                        onClick={() => setMembers((xs) => xs.filter((x) => x.id !== m.id))}
                      >
                        移除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {nav === 'billing' && (
            <>
              <h3 style={{ margin: 0 }}>帳單模擬</h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {PLANS.map((p) => (
                  <button key={p} type="button" className={`btn ${plan === p ? 'accent' : 'ghost'}`} onClick={() => switchPlan(p)}>
                    {p} · ${PLAN_PRICE[p]}
                  </button>
                ))}
              </div>
              <div className="list-item">
                目前方案 <strong>{plan}</strong> · 下期扣款 ${planPrice}
              </div>
              {billingNote && <p className="muted">{billingNote}</p>}
              <div className="row">
                <button type="button" className="btn sm teal" onClick={payOpen}>
                  模擬付款未結帳單
                </button>
              </div>
              <ul className="list">
                {invoices.map((inv) => (
                  <li key={inv.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      {inv.date} <span className="mono muted">{inv.id}</span>
                    </span>
                    <span>
                      <span className="mono">${inv.amount.toFixed(2)}</span> <span className="tag">{inv.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {nav === 'settings' && (
            <>
              <h3 style={{ margin: 0 }}>設定</h3>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['general', '一般'],
                    ['notifications', '通知'],
                    ['security', '安全'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn sm ${settingsTab === id ? 'accent' : 'ghost'}`}
                    onClick={() => setSettingsTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {settingsTab === 'general' && (
                <>
                  <label className="label">組織名稱</label>
                  <input className="field" value={org} onChange={(e) => setOrg(e.target.value)} />
                  <label className="label">支援 Email</label>
                  <input
                    className="field"
                    value={settings.supportEmail}
                    onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                  />
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
                </>
              )}
              {settingsTab === 'notifications' && (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={settings.notify}
                    onChange={(e) => setSettings((s) => ({ ...s, notify: e.target.checked }))}
                  />
                  啟用通知信（帳單、邀請、告警）
                </label>
              )}
              {settingsTab === 'security' && (
                <>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={settings.twoFactor}
                      onChange={(e) => setSettings((s) => ({ ...s, twoFactor: e.target.checked }))}
                    />
                    要求雙因素驗證
                  </label>
                  <label className="label">工作階段天數</label>
                  <input
                    className="field"
                    type="number"
                    value={settings.sessionDays}
                    onChange={(e) => setSettings((s) => ({ ...s, sessionDays: Number(e.target.value) || 1 }))}
                  />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </ProjectShell>
  )
}
