import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('project-management')!

type Status = 'todo' | 'doing' | 'done'
type Task = { id: string; title: string; project: string; status: Status }

const cols: { key: Status; label: string }[] = [
  { key: 'todo', label: '待辦' },
  { key: 'doing', label: '進行中' },
  { key: 'done', label: '完成' },
]

export default function Page() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('lab:project-management', [
    { id: '1', title: '撰寫需求', project: 'Lab App', status: 'done' },
    { id: '2', title: '實作看板', project: 'Lab App', status: 'doing' },
    { id: '3', title: '上線檢查', project: 'Lab App', status: 'todo' },
  ])
  const [title, setTitle] = useState('')
  const [project, setProject] = useLocalStorage('lab:project-management:project', 'Lab App')

  const progress = useMemo(() => {
    if (!tasks.length) return 0
    return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
  }, [tasks])

  function move(id: string, status: Status) {
    setTasks((xs) => xs.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12 }}>
        <input className="field" placeholder="專案名" value={project} onChange={(e) => setProject(e.target.value)} />
        <input className="field" style={{ flex: 1 }} placeholder="任務" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button
          type="button"
          className="btn accent"
          onClick={() => {
            if (!title.trim()) return
            setTasks((xs) => [...xs, { id: uid('t'), title: title.trim(), project, status: 'todo' }])
            setTitle('')
          }}
        >
          新增任務
        </button>
        <span className="metric">進度 {progress}%</span>
      </div>
      <div className="progress" style={{ marginBottom: 12 }}>
        <div style={{ width: `${progress}%`, height: 8, borderRadius: 4, background: '#3b82f6' }} />
      </div>
      <div className="kanban">
        {cols.map((col) => (
          <div key={col.key} className="kanban-col panel">
            <strong>{col.label}</strong>
            <ul className="list">
              {tasks
                .filter((t) => t.status === col.key)
                .map((t) => (
                  <li key={t.id} className="list-item stack">
                    <div>{t.title}</div>
                    <span className="tag">{t.project}</span>
                    <div className="row">
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
