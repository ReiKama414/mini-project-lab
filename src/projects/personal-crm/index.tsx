import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText } from '../../lib/utils'

const meta = getProject('personal-crm')!

type Status = '潛在' | '活躍' | '暫停' | '成交'
type Contact = {
  id: string
  name: string
  company: string
  email: string
  note: string
  next: string
  status: Status
  tag: string
}

const STATUSES: Status[] = ['潛在', '活躍', '暫停', '成交']

const seed: Contact[] = [
  {
    id: '1',
    name: '陳雅婷',
    company: '北極星科技',
    email: 'yating@northstar.dev',
    note: '對設計系統有興趣',
    next: '2026-08-28',
    status: '潛在',
    tag: '客戶',
  },
  {
    id: '2',
    name: '林志豪',
    company: '獨立開發',
    email: 'hao@indie.tw',
    note: '可合作開源',
    next: '2026-09-01',
    status: '活躍',
    tag: '夥伴',
  },
]

const empty = { name: '', company: '', email: '', note: '', next: '', status: '潛在' as Status, tag: '一般' }

export default function Page() {
  const [contacts, setContacts] = useLocalStorage<Contact[]>('lab:personal-crm', seed)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | '全部'>('全部')
  const [form, setForm] = useState(empty)

  const filtered = useMemo(() => {
    return contacts
      .filter((c) => statusFilter === '全部' || c.status === statusFilter)
      .filter((c) => `${c.name}${c.company}${c.email}${c.tag}${c.note}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'))
  }, [contacts, q, statusFilter])

  const dueSoon = contacts.filter((c) => c.next && c.next <= new Date().toISOString().slice(0, 10) && c.status !== '成交').length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn ghost sm"
          onClick={() =>
            downloadText(
              'crm.csv',
              ['姓名,公司,Email,狀態,下次跟進,標籤,備註', ...contacts.map((c) => [c.name, c.company, c.email, c.status, c.next, c.tag, c.note].join(','))].join('\n'),
              'text/csv;charset=utf-8',
            )
          }
        >
          匯出 CSV
        </button>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">聯絡人 {contacts.length}</span>
        <span className="tag">今日需跟進 {dueSoon}</span>
        {(['全部', ...STATUSES] as const).map((s) => (
          <button key={s} type="button" className={`btn sm ${statusFilter === s ? 'accent' : 'ghost'}`} onClick={() => setStatusFilter(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">新增聯絡人</div>
          <input className="field" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="公司" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" placeholder="標籤" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          <label className="label">狀態</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button key={s} type="button" className={`btn sm ${form.status === s ? 'accent' : 'ghost'}`} onClick={() => setForm({ ...form, status: s })}>
                {s}
              </button>
            ))}
          </div>
          <label className="label">下次跟進</label>
          <input className="field" type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <textarea className="field" rows={3} placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!form.name.trim()) return
              setContacts((xs) => [{ id: uid('c'), ...form, name: form.name.trim() }, ...xs])
              setForm(empty)
            }}
          >
            儲存
          </button>
        </div>
        <div className="panel stack">
          <input className="field" placeholder="搜尋姓名／公司／Email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="list">
            {filtered.map((c) => (
              <li key={c.id} className="list-item stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    {c.name} <span className="muted">{c.company}</span>
                  </strong>
                  <span className="tag">{c.status}</span>
                </div>
                <div className="mono muted">{c.email || '（無 Email）'}</div>
                <p className="muted" style={{ margin: 0 }}>
                  {c.note || '無備註'}
                </p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="tag">{c.tag}</span>
                  <span className="mono">下次：{c.next || '—'}</span>
                  <select
                    className="field"
                    style={{ width: 110 }}
                    value={c.status}
                    onChange={(e) =>
                      setContacts((xs) => xs.map((x) => (x.id === c.id ? { ...x, status: e.target.value as Status } : x)))
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn sm danger" onClick={() => setContacts((xs) => xs.filter((x) => x.id !== c.id))}>
                    刪除
                  </button>
                </div>
              </li>
            ))}
            {filtered.length === 0 && <li className="muted">無符合結果</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
