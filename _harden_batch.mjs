import fs from 'fs'
import path from 'path'

const root = 'src/projects'
const nbsp = '\u00a0'

function patchFile(rel, transform) {
  const p = path.join(root, rel)
  let s = fs.readFileSync(p, 'utf8')
  const next = transform(s)
  fs.writeFileSync(p, next)
  console.log(next === s ? `NO CHANGE ${rel}` : `patched ${rel}`)
}

// personal-crm
patchFile('personal-crm/index.tsx', (s) => {
  s = s.replace(
    "import { uid, downloadText, copyText } from '../../lib/utils'",
    "import { uid, downloadText, copyText, charCount, isNonEmpty, isValidEmail, limitText } from '../../lib/utils'",
  )
  if (!s.includes('const MAX_ITEMS = 200')) {
    s = s.replace(
      "const empty = { name: '', company: '', email: '', note: '', next: '', status: '潛在' as Status, tag: '一般' }",
      `const MAX_ITEMS = 200
const MAX_NAME = 60
const MAX_COMPANY = 80
const MAX_EMAIL = 120
const MAX_TAG = 40
const MAX_NOTE = 1000
const MAX_SEARCH = 80

function isValidDate(iso: string) {
  if (!iso) return true
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

const empty = { name: '', company: '', email: '', note: '', next: '', status: '潛在' as Status, tag: '一般' }`,
    )
  }
  s = s.replace(
    `  function saveForm() {
    if (!form.name.trim()) return
    if (editingId) {
      setContacts((xs) => xs.map((x) => (x.id === editingId ? { ...x, ...form, name: form.name.trim() } : x)))
      setEditingId(null)
    } else {
      setContacts((xs) => [{ id: uid('c'), ...form, name: form.name.trim() }, ...xs])
    }
    setForm(empty)
  }`,
    `  const nameOk = isNonEmpty(form.name)
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
  }`,
  )
  s = s.replace(
    `          <input className="field" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="公司" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />`,
    `          <div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${form.name.length > 0 && !nameOk ? ' is-invalid' : ''}\`} placeholder="姓名" value={form.name} maxLength={MAX_NAME} onChange={(e) => setForm({ ...form, name: limitText(e.target.value, MAX_NAME) })} />
            <div className="field-meta"><span className={!nameOk && form.name.length > 0 ? 'warn' : undefined}>{!nameOk && form.name.length > 0 ? '請輸入姓名' : '${nbsp}'}</span><span>{charCount(form.name)} / {MAX_NAME}</span></div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" placeholder="公司" value={form.company} maxLength={MAX_COMPANY} onChange={(e) => setForm({ ...form, company: limitText(e.target.value, MAX_COMPANY) })} />
            <div className="field-meta"><span /><span>{charCount(form.company)} / {MAX_COMPANY}</span></div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${form.email.trim() && !emailOk ? ' is-invalid' : ''}\`} placeholder="Email" type="email" value={form.email} maxLength={MAX_EMAIL} onChange={(e) => setForm({ ...form, email: limitText(e.target.value, MAX_EMAIL) })} />
            <div className="field-meta"><span className={form.email.trim() && !emailOk ? 'warn' : undefined}>{form.email.trim() && !emailOk ? 'Email 格式無效' : '${nbsp}'}</span><span>{charCount(form.email)} / {MAX_EMAIL}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input className="field" placeholder="標籤" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />`,
    `<div className="stack" style={{ gap: 0 }}>
            <input className="field" placeholder="標籤" value={form.tag} maxLength={MAX_TAG} onChange={(e) => setForm({ ...form, tag: limitText(e.target.value, MAX_TAG) })} />
            <div className="field-meta"><span /><span>{charCount(form.tag)} / {MAX_TAG}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input className="field" type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <textarea className="field" rows={3} placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="row">
            <button type="button" className="btn accent" onClick={saveForm}>
              {editingId ? '更新' : '儲存'}
            </button>`,
    `<input className={\`field\${!nextOk ? ' is-invalid' : ''}\`} type="date" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          {!nextOk && <p className="field-error">請選擇有效日期</p>}
          <div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={3} placeholder="備註" value={form.note} maxLength={MAX_NOTE} onChange={(e) => setForm({ ...form, note: limitText(e.target.value, MAX_NOTE) })} />
            <div className="field-meta"><span /><span>{charCount(form.note)} / {MAX_NOTE}</span></div>
          </div>
          {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 位聯絡人</p>}
          <div className="row">
            <button type="button" className="btn accent" onClick={saveForm} disabled={!canSave}>
              {editingId ? '更新' : '儲存'}
            </button>`,
  )
  s = s.replace(
    `<input className="field" placeholder="搜尋姓名／公司／Email…" value={q} onChange={(e) => setQ(e.target.value)} />`,
    `<div className="stack" style={{ gap: 0, flex: 1 }}>
            <input className="field" placeholder="搜尋姓名／公司／Email…" value={q} maxLength={MAX_SEARCH} onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))} />
            <div className="field-meta"><span /><span>{charCount(q)} / {MAX_SEARCH}</span></div>
          </div>`,
  )
  return s
})

