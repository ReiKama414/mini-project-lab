import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, charCount, isNonEmpty, isValidEmail, limitText } from '../../lib/utils'

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

const MAX_ITEMS = 200
const MAX_NAME = 60
const MAX_COMPANY = 80
const MAX_EMAIL = 120
const MAX_TAG = 40
const MAX_NOTE = 1000
const MAX_SEARCH = 80

function isValidDate(iso: string) {
  if (!iso) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

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

  const nameOk = isNonEmpty(form.name)
  const emailOk = !form.email.trim() || isValidEmail(form.email)
  const nextOk = isValidDate(form.next)
  const atLimit = !editingId && contacts.length >= MAX_ITEMS
  const canSave = nameOk && emailOk && nextOk && !atLimit

  function saveForm() {
    if (!canSave) return
    const payload = {
      ...form,
      name: limitText(form.name.trim(), MAX_NAME),
      company: limitText(form.company.trim(), MAX_COMPANY),
      email: limitText(form.email.trim(), MAX_EMAIL),
      note: limitText(form.note, MAX_NOTE),
      tag: limitText(form.tag.trim() || '一般', MAX_TAG),
    }
    if (editingId) {
      setContacts((xs) => xs.map((x) => (x.id === editingId ? { ...x, ...payload } : x)))
      setEditingId(null)
    } else {
      setContacts((xs) => [{ id: uid('c'), ...payload }, ...xs])
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
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${form.name.length > 0 && !nameOk ? ' is-invalid' : ''}`} placeholder="姓名" value={form.name} maxLength={MAX_NAME} onChange={(e) => setForm({ ...form, name: limitText(e.target.value, MAX_NAME) })} />
            <div className="field-meta"><span className={!nameOk && form.name.length > 0 ? 'warn' : undefined}>{!nameOk && form.name.length > 0 ? '請輸入姓名' : ' '}</span><span>{charCount(form.name)} / {MAX_NAME}</span></div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" placeholder="公司" value={form.company} maxLength={MAX_COMPANY} onChange={(e) => setForm({ ...form, company: limitText(e.target.value, MAX_COMPANY) })} />
            <div className="field-meta"><span /><span>{charCount(form.company)} / {MAX_COMPANY}</span></div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${form.email.trim() && !emailOk ? ' is-invalid' : ''}`} placeholder="Email" type="email" value={form.email} maxLength={MAX_EMAIL} onChange={(e) => setForm({ ...form, email: limitText(e.target.value, MAX_EMAIL) })} />
            <div className="field-meta"><span className={form.email.trim() && !emailOk ? 'warn' : undefined}>{form.email.trim() && !emailOk ? 'Email 格式無效' : ' '}</span><span>{charCount(form.email)} / {MAX_EMAIL}</span></div>
          </div>
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
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" placeholder="標籤" value={form.tag} maxLength={MAX_TAG} onChange={(e) => setForm({ ...form, tag: limitText(e.target.value, MAX_TAG) })} />
            <div className="field-meta"><span /><span>{charCount(form.tag)} / {MAX_TAG}</span></div>
          </div>
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
          <input className={`field${!nextOk ? ' is-invalid' : ''}`} type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          {!nextOk && <p className="field-error">請選擇有效日期</p>}
          <div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={3} placeholder="備註" value={form.note} maxLength={MAX_NOTE} onChange={(e) => setForm({ ...form, note: limitText(e.target.value, MAX_NOTE) })} />
            <div className="field-meta"><span /><span>{charCount(form.note)} / {MAX_NOTE}</span></div>
          </div>
          {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 位聯絡人</p>}
          <div className="row">
            <button type="button" className="btn accent" onClick={saveForm} disabled={!canSave}>
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
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="field-wrap" style={{ flex: 1, minWidth: 160 }}>
              <input className="field" style={{ width: '100%' }} placeholder="搜尋姓名／公司／Email…" value={q} maxLength={MAX_SEARCH} onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))} />
              <div className="field-meta"><span /><span>{charCount(q)} / {MAX_SEARCH}</span></div>
            </div>
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
                      style={{ width: 'auto', minWidth: '8rem' }}
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
