import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid, charCount, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('project-management')!

type Status = 'todo' | 'doing' | 'done'
type Priority = '低' | '中' | '高'
type Project = { id: string; name: string }
type Task = { id: string; title: string; projectId: string; status: Status; priority: Priority; due: string }

const cols: { key: Status; label: string }[] = [
  { key: 'todo', label: '待辦' },
  { key: 'doing', label: '進行中' },
  { key: 'done', label: '完成' },
]

const PRIO: Priority[] = ['低', '中', '高']

const MAX_TASKS = 200
const MAX_PROJECTS = 50
const MAX_TITLE = 80
const MAX_PROJECT_NAME = 40
const MAX_SEARCH = 80

function isValidDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

const TASK_PRESETS = [
  { title: '撰寫需求文件', priority: '中' as Priority, status: 'todo' as Status },
  { title: '程式碼審查', priority: '高' as Priority, status: 'doing' as Status },
  { title: '上線檢查清單', priority: '高' as Priority, status: 'todo' as Status },
  { title: '週會簡報', priority: '低' as Priority, status: 'todo' as Status },
]

export default function Page() {
  const [projects, setProjects] = useLocalStorage<Project[]>('lab:project-management:projects', [
    { id: 'p1', name: 'Lab App' },
    { id: 'p2', name: '側專案' },
  ])
  const [tasks, setTasks] = useLocalStorage<Task[]>('lab:project-management', [
    { id: '1', title: '撰寫需求', projectId: 'p1', status: 'done', priority: '中', due: '2026-08-20' },
    { id: '2', title: '實作看板', projectId: 'p1', status: 'doing', priority: '高', due: '2026-08-26' },
    { id: '3', title: '上線檢查', projectId: 'p1', status: 'todo', priority: '高', due: '2026-08-30' },
    { id: '4', title: 'Landing 文案', projectId: 'p2', status: 'todo', priority: '低', due: '2026-09-05' },
  ])
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useLocalStorage('lab:project-management:sel', 'p1')
  const [priority, setPriority] = useState<Priority>('中')
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterProject, setFilterProject] = useLocalStorage('lab:project-management:filterProj', '全部')
  const [filterPrio, setFilterPrio] = useLocalStorage<Priority | '全部'>('lab:project-management:filterPrio', '全部')
  const [filterStatus, setFilterStatus] = useLocalStorage<Status | '全部'>('lab:project-management:filterStatus', '全部')
  const [q, setQ] = useState('')
  const [newProject, setNewProject] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const titleOk = isNonEmpty(title)
  const dueOk = isValidDate(due)
  const tasksAtLimit = tasks.length >= MAX_TASKS
  const canAddTask = titleOk && dueOk && !tasksAtLimit
  const projectOk = isNonEmpty(newProject)
  const canAddProject = projectOk && projects.length < MAX_PROJECTS

  const visible = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (filterProject !== '全部' && t.projectId !== filterProject) return false
      if (filterPrio !== '全部' && t.priority !== filterPrio) return false
      if (filterStatus !== '全部' && t.status !== filterStatus) return false
      if (qq && !t.title.toLowerCase().includes(qq)) return false
      return true
    })
  }, [tasks, filterProject, filterPrio, filterStatus, q])

  const progress = useMemo(() => {
    if (!visible.length) return 0
    return Math.round((visible.filter((t) => t.status === 'done').length / visible.length) * 100)
  }, [visible])

  const stats = useMemo(() => {
    const overdue = tasks.filter((t) => t.status !== 'done' && t.due && t.due < today).length
    const high = tasks.filter((t) => t.priority === '高' && t.status !== 'done').length
    const byStatus = {
      todo: tasks.filter((t) => t.status === 'todo').length,
      doing: tasks.filter((t) => t.status === 'doing').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }
    return { overdue, high, byStatus, total: tasks.length }
  }, [tasks, today])

  function projectName(id: string) {
    return projects.find((p) => p.id === id)?.name || '—'
  }

  function move(id: string, status: Status) {
    setTasks((xs) => xs.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  function exportCsv() {
    const lines = [
      '標題,專案,狀態,優先,期限',
      ...tasks.map((t) =>
        [t.title, projectName(t.projectId), t.status, t.priority, t.due].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
      ),
    ]
    downloadText('projects-tasks.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  function addPreset(p: (typeof TASK_PRESETS)[number]) {
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
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" onClick={exportCsv}>
          匯出 CSV
        </button>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">任務 {stats.total}</span>
        <span className="tag">待辦 {stats.byStatus.todo}</span>
        <span className="tag">進行 {stats.byStatus.doing}</span>
        <span className="tag">完成 {stats.byStatus.done}</span>
        <span className="tag" style={stats.overdue ? { background: 'var(--rose-soft)', color: 'var(--rose)' } : undefined}>
          逾期 {stats.overdue}
        </span>
        <span className="tag">高優先未完 {stats.high}</span>
        <span className="metric">進度 {progress}%</span>
      </div>

      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select className="field" style={{ width: 140 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="stack" style={{ flex: 1, minWidth: 140, gap: 0 }}>
            <input className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`} style={{ width: '100%' }} placeholder="任務標題" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!titleOk && title.length > 0 ? 'warn' : undefined}>{!titleOk && title.length > 0 ? '請輸入標題' : ' '}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>
          <select className="field" style={{ width: 90 }} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input className={`field${!dueOk ? ' is-invalid' : ''}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button
            type="button"
            className="btn accent"
            disabled={!canAddTask}
            onClick={() => {
              if (!canAddTask) return
              setTasks((xs) => [
                ...xs,
                { id: uid('t'), title: title.trim(), projectId, status: 'todo', priority, due },
              ])
              setTitle('')
            }}
          >
            新增任務
          </button>
        </div>
        {tasksAtLimit && <p className="field-error">已達上限 {MAX_TASKS} 個任務</p>}
        {!dueOk && <p className="field-error">請選擇有效期限</p>}

        <div>
          <div className="label">快速預設任務</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {TASK_PRESETS.map((p) => (
              <button key={p.title} type="button" className="btn sm ghost" onClick={() => addPreset(p)}>
                + {p.title}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: 0, flex: 1 }}>
            <input className="field" placeholder="新專案名稱" value={newProject} maxLength={MAX_PROJECT_NAME} onChange={(e) => setNewProject(limitText(e.target.value, MAX_PROJECT_NAME))} />
            <div className="field-meta"><span className={projects.length >= MAX_PROJECTS ? 'warn' : undefined}>{projects.length >= MAX_PROJECTS ? `專案上限 ${MAX_PROJECTS}` : ' '}</span><span>{charCount(newProject)} / {MAX_PROJECT_NAME}</span></div>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={!canAddProject}
            onClick={() => {
              if (!canAddProject) return
              const p = { id: uid('p'), name: newProject.trim() }
              setProjects((xs) => [...xs, p])
              setProjectId(p.id)
              setNewProject('')
            }}
          >
            新增專案
          </button>
          <div className="stack" style={{ flex: 1, minWidth: 120, gap: 0 }}>
            <input className="field" style={{ width: '100%' }} placeholder="搜尋任務…" value={q} maxLength={MAX_SEARCH} onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))} />
            <div className="field-meta"><span /><span>{charCount(q)} / {MAX_SEARCH}</span></div>
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="muted">專案</span>
          <select className="field" style={{ width: 120 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="全部">全部</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="muted">優先</span>
          <select
            className="field"
            style={{ width: 90 }}
            value={filterPrio}
            onChange={(e) => setFilterPrio(e.target.value as Priority | '全部')}
          >
            <option value="全部">全部</option>
            {PRIO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="muted">狀態</span>
          <select
            className="field"
            style={{ width: 110 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as Status | '全部')}
          >
            <option value="全部">全部</option>
            {cols.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setFilterProject('全部')
              setFilterPrio('全部')
              setFilterStatus('全部')
              setQ('')
            }}
          >
            清除篩選
          </button>
        </div>

        <div className="progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="kanban">
        {cols.map((col) => (
          <div key={col.key} className="kanban-col panel">
            <strong>
              {col.label}{' '}
              <span className="muted">{visible.filter((t) => t.status === col.key).length}</span>
            </strong>
            <ul className="list">
              {visible
                .filter((t) => t.status === col.key)
                .sort((a, b) => (a.due || '').localeCompare(b.due || '') || PRIO.indexOf(b.priority) - PRIO.indexOf(a.priority))
                .map((t) => {
                  const overdue = t.status !== 'done' && t.due && t.due < today
                  return (
                    <li key={t.id} className="list-item stack">
                      <div>{t.title}</div>
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        <span className="tag">{projectName(t.projectId)}</span>
                        <span className="tag">優先 {t.priority}</span>
                        <span className="mono muted" style={overdue ? { color: 'var(--rose)' } : undefined}>
                          {t.due || '無期限'}
                          {overdue ? ' · 逾期' : ''}
                        </span>
                      </div>
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        {cols
                          .filter((c) => c.key !== t.status)
                          .map((c) => (
                            <button key={c.key} type="button" className="btn sm ghost" onClick={() => move(t.id, c.key)}>
                              → {c.label}
                            </button>
                          ))}
                        <button type="button" className="btn sm danger" onClick={() => setTasks((xs) => xs.filter((x) => x.id !== t.id))}>
                          刪
                        </button>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </ProjectShell>
  )
}
