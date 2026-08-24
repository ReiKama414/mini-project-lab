import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

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
  const [filterProject, setFilterProject] = useState<string>('全部')
  const [newProject, setNewProject] = useState('')

  const visible = useMemo(
    () => tasks.filter((t) => filterProject === '全部' || t.projectId === filterProject),
    [tasks, filterProject],
  )

  const progress = useMemo(() => {
    if (!visible.length) return 0
    return Math.round((visible.filter((t) => t.status === 'done').length / visible.length) * 100)
  }, [visible])

  function projectName(id: string) {
    return projects.find((p) => p.id === id)?.name || '—'
  }

  function move(id: string, status: Status) {
    setTasks((xs) => xs.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select className="field" style={{ width: 140 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input className="field" style={{ flex: 1 }} placeholder="任務標題" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="field" style={{ width: 90 }} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIO.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              if (!title.trim()) return
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
        <div className="row">
          <input className="field" placeholder="新專案名稱" value={newProject} onChange={(e) => setNewProject(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (!newProject.trim()) return
              const p = { id: uid('p'), name: newProject.trim() }
              setProjects((xs) => [...xs, p])
              setProjectId(p.id)
              setNewProject('')
            }}
          >
            新增專案
          </button>
          <span className="muted">篩選專案</span>
          <select className="field" style={{ width: 140 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="全部">全部</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="metric">進度 {progress}%</span>
        </div>
        <div className="progress">
          <div style={{ width: `${progress}%`, height: 8, borderRadius: 4, background: '#3b82f6' }} />
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
                .map((t) => (
                  <li key={t.id} className="list-item stack">
                    <div>{t.title}</div>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <span className="tag">{projectName(t.projectId)}</span>
                      <span className="tag">優先 {t.priority}</span>
                      <span className="mono muted">{t.due || '無期限'}</span>
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
                ))}
            </ul>
          </div>
        ))}
      </div>
    </ProjectShell>
  )
}
