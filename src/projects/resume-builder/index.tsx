import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, copyText, uid } from '../../lib/utils'

const meta = getProject('resume-builder')!

type Exp = { id: string; role: string; company: string; period: string; detail: string }
type Edu = { id: string; school: string; degree: string; year: string }
type Section = 'basic' | 'skills' | 'exp' | 'edu' | 'summary'

export default function Page() {
  const [name, setName] = useLocalStorage('lab:resume:name', '王小明')
  const [title, setTitle] = useLocalStorage('lab:resume:title', '前端工程師')
  const [email, setEmail] = useLocalStorage('lab:resume:email', 'hello@example.com')
  const [phone, setPhone] = useLocalStorage('lab:resume:phone', '0912-345-678')
  const [location, setLocation] = useLocalStorage('lab:resume:loc', '台北')
  const [summary, setSummary] = useLocalStorage('lab:resume:summary', '專注設計系統與效能優化的前端工程師，喜歡把複雜流程做成簡單工具。')
  const [skills, setSkills] = useLocalStorage('lab:resume:skills', 'React, TypeScript, CSS, Node.js')
  const [section, setSection] = useLocalStorage<Section>('lab:resume:section', 'basic')
  const [exps, setExps] = useLocalStorage<Exp[]>('lab:resume:exps', [
    { id: '1', role: '前端工程師', company: '星辰科技', period: '2023 — 至今', detail: '負責設計系統與電商前台效能優化，轉換率提升 18%' },
  ])
  const [edus, setEdus] = useLocalStorage<Edu[]>('lab:resume:edu', [
    { id: '1', school: '台灣大學', degree: '資訊工程學系', year: '2021' },
  ])

  function toMarkdown() {
    return [
      `# ${name}`,
      `${title} · ${location}`,
      `${email} · ${phone}`,
      '',
      `## 簡介`,
      summary,
      '',
      `## 技能`,
      skills,
      '',
      `## 經歷`,
      ...exps.map((e) => `### ${e.role} @ ${e.company}\n${e.period}\n${e.detail}`),
      '',
      `## 學歷`,
      ...edus.map((e) => `- ${e.school}｜${e.degree}（${e.year}）`),
      '',
    ].join('\n')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => copyText(toMarkdown())}>
            複製 MD
          </button>
          <button type="button" className="btn accent sm" onClick={() => downloadText('resume.md', toMarkdown(), 'text/markdown;charset=utf-8')}>
            匯出 Markdown
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['basic', '基本'],
                ['summary', '簡介'],
                ['skills', '技能'],
                ['exp', '經歷'],
                ['edu', '學歷'],
              ] as [Section, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className={`btn sm ${section === k ? 'accent' : 'ghost'}`} onClick={() => setSection(k)}>
                {label}
              </button>
            ))}
          </div>
          {section === 'basic' && (
            <>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" />
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="職稱" />
              <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="電話" />
              <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="地區" />
            </>
          )}
          {section === 'summary' && <textarea className="field" rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} />}
          {section === 'skills' && <textarea className="field" rows={4} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="逗號分隔" />}
          {section === 'exp' && (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setExps((xs) => [...xs, { id: uid('e'), role: '職稱', company: '公司', period: '2024 — 至今', detail: '成果…' }])}
              >
                新增經歷
              </button>
              {exps.map((e) => (
                <div key={e.id} className="stack" style={{ gap: 4 }}>
                  <div className="row">
                    <input className="field" value={e.role} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, role: ev.target.value } : x)))} />
                    <input className="field" value={e.company} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, company: ev.target.value } : x)))} />
                  </div>
                  <input className="field" value={e.period} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, period: ev.target.value } : x)))} />
                  <textarea className="field" rows={2} value={e.detail} onChange={(ev) => setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, detail: ev.target.value } : x)))} />
                  <button type="button" className="btn sm danger" onClick={() => setExps((xs) => xs.filter((x) => x.id !== e.id))}>
                    刪除
                  </button>
                </div>
              ))}
            </>
          )}
          {section === 'edu' && (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setEdus((xs) => [...xs, { id: uid('ed'), school: '學校', degree: '學位', year: '2020' }])}
              >
                新增學歷
              </button>
              {edus.map((e) => (
                <div key={e.id} className="row">
                  <input className="field" value={e.school} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, school: ev.target.value } : x)))} />
                  <input className="field" value={e.degree} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, degree: ev.target.value } : x)))} />
                  <input className="field" style={{ width: 80 }} value={e.year} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, year: ev.target.value } : x)))} />
                  <button type="button" className="btn sm danger" onClick={() => setEdus((xs) => xs.filter((x) => x.id !== e.id))}>
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="panel stack">
          <div className="muted">預覽</div>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <div className="muted">
            {title} · {location}
          </div>
          <div className="mono muted">
            {email} · {phone}
          </div>
          <div>
            <div className="label">簡介</div>
            <p style={{ margin: 0 }}>{summary}</p>
          </div>
          <div>
            <div className="label">技能</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {skills
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (
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
                <div className="muted mono">{e.period}</div>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {e.detail}
                </p>
              </div>
            ))}
          </div>
          <div>
            <div className="label">學歷</div>
            {edus.map((e) => (
              <div key={e.id} className="list-item">
                {e.school}｜{e.degree}（{e.year}）
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
