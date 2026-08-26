import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, charCount, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('form-builder')!

type FieldType = 'text' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox'
type Field = { id: string; label: string; type: FieldType; required: boolean; options?: string }
type Submission = { id: string; at: number; values: Record<string, string> }
type Tab = 'build' | 'preview' | 'inbox'

const PRESETS: { label: string; title: string; desc: string; fields: Omit<Field, 'id'>[] }[] = [
  {
    label: '聯絡我們',
    title: '聯絡我們',
    desc: '留下訊息，我們會盡快回覆。',
    fields: [
      { label: '姓名', type: 'text', required: true },
      { label: 'Email', type: 'email', required: true },
      { label: '方案', type: 'select', required: true, options: '免費,專業,企業' },
      { label: '訂閱電子報', type: 'checkbox', required: false },
      { label: '留言', type: 'textarea', required: false },
    ],
  },
  {
    label: '活動報名',
    title: '活動報名表',
    desc: '請填寫以下資料完成報名。',
    fields: [
      { label: '姓名', type: 'text', required: true },
      { label: 'Email', type: 'email', required: true },
      { label: '人數', type: 'number', required: true },
      { label: '場次', type: 'select', required: true, options: '上午場,下午場,晚間場' },
      { label: '飲食需求', type: 'textarea', required: false },
      { label: '同意個資條款', type: 'checkbox', required: true },
    ],
  },
  {
    label: '意見回饋',
    title: '產品意見回饋',
    desc: '告訴我們哪裡可以更好。',
    fields: [
      { label: '暱稱', type: 'text', required: false },
      { label: 'Email', type: 'email', required: false },
      { label: '類型', type: 'select', required: true, options: '建議,問題,稱讚' },
      { label: '內容', type: 'textarea', required: true },
    ],
  },
]

const TYPE_LABEL: Record<FieldType, string> = {
  text: '文字',
  email: 'Email',
  number: '數字',
  select: '選單',
  textarea: '多行',
  checkbox: '勾選',
}

