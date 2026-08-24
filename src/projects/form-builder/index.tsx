import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('form-builder')!

type FieldType = 'text' | 'email' | 'select' | 'textarea'
type Field = { id: string; label: string; type: FieldType; options?: string }

export default function Page() {
  const [fields, setFields] = useLocalStorage<Field[]>('lab:form-builder', [
    { id: '1', label: '姓名', type: 'text' },
    { id: '2', label: 'Email', type: 'email' },
    { id: '3', label: '方案', type: 'select', options: '免費,專業,企業' },
    { id: '4', label: '留言', type: 'textarea' },
  ])
  const [title, setTitle] = useLocalStorage('lab:form-builder:title', '聯絡我們')
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState('')

  function add(type: FieldType) {
    setFields((fs) => [...fs, { id: uid('f'), label: `欄位 ${fs.length + 1}`, type, options: type === 'select' ? 'A,B,C' : undefined }])
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">表單標題</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['text', 'email', 'select', 'textarea'] as FieldType[]).map((t) => (
              <button key={t} type="button" className="btn sm ghost" onClick={() => add(t)}>
                + {t}
              </button>
            ))}
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="list-item row">
              <span className="mono muted">{i + 1}</span>
              <input className="field" style={{ flex: 1 }} value={f.label} onChange={(e) => setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))} />
              <span className="tag">{f.type}</span>
              <button type="button" className="btn sm danger" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}>
                刪
              </button>
            </div>
          ))}
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>{title}</h3>
          {fields.map((f) => (
            <div key={f.id} className="stack" style={{ gap: 4 }}>
              <label className="label">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea className="field" rows={3} value={values[f.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} />
              ) : f.type === 'select' ? (
                <select className="field" value={values[f.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}>
                  <option value="">請選擇</option>
                  {(f.options || '').split(/[,，]/).map((o) => o.trim()).filter(Boolean).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="field" type={f.type} value={values[f.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} />
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              const lines = fields.map((f) => `${f.label}: ${values[f.id] || '（空）'}`).join('\n')
              setSubmitted(lines)
            }}
          >
            預覽送出
          </button>
          {submitted && (
            <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
              {submitted}
            </pre>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