// project-management
patchFile('project-management/index.tsx', (s) => {
  s = s.replace(
    "import { downloadText, uid } from '../../lib/utils'",
    "import { downloadText, uid, charCount, clamp, isNonEmpty, limitText } from '../../lib/utils'",
  )
  if (!s.includes('MAX_TASKS')) {
    s = s.replace(
      'const TASK_PRESETS = [',
      `const MAX_TASKS = 200
const MAX_PROJECTS = 50
const MAX_TITLE = 80
const MAX_PROJECT_NAME = 40
const MAX_SEARCH = 80

function isValidDate(iso: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

const TASK_PRESETS = [`,
    )
  }
  s = s.replace(
    `  const today = new Date().toISOString().slice(0, 10)

  const visible = useMemo(() => {`,
    `  const today = new Date().toISOString().slice(0, 10)
  const titleOk = isNonEmpty(title)
  const dueOk = isValidDate(due)
  const tasksAtLimit = tasks.length >= MAX_TASKS
  const canAddTask = titleOk && dueOk && !tasksAtLimit
  const projectOk = isNonEmpty(newProject)
  const canAddProject = projectOk && projects.length < MAX_PROJECTS

  const visible = useMemo(() => {`,
  )
  s = s.replace(
    `  function addPreset(p: (typeof TASK_PRESETS)[number]) {
    setTasks((xs) => [
      ...xs,
      {
        id: uid('t'),
        title: p.title,
        projectId,
        status: p.status,
        priority: p.priority,
        due,
      },
    ])
  }`,
    `  function addPreset(p: (typeof TASK_PRESETS)[number]) {
    if (tasks.length >= MAX_TASKS || !dueOk) return
    setTasks((xs) => [
      ...xs,
      {
        id: uid('t'),
        title: p.title,
        projectId,
        status: p.status,
        priority: p.priority,
        due,
      },
    ])
  }`,
  )
  // Find add task button block - read around line 140
  s = s.replace(
    `<input className="field" style={{ flex: 1, minWidth: 140 }} placeholder="任務標題" value={title} onChange={(e) => setTitle(e.target.value)} />`,
    `<div className="stack" style={{ flex: 1, minWidth: 140, gap: 0 }}>
            <input className={\`field\${title.length > 0 && !titleOk ? ' is-invalid' : ''}\`} style={{ width: '100%' }} placeholder="任務標題" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!titleOk && title.length > 0 ? 'warn' : undefined}>{!titleOk && title.length > 0 ? '請輸入標題' : '${nbsp}'}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>`,
  )
  s = s.replace(
    /type="date" value=\{due\} onChange=\{\(e\) => setDue\(e\.target\.value\)\}/,
    `type="date" className={\`field\${!dueOk ? ' is-invalid' : ''}\`} value={due} onChange={(e) => setDue(e.target.value)}`,
  )
  // fix duplicate className if any - project uses className="field" type="date"
  s = s.replace(
    /className="field" type="date" className=\{`field\$\{!dueOk \? ' is-invalid' : ''\}`\}/,
    `className={\`field\${!dueOk ? ' is-invalid' : ''}\`} type="date"`,
  )
  s = s.replace(
    /onClick=\{\(\) => \{\s*if \(!title\.trim\(\)\) return\s*setTasks\(\(xs\) => \[\s*\.\.\.xs,\s*\{\s*id: uid\('t'\),\s*title: title\.trim\(\),\s*projectId,\s*status: 'todo',\s*priority,\s*due,\s*\},\s*\]\)\s*setTitle\(''\)\s*\}\}/,
    `onClick={() => {
              if (!canAddTask) return
              setTasks((xs) => [
                ...xs,
                {
                  id: uid('t'),
                  title: title.trim(),
                  projectId,
                  status: 'todo',
                  priority,
                  due,
                },
              ])
              setTitle('')
            }}
            disabled={!canAddTask}`,
  )
  s = s.replace(
    `<input className="field" placeholder="新專案名稱" value={newProject} onChange={(e) => setNewProject(e.target.value)} />`,
    `<div className="stack" style={{ gap: 0, flex: 1 }}>
            <input className="field" placeholder="新專案名稱" value={newProject} maxLength={MAX_PROJECT_NAME} onChange={(e) => setNewProject(limitText(e.target.value, MAX_PROJECT_NAME))} />
            <div className="field-meta"><span className={projects.length >= MAX_PROJECTS ? 'warn' : undefined}>{projects.length >= MAX_PROJECTS ? \`專案上限 \${MAX_PROJECTS}\` : '${nbsp}'}</span><span>{charCount(newProject)} / {MAX_PROJECT_NAME}</span></div>
          </div>`,
  )
  s = s.replace(
    /if \(!newProject\.trim\(\)\) return\s*const id = uid\('p'\)\s*setProjects\(\(xs\) => \[\.\.\.xs, \{ id, name: newProject\.trim\(\) \}\]\)/,
    `if (!canAddProject) return
            const id = uid('p')
            setProjects((xs) => [...xs, { id, name: newProject.trim() }])`,
  )
  s = s.replace(
    `<input className="field" style={{ flex: 1, minWidth: 120 }} placeholder="搜尋任務…" value={q} onChange={(e) => setQ(e.target.value)} />`,
    `<div className="stack" style={{ flex: 1, minWidth: 120, gap: 0 }}>
            <input className="field" style={{ width: '100%' }} placeholder="搜尋任務…" value={q} maxLength={MAX_SEARCH} onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))} />
            <div className="field-meta"><span /><span>{charCount(q)} / {MAX_SEARCH}</span></div>
          </div>`,
  )
  return s
})

