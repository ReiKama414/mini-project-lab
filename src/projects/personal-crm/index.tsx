import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('personal-crm')!

type Contact = { id: string; name: string; company: string; note: string; next: string; tag: string }

const seed: Contact[] = [
  { id: '1', name: '陳雅婷', company: '北極星科技', note: '對設計系統有興趣', next: '2026-08-28', tag: '潛在客戶' },
  { id: '2', name: '林志豪', company: '獨立開發', note: '可合作開源', next: '2026-09-01', tag: '夥伴' },
]

export default function Page() {
  const [contacts, setContacts] = useLocalStorage<Contact[]>('lab:personal-crm', seed)
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ name: '', company: '', note: '', next: '', tag: '一般' })

  const filtered = contacts.filter((c) => `${c.name}${c.company}${c.tag}`.includes(q))

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">新增聯絡人</div>
          <input className="field" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="公司" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="field" placeholder="標籤" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          <input className="field" type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <textarea className="field" rows={3} placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!form.name.trim()) return
              setContacts((xs) => [{ id: uid('c'), ...form, name: form.name.trim() }, ...xs])
              setForm({ name: '', company: '', note: '', next: '', tag: '一般' })
            }}
          >
            儲存
          </button>
        </div>
        <div className="panel stack">
          <input className="field" placeholder="搜尋…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="list">
            {filtered.map((c) => (
              <li key={c.id} className="list-item stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    {c.name} <span className="muted">{c.company}</span>
                  </strong>
                  <span className="tag">{c.tag}</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {c.note || '無備註'}
                </p>
                <div className="row">
                  <span className="mono">下次跟進：{c.next || '—'}</span>
                  <button type="button" className="btn sm danger" onClick={() => setContacts((xs) => xs.filter((x) => x.id !== c.id))}>
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
