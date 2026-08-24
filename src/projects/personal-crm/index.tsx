import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText } from '../../lib/utils'

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

const TAG_PRESETS = ['一般', '客戶', '夥伴', '投資人', '媒體']

const CONTACT_PRESETS: Omit<Contact, 'id'>[] = [
  {
    name: '示範聯絡人',
    company: '範例公司',
    email: 'demo@example.com',
    note: '可刪除的示範資料',
    next: new Date().toISOString().slice(0, 10),
    status: '潛在',
    tag: '一般',
  },
]

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
  const [statusFilter, setStatusFilter] = useLocalStorage<Status | '全部'>('lab:personal-crm:status', '全部')
  const [tagFilter, setTagFilter] = useLocalStorage('lab:personal-crm:tag', '全部')
  const [dueOnly, setDueOnly] = useLocalStorage('lab:personal-crm:dueOnly', false)
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const tags = useMemo(() => {
    const set = new Set(contacts.map((c) => c.tag).filter(Boolean))
    TAG_PRESETS.forEach((t) => set.add(t))
    return Array.from(set)
  }, [contacts])

  const filtered = useMemo(() => {
    return contacts
      .filter((c) => statusFilter === '全部' || c.status === statusFilter)
      .filter((c) => tagFilter === '全部' || c.tag === tagFilter)
      .filter((c) => !dueOnly || (c.next && c.next <= today && c.status !== '成交'))
      .filter((c) => `${c.name}${c.company}${c.email}${c.tag}${c.note}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'))
  }, [contacts, q, statusFilter, tagFilter, dueOnly, today])

  const stats = useMemo(() => {
    const dueSoon = contacts.filter((c) => c.next && c.next <= today && c.status !== '成交').length
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, contacts.filter((c) => c.status === s).length])) as Record<
      Status,
      number
    >
    return { dueSoon, byStatus, total: contacts.length }
  }, [contacts, today])

  function exportCsv() {
    downloadText(
      'crm.csv',
      [
        '姓名,公司,Email,狀態,下次跟進,標籤,備註',
        ...contacts.map((c) =>
          [c.name, c.company, c.email, c.status, c.next, c.tag, c.note]
            .map((x) => `"${String(x).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n'),
      'text/csv;charset=utf-8',
    )
  }

  function startEdit(c: Contact) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      company: c.company,
      email: c.email,
      note: c.note,
      next: c.next,
      status: c.status,
      tag: c.tag,
    })
  }

  function saveForm() {
    if (!form.name.trim()) return
    if (editingId) {
      setContacts((xs) => xs.map((x) => (x.id === editingId ? { ...x, ...form, name: form.name.trim() } : x)))
      setEditingId(null)
    } else {
      setContacts((xs) => [{ id: uid('c'), ...form, name: form.name.trim() }, ...xs])
    }
    setForm(empty)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={exportCsv}>
            匯出 CSV
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => void copyText(filtered.map((c) => `${c.name} <${c.email}>`).join('\n'))}
          >
            複製清單
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">聯絡人 {stats.total}</span>
        <span className="tag">今日需跟進 {stats.dueSoon}</span>
        {STATUSES.map((s) => (
          <span key={s} className="tag">
            {s} {stats.byStatus[s]}
          </span>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(['全部', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn sm ${statusFilter === s ? 'accent' : 'ghost'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          className={`btn sm ${dueOnly ? 'accent' : 'ghost'}`}
          onClick={() => setDueOnly(!dueOnly)}
        >
          僅逾期／今日
        </button>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="label">{editingId ? '編輯聯絡人' : '新增聯絡人'}</div>
          <div>
            <div className="label">快速預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {CONTACT_PRESETS.map((p) => (
                <button key={p.name} type="button" className="btn sm ghost" onClick={() => setForm({ ...p })}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <input className="field" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="公司" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div>
            <div className="label">標籤預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {TAG_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn sm ${form.tag === t ? 'accent' : 'ghost'}`}
                  onClick={() => setForm({ ...form, tag: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input className="field" placeholder="標籤" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          <label className="label">狀態</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`btn sm ${form.status === s ? 'accent' : 'ghost'}`}
                onClick={() => setForm({ ...form, status: s })}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="label">下次跟進</label>
          <input className="field" type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <textarea className="field" rows={3} placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="row">
            <button type="button" className="btn accent" onClick={saveForm}>
              {editingId ? '更新' : '儲存'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditingId(null)
                  setForm(empty)
                }}
              >
                取消編輯
              </button>
            )}
          </div>
        </div>

        <div className="panel stack">
          <input className="field" placeholder="搜尋姓名／公司／Email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="muted">標籤</span>
            <select className="field" style={{ width: 120 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="全部">全部</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="muted">顯示 {filtered.length}</span>
          </div>
          <ul className="list">
            {filtered.map((c) => {
              const due = c.next && c.next <= today && c.status !== '成交'
              return (
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
                    <span className="mono" style={due ? { color: 'var(--rose)' } : undefined}>
                      下次：{c.next || '—'}
                      {due ? ' · 需跟進' : ''}
                    </span>
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
                    <button type="button" className="btn sm ghost" onClick={() => startEdit(c)}>
                      編輯
                    </button>
                    {c.email && (
                      <button type="button" className="btn sm ghost" onClick={() => void copyText(c.email)}>
                        複製 Email
                      </button>
                    )}
                    <button type="button" className="btn sm danger" onClick={() => setContacts((xs) => xs.filter((x) => x.id !== c.id))}>
                      刪除
                    </button>
                  </div>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="muted">無符合結果</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