// anonymous-feedback
patchFile('anonymous-feedback/index.tsx', (s) => {
  s = s.replace(
    "import { uid, downloadText } from '../../lib/utils'",
    "import { uid, downloadText, charCount, isNonEmpty, limitText } from '../../lib/utils'",
  )
  if (!s.includes('MAX_ITEMS')) {
    s = s.replace(
      'const CATS: Cat[] = ',
      `const MAX_ITEMS = 200
const MAX_TEXT = 1000
const MAX_BOARD = 40
const MAX_REPLY = 500

const CATS: Cat[] = `,
    )
  }
  s = s.replace(
    `  const [editing, setEditing] = useState<string | null>(null)

  // migrate legacy`,
    `  const [editing, setEditing] = useState<string | null>(null)
  const textOk = isNonEmpty(text)
  const atLimit = items.length >= MAX_ITEMS
  const canSubmit = textOk && !atLimit

  // migrate legacy`,
  )
  // submit handler
  s = s.replace(
    /if \(!text\.trim\(\)\) return/,
    `if (!canSubmit) return`,
  )
  s = s.replace(
    /text: text\.trim\(\)/,
    `text: limitText(text.trim(), MAX_TEXT)`,
  )
  s = s.replace(
    `<input className="field" value={boardName} onChange={(e) => setBoardName(e.target.value)} />`,
    `<div className="stack" style={{ gap: 0 }}>
          <input className="field" value={boardName} maxLength={MAX_BOARD} onChange={(e) => setBoardName(limitText(e.target.value, MAX_BOARD))} />
          <div className="field-meta"><span /><span>{charCount(boardName)} / {MAX_BOARD}</span></div>
        </div>`,
  )
  s = s.replace(
    /placeholder="匿名留下想法…"[\s\S]*?onChange=\{\(e\) => setText\(e\.target\.value\)\}/,
    `placeholder="匿名留下想法…"
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(limitText(e.target.value, MAX_TEXT))}`,
  )
  // add meta after textarea - find submit button
  s = s.replace(
    /(<button[^>]*onClick=\{submit\}[^>]*>[\s\S]*?<\/button>)/,
    (m) => {
      if (m.includes('disabled')) return m
      return m.replace('onClick={submit}', 'onClick={submit} disabled={!canSubmit}')
    },
  )
  return s
})

console.log('batch1 done')
