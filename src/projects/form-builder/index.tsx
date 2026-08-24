import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText } from '../../lib/utils'

const meta = getProject('form-builder')!

type FieldType = 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox'
type Field = { id: string; label: string; type: FieldType; required: boolean; options?: string }
type Submission = { id: string; at: number; values: Record<string, string> }

export default function Page() {
  const [fields, setFields] = useLocalStorage<Field[]>('lab:form-builder', [
    { id: '1', label: '姓名', type: 'text', required: true },
    { id: '2', label: 'Email', type: 'email', required: true },
    { id: '3', label: '方案', type: 'select', required: true, options: '免費,專業,企業' },
    { id: '4', label: '訂閱電子報', type: 'checkbox', required: false },
    { id: '5', label: '留言', type: 'textarea', required: false },
  ])
  const [title, setTitle] = useLocalStorage('lab:form-builder:title', '聯絡我們')
  const [desc, setDesc] = useLocalStorage('lab:form-builder:desc', '留下訊息，我們會盡快回覆。')
  const [submissions, setSubmissions] = useLocalStorage<Submission[]>('lab:form-builder:subs', [])
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'build' | 'preview' | 'inbox'>('build')

  function add(type: FieldType) {
    setFields((fs) => [
      ...fs,
      {
        id: uid('f'),
        label: `欄位 ${fs.length + 1}`,
        type,
        required: false,
        options: type === 'select' ? 'A,B,C' : undefined,
      },
    ])
  }

  function submit() {
    for (const f of fields) {
      const v = (values[f.id] || '').trim()
      if (f.required && f.type !== 'checkbox' && !v) {
        setError(`「${f.label}」為必填`)
        return
      }
      if (f.required && f.type === 'checkbox' && values[f.id] !== '是') {
        setError(`請勾選「${f.label}」`)
        return
      }
    }
    setError('')
    setSubmissions((xs) => [{ id: uid('s'), at: Date.now(), values: { ...values } }, ...xs])
    setValues({})
    setTab('inbox')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        {([
          ['build', '編輯欄位'],
          ['preview', '即時預覽'],
          ['inbox', `回覆（${submissions.length}）`],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" className={`btn sm ${tab === k ? 'accent' : 'ghost'}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'build' && (
        <div className="panel stack">
          <label className="label">表單標題</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="label">說明</label>
          <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['text', 'email', 'number', 'select', 'textarea', 'checkbox'] as FieldType[]).map((t) => (
              <button key={t} type="button" className="btn sm ghost" onClick={() => add(t)}>
                + {t}
              </button>
            ))}
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="list-item stack">
              <div className="row">
                <span className="mono muted">{i + 1}</span>
                <input
                  className="field"
                  style={{ flex: 1 }}
                  value={f.label}
                  onChange={(e) => setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                />
                <span className="tag">{f.type}</span>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={() => setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, required: !x.required } : x)))}
                  />
                  必填
                </label>
                <button type="button" className="btn sm danger" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}>
                  刪
                </button>
              </div>
              {f.type === 'select' && (
                <input
                  className="field"
                  value={f.options || ''}
                  placeholder="選項，逗號分隔"
                  onChange={(e) => setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, options: e.target.value } : x)))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'preview' && (
        <div className="panel stack" style={{ maxWidth: 520 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="muted">{desc}</p>
          {fields.map((f) => (
            <div key={f.id} className="stack" style={{ gap: 4 }}>
              <label className="label">
                {f.label}
                {f.required && <span className="tag">必填</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea className="field" rows={3} value={values[f.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} />
              ) : f.type === 'select' ? (
                <select className="field" value={values[f.id] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}>
                  <option value="">請選擇</option>
                  {(f.options || '')
                    .split(/[,，]/)
                    .map((o) => o.trim())
                    .filter(Boolean)
                    .map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={values[f.id] === '是'}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.checked ? '是' : '否' }))}
                  />
                  同意／勾選
                </label>
              ) : (
                <input
                  className="field"
                  type={f.type}
                  value={values[f.id] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
          {error && <div className="tag">{error}</div>}
          <button type="button" className="btn accent" onClick={submit}>
            送出（存本機）
          </button>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="panel stack">
          <div className="row">
            <span className="label">本機回覆</span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={!submissions.length}
              onClick={() =>
                downloadText(
                  'form-submissions.json',
                  JSON.stringify(
                    submissions.map((s) => ({
                      at: new Date(s.at).toISOString(),
                      ...Object.fromEntries(fields.map((f) => [f.label, s.values[f.id] || ''])),
                    })),
                    null,
                    2,
                  ),
                  'application/json',
                )
              }
            >
              匯出 JSON
            </button>
            <button type="button" className="btn sm danger" onClick={() => setSubmissions([])}>
              清空
            </button>
          </div>
          {submissions.length === 0 && <p className="muted">尚無回覆</p>}
          <ul className="list">
            {submissions.map((s) => (
              <li key={s.id} className="list-item stack">
                <span className="mono muted">{new Date(s.at).toLocaleString('zh-TW')}</span>
                {fields.map((f) => (
                  <div key={f.id}>
                    <strong>{f.label}：</strong>
                    {s.values[f.id] || '（空）'}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProjectShell>
  )
}
