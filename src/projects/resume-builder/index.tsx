import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, copyText, uid, limitText, charCount, isNonEmpty, isValidEmail, cn } from '../../lib/utils'

const meta = getProject('resume-builder')!

const NAME_MAX = 80
const TITLE_MAX = 120
const EMAIL_MAX = 254
const PHONE_MAX = 40
const LOC_MAX = 80
const SUMMARY_MAX = 2000
const SKILLS_MAX = 500
const FIELD_MAX = 120
const DETAIL_MAX = 2000

type Exp = { id: string; role: string; company: string; period: string; detail: string }
type Edu = { id: string; school: string; degree: string; year: string }
type Section = 'basic' | 'skills' | 'exp' | 'edu' | 'summary' | 'preview'
type Snapshot = {
  id: string
  label: string
  at: number
  name: string
  title: string
  email: string
  phone: string
  location: string
  summary: string
  skills: string
  exps: Exp[]
  edus: Edu[]
}

const PRESETS: { label: string; data: Omit<Snapshot, 'id' | 'label' | 'at'> }[] = [
  {
    label: '前端工程師',
    data: {
      name: '王小明',
      title: '前端工程師',
      email: 'hello@example.com',
      phone: '0912-345-678',
      location: '台北',
      summary: '專注設計系統與效能優化的前端工程師，喜歡把複雜流程做成簡單工具。',
      skills: 'React, TypeScript, CSS, Node.js',
      exps: [
        {
          id: '1',
          role: '前端工程師',
          company: '星辰科技',
          period: '2023 — 至今',
          detail: '負責設計系統與電商前台效能優化，轉換率提升 18%',
        },
      ],
      edus: [{ id: '1', school: '台灣大學', degree: '資訊工程學系', year: '2021' }],
    },
  },
  {
    label: '產品設計師',
    data: {
      name: '林小華',
      title: '產品設計師',
      email: 'design@example.com',
      phone: '0922-111-222',
      location: '新竹',
      summary: '以研究驅動介面決策，擅長把訪談洞察轉成可驗證原型。',
      skills: 'Figma, User Research, Prototyping, Design System',
      exps: [
        {
          id: '1',
          role: '產品設計師',
          company: '雲端工作室',
          period: '2022 — 至今',
          detail: '主導 B2B 儀表板改版，任務完成率提升 25%',
        },
      ],
      edus: [{ id: '1', school: '實踐大學', degree: '工業產品設計', year: '2020' }],
    },
  },
  {
    label: '空白履歷',
    data: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      skills: '',
      exps: [],
      edus: [],
    },
  },
]

const STEPS: { id: Section; label: string }[] = [
  { id: 'basic', label: '1. 基本' },
  { id: 'summary', label: '2. 簡介' },
  { id: 'skills', label: '3. 技能' },
  { id: 'exp', label: '4. 經歷' },
  { id: 'edu', label: '5. 學歷' },
  { id: 'preview', label: '6. 預覽' },
]