const MAX_FIELDS = 40
const MAX_TITLE = 80
const MAX_LABEL = 80
const MAX_OPTIONS = 200

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
  const [favSchema, setFavSchema] = useLocalStorage<{ title: string; desc: string; fields: Field[] } | null>(
    'lab:form-builder:fav',
    null,
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('build')
  const [okMsg, setOkMsg] = useState('')

  function add(type: FieldType) {
    if (fields.length >= MAX_FIELDS) return
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

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title)
    setDesc(p.desc)
    setFields(p.fields.map((f) => ({ ...f, id: uid('f') })))
    setValues({})
    setError('')
    setTab('build')
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields((fs) => {
      const i = fs.findIndex((f) => f.id === id)
      if (i < 0) return fs
      const j = i + dir
      if (j < 0 || j >= fs.length) return fs
      const next = [...fs]
      const tmp = next[i]!
      next[i] = next[j]!
      next[j] = tmp
      return next
    })
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
    setOkMsg('已送出並存到本機收件匣')
    setTab('inbox')
    setTimeout(() => setOkMsg(''), 2000)
  }

  function exportSchema() {
    downloadText(
      'form-schema.json',
      JSON.stringify({ title, desc, fields }, null, 2),
      'application/json',
    )
  }

  function exportSubs() {
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

  const filledPreview = Object.values(values).filter((v) => v && v !== '否').length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={exportSchema}>
            匯出結構
          </button>
          <button type="button" className="btn ghost sm" disabled={!submissions.length} onClick={exportSubs}>
            匯出回覆
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(
          [
            ['build', '1. 編輯欄位'],
            ['preview', '2. 即時預覽'],
            ['inbox', `3. 回覆（${submissions.length}）`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={`btn sm ${tab === k ? 'accent' : 'ghost'}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <span className="muted">{fields.length} 欄位</span>
        {okMsg && <span className="tag">{okMsg}</span>}
      </div>

      {tab === 'build' && (
        <div className="panel stack">
          <div className="label">表單預設</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                {p.label}
              </button>
            ))}
            {favSchema && (
              <button
                type="button"
                className="btn sm accent"
                onClick={() => {
                  setTitle(favSchema.title)
                  setDesc(favSchema.desc)
                  setFields(favSchema.fields)
                }}
              >
                載入收藏結構
              </button>
            )}
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => setFavSchema({ title, desc, fields })}
            >
              收藏目前結構
            </button>
          </div>
          <div className="row">
            <label className="label">表單標題</label>
            <span className="mono muted">{title.length} 字</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className={`field${!isNonEmpty(title) ? ' is-invalid' : ''}`} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!isNonEmpty(title) ? 'warn' : undefined}>{!isNonEmpty(title) ? '標題不可空白' : ' '}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>
          <div className="row">
            <label className="label">說明</label>
            <span className="mono muted">{desc.length} 字</span>
          </div>
          <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => (
              <button key={t} type="button" className="btn sm ghost" onClick={() => add(t)}>
                + {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {fields.length === 0 ? (
            <div className="list-item stack">
              <strong>尚無欄位</strong>
              <p className="muted" style={{ margin: 0 }}>
                選預設模板，或用上方按鈕新增欄位。
              </p>
            </div>
          ) : (
            fields.map((f, i) => (
              <div key={f.id} className="list-item stack">
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="mono muted">{i + 1}</span>
                  <input
                    className="field"
                    style={{ flex: 1, minWidth: 120 }}
                    value={f.label}
                    maxLength={MAX_LABEL}
                    onChange={(e) =>
                      setFields((fs) =>
                        fs.map((x) =>
                          x.id === f.id ? { ...x, label: limitText(e.target.value, MAX_LABEL) } : x,
                        ),
                      )
                    }
                  />
                  <span className="tag">{TYPE_LABEL[f.type]}</span>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={() => setFields((fs) => fs.map((x) => (x.id === f.id ? { ...x, required: !x.required } : x)))}
                    />
                    必填
                  </label>
                  <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => moveField(f.id, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn sm ghost" disabled={i === fields.length - 1} onClick={() => moveField(f.id, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}>
                    刪
                  </button>
                </div>
                {f.type === 'select' && (
                  <input
                    className="field"
                    value={f.options || ''}
                    placeholder="選項，逗號分隔"
                    maxLength={MAX_OPTIONS}
                    onChange={(e) =>
                      setFields((fs) =>
                        fs.map((x) =>
                          x.id === f.id ? { ...x, options: limitText(e.target.value, MAX_OPTIONS) } : x,
                        ),
                      )
                    }
                  />
                )}
              </div>
            ))
          )}
          <button type="button" className="btn accent" disabled={!fields.length} onClick={() => setTab('preview')}>
            下一步：預覽 →
          </button>
        </div>
      )}

      {tab === 'preview' && (
        <div className="panel stack" style={{ maxWidth: 520 }}>
          {fields.length === 0 ? (
            <div className="list-item stack">
              <strong>沒有可預覽的欄位</strong>
              <button type="button" className="btn ghost" onClick={() => setTab('build')}>
                ← 回去編輯
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ margin: 0 }}>{title || '（未命名表單）'}</h3>
              <p className="muted">{desc || '（無說明）'}</p>
              <div className="muted">
                已填 {filledPreview}/{fields.length} 欄
              </div>
              {fields.map((f) => (
                <div key={f.id} className="stack" style={{ gap: 4 }}>
                  <label className="label">
                    {f.label}
                    {f.required && <span className="tag">必填</span>}
                    {f.type === 'textarea' && (
                      <span className="mono muted" style={{ marginLeft: 8 }}>
                        {(values[f.id] || '').length} 字
                      </span>
                    )}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="field"
                      rows={3}
                      value={values[f.id] || ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    />
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
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => setTab('build')}>
                  ← 編輯
                </button>
                <button type="button" className="btn accent" onClick={submit}>
                  送出（存本機）
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'inbox' && (
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="label">本機回覆</span>
            <span className="metric">{submissions.length}</span>
            <button type="button" className="btn sm ghost" disabled={!submissions.length} onClick={exportSubs}>
              匯出 JSON
            </button>
            <button
              type="button"
              className="btn sm ghost"
              disabled={!submissions.length}
              onClick={() =>
                void copyText(
                  submissions
                    .map((s) =>
                      [`時間：${new Date(s.at).toLocaleString('zh-TW')}`, ...fields.map((f) => `${f.label}：${s.values[f.id] || '（空）'}`)].join(
                        '\n',
                      ),
                    )
                    .join('\n\n'),
                )
              }
            >
              複製全部
            </button>
            <button type="button" className="btn sm danger" disabled={!submissions.length} onClick={() => setSubmissions([])}>
              清空
            </button>
          </div>
          {submissions.length === 0 ? (
            <div className="list-item stack">
              <strong>尚無回覆</strong>
              <p className="muted" style={{ margin: 0 }}>
                在「即時預覽」填寫並送出後，資料會出現在這裡（僅存瀏覽器本機）。
              </p>
              <button type="button" className="btn ghost" onClick={() => setTab('preview')}>
                去預覽填寫 →
              </button>
            </div>
          ) : (
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
                  <DeleteButton onClick={() => setSubmissions((xs) => xs.filter((x) => x.id !== s.id))} label="刪除這筆" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ProjectShell>
  )
}
