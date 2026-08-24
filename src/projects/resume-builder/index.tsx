import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid } from '../../lib/utils'

const meta = getProject('resume-builder')!

type Exp = { id: string; role: string; company: string; detail: string }

export default function Page() {
  const [name, setName] = useLocalStorage('lab:resume:name', '王小明')
  const [title, setTitle] = useLocalStorage('lab:resume:title', '前端工程師')
  const [email, setEmail] = useLocalStorage('lab:resume:email', 'hello@example.com')
  const [skills, setSkills] = useLocalStorage('lab:resume:skills', 'React, TypeScript, CSS, Node.js')
  const [exps, setExps] = useLocalStorage<Exp[]>('lab:resume:exps', [
    { id: '1', role: '前端工程師', company: '星辰科技', detail: '負責設計系統與電商前台效能優化' },
  ])

  function exportMd() {
    const md = `# ${name}\n${title} · ${email}\n\n## 技能\n${skills}\n\n## 經歷\n${exps.map((e) => `### ${e.role} @ ${e.company}\n${e.detail}`).join('\n\n')}\n`
    downloadText('resume.md', md)
  }

  return (
    <ProjectShell meta={meta} actions={<button type="button" className="btn accent sm" onClick={exportMd}>匯出 Markdown</button>}>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" />
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="職稱" />
          <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <textarea className="field" rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="技能" />
          <button type="button" className="btn ghost" onClick={() => setExps((xs) => [...xs, { id: uid('e'), role: '職稱', company: '公司', detail: '成果…' }])}>
            新增經歷
          </button>
          {exps.map((e) => (
            <div key={e.id} className="stack" style={{ gap: 4 }}>
              <div className="row">
                <input className="field" value={e.role} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, role: ev.target.value } : x)))} />
                <input className="field" value={e.company} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, company: ev.target.value } : x)))} />
              </div>
              <textarea className="field" rows={2} value={e.detail} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, detail: ev.target.value } : x)))} />
            </div>
          ))}
        </div>
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>{name}</h2>
          <div className="muted">
            {title} · {email}
          </div>
          <div>
            <div className="label">技能</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {skills.split(/[,，]/).map((s) => s.trim()).filter(Boolean).map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="label">經歷</div>
            {exps.map((e) => (
              <div key={e.id} className="list-item">
                <strong>
                  {e.role} · {e.company}
                </strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {e.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