export default function Page() {
  const [name, setName] = useLocalStorage('lab:resume:name', '王小明')
  const [title, setTitle] = useLocalStorage('lab:resume:title', '前端工程師')
  const [email, setEmail] = useLocalStorage('lab:resume:email', 'hello@example.com')
  const [phone, setPhone] = useLocalStorage('lab:resume:phone', '0912-345-678')
  const [location, setLocation] = useLocalStorage('lab:resume:loc', '台北')
  const [summary, setSummary] = useLocalStorage(
    'lab:resume:summary',
    '專注設計系統與效能優化的前端工程師，喜歡把複雜流程做成簡單工具。',
  )
  const [skills, setSkills] = useLocalStorage('lab:resume:skills', 'React, TypeScript, CSS, Node.js')
  const [section, setSection] = useLocalStorage<Section>('lab:resume:section', 'basic')
  const [exps, setExps] = useLocalStorage<Exp[]>('lab:resume:exps', PRESETS[0]!.data.exps)
  const [edus, setEdus] = useLocalStorage<Edu[]>('lab:resume:edu', PRESETS[0]!.data.edus)
  const [history, setHistory] = useLocalStorage<Snapshot[]>('lab:resume:history', [])
  const [favId, setFavId] = useLocalStorage('lab:resume:fav', '')

  function toMarkdown() {
    return [
      `# ${name || '（姓名）'}`,
      `${title || '（職稱）'} · ${location || '（地區）'}`,
      `${email || '（Email）'} · ${phone || '（電話）'}`,
      '',
      `## 簡介`,
      summary || '（尚無簡介）',
      '',
      `## 技能`,
      skills
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `- ${s}`)
        .join('\n') || '- （尚無技能）',
      '',
      `## 經歷`,
      ...(exps.length
        ? exps.map((e) => `### ${e.role} @ ${e.company}\n${e.period}\n\n${e.detail}`)
        : ['（尚無經歷）']),
      '',
      `## 學歷`,
      ...(edus.length ? edus.map((e) => `- ${e.school}｜${e.degree}（${e.year}）`) : ['- （尚無學歷）']),
      '',
    ].join('\n')
  }

  function applyData(d: Omit<Snapshot, 'id' | 'label' | 'at'>) {
    setName(d.name)
    setTitle(d.title)
    setEmail(d.email)
    setPhone(d.phone)
    setLocation(d.location)
    setSummary(d.summary)
    setSkills(d.skills)
    setExps(d.exps.map((e) => ({ ...e, id: uid('e') })))
    setEdus(d.edus.map((e) => ({ ...e, id: uid('ed') })))
  }

  function saveSnapshot(label?: string) {
    const snap: Snapshot = {
      id: uid('snap'),
      label: label || `${name || '未命名'} · ${title || '履歷'}`,
      at: Date.now(),
      name,
      title,
      email,
      phone,
      location,
      summary,
      skills,
      exps,
      edus,
    }
    setHistory((h) => [snap, ...h].slice(0, 12))
    return snap
  }

  const skillList = skills
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const stepIndex = STEPS.findIndex((s) => s.id === section)
  const completeness = [
    !!name.trim(),
    !!title.trim(),
    !!email.trim(),
    !!summary.trim(),
    skillList.length > 0,
    exps.length > 0,
    edus.length > 0,
  ].filter(Boolean).length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => void copyText(toMarkdown())}>
            複製 MD
          </button>
          <button type="button" className="btn accent sm" onClick={() => downloadText('resume.md', toMarkdown(), 'text/markdown;charset=utf-8')}>
            匯出 Markdown
          </button>
          <button type="button" className="btn ghost sm" onClick={() => saveSnapshot()}>
            存快照
          </button>
        </div>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {STEPS.map((s) => (
            <button key={s.id} type="button" className={`btn sm ${section === s.id ? 'accent' : 'ghost'}`} onClick={() => setSection(s.id)}>
              {s.label}
            </button>
          ))}
          <span className="metric">完整度 {completeness}/7</span>
          <span className="mono muted">{toMarkdown().length} 字</span>
        </div>
        <div className="progress">
          <div style={{ width: `${(completeness / 7) * 100}%`, height: 8, borderRadius: 4, background: '#0d9488' }} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">預設範本</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyData(p.data)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          {section === 'basic' && (
            <>
              <div className="row">
                <label className="label">姓名</label>
                <span className="mono muted">{charCount(name)}/{NAME_MAX}</span>
              </div>
              <input
                className={cn('field', !isNonEmpty(name) && 'is-invalid')}
                maxLength={NAME_MAX}
                value={name}
                onChange={(e) => setName(limitText(e.target.value, NAME_MAX))}
                placeholder="姓名"
              />
              <div className="row">
                <label className="label">職稱</label>
                <span className="mono muted">{charCount(title)}/{TITLE_MAX}</span>
              </div>
              <input
                className="field"
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))}
                placeholder="職稱"
              />
              <label className="label">Email</label>
              <input
                className={cn('field', isNonEmpty(email) && !isValidEmail(email) && 'is-invalid')}
                maxLength={EMAIL_MAX}
                value={email}
                onChange={(e) => setEmail(limitText(e.target.value, EMAIL_MAX))}
                placeholder="Email"
              />
              <div className="field-meta">
                <span className={isNonEmpty(email) && !isValidEmail(email) ? 'warn' : undefined}>
                  {isNonEmpty(email) && !isValidEmail(email) ? 'Email 格式不正確' : '聯絡用'}
                </span>
                <span>{charCount(email)}/{EMAIL_MAX}</span>
              </div>
              {isNonEmpty(email) && !isValidEmail(email) && <p className="field-error">請輸入有效 Email</p>}
              <input
                className="field"
                maxLength={PHONE_MAX}
                value={phone}
                onChange={(e) => setPhone(limitText(e.target.value, PHONE_MAX))}
                placeholder="電話"
              />
              <div className="field-meta">
                <span className="field-hint">電話</span>
                <span>{charCount(phone)}/{PHONE_MAX}</span>
              </div>
              <input
                className="field"
                maxLength={LOC_MAX}
                value={location}
                onChange={(e) => setLocation(limitText(e.target.value, LOC_MAX))}
                placeholder="地區"
              />
              <div className="field-meta">
                <span className="field-hint">地區</span>
                <span>{charCount(location)}/{LOC_MAX}</span>
              </div>
            </>
          )}
          {section === 'summary' && (
            <>
              <div className="row">
                <label className="label">簡介</label>
                <span className="mono muted">{charCount(summary)}/{SUMMARY_MAX}</span>
              </div>
              <textarea
                className={cn('field', !isNonEmpty(summary) && 'is-invalid')}
                rows={6}
                maxLength={SUMMARY_MAX}
                value={summary}
                onChange={(e) => setSummary(limitText(e.target.value, SUMMARY_MAX))}
              />
              {!isNonEmpty(summary) ? (
                <p className="field-error">建議填寫簡介（1–3 句話定位角色與強項）</p>
              ) : (
                <p className="field-hint">用 1–3 句話定位你的角色與強項。</p>
              )}
            </>
          )}
          {section === 'skills' && (
            <>
              <div className="row">
                <label className="label">技能（逗號分隔）</label>
                <span className="mono muted">{skillList.length} 項 · {charCount(skills)}/{SKILLS_MAX}</span>
              </div>
              <textarea
                className="field"
                rows={4}
                maxLength={SKILLS_MAX}
                value={skills}
                onChange={(e) => setSkills(limitText(e.target.value, SKILLS_MAX))}
                placeholder="React, TypeScript…"
              />
              {skillList.length === 0 ? (
                <p className="field-hint">尚未加入技能標籤。</p>
              ) : (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {skillList.map((s) => (
                    <span key={s} className="tag">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          {section === 'exp' && (
            <>
              <AddButton
                type="button"
                className="ghost"
                onClick={() => setExps((xs) => [...xs, { id: uid('e'), role: '職稱', company: '公司', period: '2024 — 至今', detail: '成果…' }])}
              >
                新增經歷
              </AddButton>
              {exps.length === 0 ? (
                <div className="list-item">
                  <p className="muted" style={{ margin: 0 }}>
                    尚無經歷。建議每段用量化成果描述。
                  </p>
                </div>
              ) : (
                exps.map((e) => (
                  <div key={e.id} className="stack" style={{ gap: 4 }}>
                    <div className="row">
                      <input
                        className="field"
                        maxLength={FIELD_MAX}
                        value={e.role}
                        onChange={(ev) =>
                          setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, role: limitText(ev.target.value, FIELD_MAX) } : x)))
                        }
                      />
                      <input
                        className="field"
                        maxLength={FIELD_MAX}
                        value={e.company}
                        onChange={(ev) =>
                          setExps((xs) =>
                            xs.map((x) => (x.id === e.id ? { ...x, company: limitText(ev.target.value, FIELD_MAX) } : x)),
                          )
                        }
                      />
                    </div>
                    <input
                      className="field"
                      maxLength={FIELD_MAX}
                      value={e.period}
                      onChange={(ev) =>
                        setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, period: limitText(ev.target.value, FIELD_MAX) } : x)))
                      }
                    />
                    <div className="field-meta">
                      <span className="field-hint">成果描述</span>
                      <span>{charCount(e.detail)}/{DETAIL_MAX}</span>
                    </div>
                    <textarea
                      className="field"
                      rows={2}
                      maxLength={DETAIL_MAX}
                      value={e.detail}
                      onChange={(ev) =>
                        setExps((xs) => xs.map((x) => (x.id === e.id ? { ...x, detail: limitText(ev.target.value, DETAIL_MAX) } : x)))
                      }
                    />
                    <DeleteButton onClick={() => setExps((xs) => xs.filter((x) => x.id !== e.id))} label="刪除" />
                  </div>
                ))
              )}
            </>
          )}
          {section === 'edu' && (
            <>
              <AddButton
                type="button"
                className="ghost"
                onClick={() => setEdus((xs) => [...xs, { id: uid('ed'), school: '學校', degree: '學位', year: '2020' }])}
              >
                新增學歷
              </AddButton>
              {edus.length === 0 ? (
                <div className="list-item">
                  <p className="muted" style={{ margin: 0 }}>
                    尚無學歷資料。
                  </p>
                </div>
              ) : (
                edus.map((e) => (
                  <div key={e.id} className="row">
                    <input className="field" value={e.school} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, school: limitText(ev.target.value, FIELD_MAX) } : x)))} />
                    <input className="field" value={e.degree} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, degree: limitText(ev.target.value, FIELD_MAX) } : x)))} />
                    <input className="field" style={{ width: 80 }} value={e.year} onChange={(ev) => setEdus((xs) => xs.map((x) => (x.id === e.id ? { ...x, year: limitText(ev.target.value, 20) } : x)))} />
                    <DeleteButton onClick={() => setEdus((xs) => xs.filter((x) => x.id !== e.id))} label="刪除" />
                  </div>
                ))
              )}
            </>
          )}
          {section === 'preview' && (
            <div className="stack">
              <p className="muted">右側為即時預覽。可複製 Markdown 或存快照版本。</p>
              <button type="button" className="btn accent" onClick={() => downloadText('resume.md', toMarkdown(), 'text/markdown;charset=utf-8')}>
                下載履歷.md
              </button>
            </div>
          )}
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              disabled={stepIndex <= 0}
              onClick={() => setSection(STEPS[stepIndex - 1]!.id)}
            >
              ← 上一步
            </button>
            <button
              type="button"
              className="btn accent"
              disabled={stepIndex >= STEPS.length - 1}
              onClick={() => setSection(STEPS[stepIndex + 1]!.id)}
            >
              下一步 →
            </button>
          </div>
        </div>

        <div className="panel stack">
          <div className="muted">預覽</div>
          {!name.trim() && !title.trim() && !summary.trim() && exps.length === 0 ? (
            <div className="list-item stack">
              <strong>履歷還是空的</strong>
              <p className="muted" style={{ margin: 0 }}>
                選預設範本，或從「基本」步驟開始填寫。
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ margin: 0 }}>{name || '（姓名）'}</h2>
              <div className="muted">
                {title || '（職稱）'} · {location || '（地區）'}
              </div>
              <div className="mono muted">
                {email || '（Email）'} · {phone || '（電話）'}
              </div>
              <div>
                <div className="label">簡介</div>
                <p style={{ margin: 0 }}>{summary || '（尚無簡介）'}</p>
              </div>
              <div>
                <div className="label">技能</div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {skillList.length === 0 ? (
                    <span className="muted">（尚無）</span>
                  ) : (
                    skillList.map((s) => (
                      <span key={s} className="tag">
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="label">經歷</div>
                {exps.length === 0 ? (
                  <p className="muted">（尚無）</p>
                ) : (
                  exps.map((e) => (
                    <div key={e.id} className="list-item">
                      <strong>
                        {e.role} · {e.company}
                      </strong>
                      <div className="muted mono">{e.period}</div>
                      <p className="muted" style={{ margin: '4px 0 0' }}>
                        {e.detail}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div>
                <div className="label">學歷</div>
                {edus.length === 0 ? (
                  <p className="muted">（尚無）</p>
                ) : (
                  edus.map((e) => (
                    <div key={e.id} className="list-item">
                      {e.school}｜{e.degree}（{e.year}）
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel stack" style={{ marginTop: 12 }}>
        <div className="row">
          <div className="label">版本快照／收藏</div>
          <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => { setHistory([]); setFavId('') }}>
            清空
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted">按「存快照」可保留目前履歷版本，方便還原或標記收藏。</p>
        ) : (
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="list-item row" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <strong>
                    {favId === h.id ? '★ ' : ''}
                    {h.label}
                  </strong>
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {new Date(h.at).toLocaleString('zh-TW')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    applyData(h)
                    setSection('preview')
                  }}
                >
                  還原
                </button>
                <button type="button" className={`btn sm ${favId === h.id ? 'accent' : 'ghost'}`} onClick={() => setFavId(favId === h.id ? '' : h.id)}>
                  {favId === h.id ? '已收藏' : '收藏'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProjectShell>
  )
}
