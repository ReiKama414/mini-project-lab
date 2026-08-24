import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('portfolio-builder')!

type Project = { id: string; title: string; desc: string; link: string }

export default function Page() {
  const [name, setName] = useLocalStorage('lab:portfolio:name', 'Kamay')
  const [bio, setBio] = useLocalStorage('lab:portfolio:bio', '前端工程師 · 喜歡打造小而美的工具')
  const [accent, setAccent] = useLocalStorage('lab:portfolio:accent', '#0d9488')
  const [projects, setProjects] = useLocalStorage<Project[]>('lab:portfolio:projects', [
    { id: '1', title: 'Mini Lab', desc: '可運行小專案集合', link: '#' },
    { id: '2', title: 'Design Tokens', desc: '主題與元件庫實驗', link: '#' },
  ])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">姓名</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">簡介</label>
          <textarea className="field" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <label className="label">主題色</label>
          <input className="field" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setProjects((ps) => [...ps, { id: uid('p'), title: '新作品', desc: '描述…', link: '#' }])}
          >
            新增作品
          </button>
          {projects.map((p) => (
            <div key={p.id} className="stack" style={{ gap: 4 }}>
              <input className="field" value={p.title} onChange={(e) => setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)))} />
              <input className="field" value={p.desc} onChange={(e) => setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, desc: e.target.value } : x)))} />
              <div className="row">
                <input className="field" style={{ flex: 1 }} value={p.link} onChange={(e) => setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, link: e.target.value } : x)))} />
                <button type="button" className="btn sm danger" onClick={() => setProjects((ps) => ps.filter((x) => x.id !== p.id))}>
                  刪
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="panel stack" style={{ borderTop: `4px solid ${accent}` }}>
          <h2 style={{ margin: 0, color: accent }}>{name}</h2>
          <p className="muted">{bio}</p>
          <div className="stack">
            {projects.map((p) => (
              <div key={p.id} className="list-item">
                <strong>{p.title}</strong>
                <p className="muted" style={{ margin: '4px 0' }}>
                  {p.desc}
                </p>
                <a href={p.link} style={{ color: accent }}>
                  查看 →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
