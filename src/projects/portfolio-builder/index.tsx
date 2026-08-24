import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, limitText, charCount, isNonEmpty, isValidEmail, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('portfolio-builder')!

const NAME_MAX = 80
const TITLE_MAX = 120
const BIO_MAX = 200
const ABOUT_MAX = 2000
const EMAIL_MAX = 254
const PROJ_TITLE_MAX = 120
const PROJ_DESC_MAX = 500
const PROJ_TAGS_MAX = 120
const URL_MAX = 2048

type Project = { id: string; title: string; desc: string; link: string; tags: string }
type Section = 'hero' | 'about' | 'projects' | 'contact'

export default function Page() {
  const [name, setName] = useLocalStorage('lab:portfolio:name', 'Kamay')
  const [title, setTitle] = useLocalStorage('lab:portfolio:title', 'Frontend Engineer')
  const [bio, setBio] = useLocalStorage('lab:portfolio:bio', '前端工程師 · 喜歡打造小而美的工具')
  const [about, setAbout] = useLocalStorage(
    'lab:portfolio:about',
    '專注 React／TypeScript 與設計系統。偏好本機優先、可落地的產品原型。',
  )
  const [email, setEmail] = useLocalStorage('lab:portfolio:email', 'hello@example.com')
  const [accent, setAccent] = useLocalStorage('lab:portfolio:accent', '#0d9488')
  const [section, setSection] = useLocalStorage<Section>('lab:portfolio:section', 'hero')
  const [projects, setProjects] = useLocalStorage<Project[]>('lab:portfolio:projects', [
    { id: '1', title: 'Mini Lab', desc: '可運行小專案集合', link: '#', tags: 'React, Vite' },
    { id: '2', title: 'Design Tokens', desc: '主題與元件庫實驗', link: '#', tags: 'CSS, Tokens' },
  ])

  function toMarkdown() {
    return [
      `# ${name}`,
      '',
      `**${title}**`,
      '',
      bio,
      '',
      '## 關於',
      '',
      about,
      '',
      '## 作品',
      '',
      ...projects.map(
        (p) =>
          `### ${p.title}\n\n${p.desc}\n\n- 連結：${p.link}\n- 標籤：${p.tags}`,
      ),
      '',
      '## 聯絡',
      '',
      `- Email: ${email}`,
      '',
    ].join('\n')
  }

  function exportHtml() {
    const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"/><title>${name}</title>
<body style="font-family:system-ui;margin:0;background:#0b1220;color:#e5e7eb">
<header style="padding:48px 24px;border-top:6px solid ${accent}">
<h1 style="color:${accent};margin:0">${name}</h1>
<p>${title}</p><p>${bio}</p></header>
<section style="padding:24px"><h2>關於</h2><p>${about}</p></section>
<section style="padding:24px"><h2>作品</h2>
${projects.map((p) => `<article style="margin-bottom:16px"><h3>${p.title}</h3><p>${p.desc}</p><a href="${p.link}" style="color:${accent}">查看</a></article>`).join('')}
</section>
<section style="padding:24px"><h2>聯絡</h2><a href="mailto:${email}" style="color:${accent}">${email}</a></section>
</body></html>`
    downloadText('portfolio.html', html, 'text/html;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => void copyText(toMarkdown())}>
            複製 MD
          </button>
          <button type="button" className="btn ghost sm" onClick={() => downloadText('portfolio.md', toMarkdown(), 'text/markdown;charset=utf-8')}>
            匯出 Markdown
          </button>
          <button type="button" className="btn accent sm" onClick={exportHtml}>
            匯出 HTML
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['hero', '主視覺'],
                ['about', '關於'],
                ['projects', '作品'],
                ['contact', '聯絡'],
              ] as [Section, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" className={`btn sm ${section === k ? 'accent' : 'ghost'}`} onClick={() => setSection(k)}>
                {label}
              </button>
            ))}
          </div>
          {section === 'hero' && (
            <>
              <label className="label">姓名</label>
              <input
                className={cn('field', !isNonEmpty(name) && 'is-invalid')}
                maxLength={NAME_MAX}
                value={name}
                onChange={(e) => setName(limitText(e.target.value, NAME_MAX))}
              />
              <div className="field-meta">
                <span className={!isNonEmpty(name) ? 'warn' : undefined}>{isNonEmpty(name) ? 'OK' : '請填姓名'}</span>
                <span>{charCount(name)}/{NAME_MAX}</span>
              </div>
              <label className="label">職稱</label>
              <input
                className="field"
                maxLength={TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))}
              />
              <div className="field-meta">
                <span className="field-hint">顯示於預覽副標</span>
                <span>{charCount(title)}/{TITLE_MAX}</span>
              </div>
              <label className="label">一句話</label>
              <textarea
                className="field"
                rows={2}
                maxLength={BIO_MAX}
                value={bio}
                onChange={(e) => setBio(limitText(e.target.value, BIO_MAX))}
              />
              <div className="field-meta">
                <span className="field-hint">Hero 短句</span>
                <span>{charCount(bio)}/{BIO_MAX}</span>
              </div>
              <label className="label">主題色</label>
              <input className="field" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </>
          )}
          {section === 'about' && (
            <>
              <label className="label">關於我</label>
              <textarea
                className="field"
                rows={8}
                maxLength={ABOUT_MAX}
                value={about}
                onChange={(e) => setAbout(limitText(e.target.value, ABOUT_MAX))}
              />
              <div className="field-meta">
                <span className="field-hint">較長自我介紹</span>
                <span>{charCount(about)}/{ABOUT_MAX}</span>
              </div>
            </>
          )}
          {section === 'projects' && (
            <>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setProjects((ps) => [...ps, { id: uid('p'), title: '新作品', desc: '描述…', link: '#', tags: '' }])}
              >
                新增作品
              </button>
              {projects.map((p) => {
                const linkOk = !isNonEmpty(p.link) || p.link === '#' || isValidHttpUrl(normalizeHttpUrl(p.link))
                return (
                  <div key={p.id} className="stack" style={{ gap: 4 }}>
                    <input
                      className="field"
                      maxLength={PROJ_TITLE_MAX}
                      value={p.title}
                      onChange={(e) =>
                        setProjects((ps) =>
                          ps.map((x) => (x.id === p.id ? { ...x, title: limitText(e.target.value, PROJ_TITLE_MAX) } : x)),
                        )
                      }
                    />
                    <input
                      className="field"
                      maxLength={PROJ_DESC_MAX}
                      value={p.desc}
                      onChange={(e) =>
                        setProjects((ps) =>
                          ps.map((x) => (x.id === p.id ? { ...x, desc: limitText(e.target.value, PROJ_DESC_MAX) } : x)),
                        )
                      }
                    />
                    <input
                      className="field"
                      maxLength={PROJ_TAGS_MAX}
                      value={p.tags}
                      placeholder="標籤"
                      onChange={(e) =>
                        setProjects((ps) =>
                          ps.map((x) => (x.id === p.id ? { ...x, tags: limitText(e.target.value, PROJ_TAGS_MAX) } : x)),
                        )
                      }
                    />
                    <div className="row">
                      <input
                        className={cn('field', !linkOk && 'is-invalid')}
                        style={{ flex: 1 }}
                        maxLength={URL_MAX}
                        value={p.link}
                        onChange={(e) =>
                          setProjects((ps) =>
                            ps.map((x) => (x.id === p.id ? { ...x, link: limitText(e.target.value, URL_MAX) } : x)),
                          )
                        }
                        onBlur={() => {
                          if (p.link && p.link !== '#') {
                            const n = normalizeHttpUrl(p.link)
                            if (isValidHttpUrl(n)) {
                              setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, link: n } : x)))
                            }
                          }
                        }}
                      />
                      <button type="button" className="btn sm danger" onClick={() => setProjects((ps) => ps.filter((x) => x.id !== p.id))}>
                        刪
                      </button>
                    </div>
                    <div className="field-meta">
                      <span className={!linkOk ? 'warn' : undefined}>{linkOk ? '連結 OK 或留空／#' : '請使用 http(s) URL'}</span>
                      <span>{charCount(p.link)}/{URL_MAX}</span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          {section === 'contact' && (
            <>
              <label className="label">Email</label>
              <input
                className={cn('field', isNonEmpty(email) && !isValidEmail(email) && 'is-invalid')}
                maxLength={EMAIL_MAX}
                value={email}
                onChange={(e) => setEmail(limitText(e.target.value, EMAIL_MAX))}
              />
              <div className="field-meta">
                <span className={isNonEmpty(email) && !isValidEmail(email) ? 'warn' : undefined}>
                  {isNonEmpty(email) && !isValidEmail(email) ? '格式不正確' : '聯絡信箱'}
                </span>
                <span>{charCount(email)}/{EMAIL_MAX}</span>
              </div>
              {isNonEmpty(email) && !isValidEmail(email) && <p className="field-error">請輸入有效 Email</p>}
            </>
          )}
        </div>
        <div className="panel stack" style={{ borderTop: `4px solid ${accent}` }}>
          <div className="muted">即時預覽</div>
          <h2 style={{ margin: 0, color: accent }}>{name}</h2>
          <div className="tag">{title}</div>
          <p className="muted">{bio}</p>
          <div>
            <div className="label">關於</div>
            <p style={{ margin: 0 }}>{about}</p>
          </div>
          <div className="stack">
            {projects.map((p) => (
              <div key={p.id} className="list-item">
                <strong>{p.title}</strong>
                <p className="muted" style={{ margin: '4px 0' }}>
                  {p.desc}
                </p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {p.tags
                    .split(/[,，]/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                </div>
                <a href={p.link} style={{ color: accent }}>
                  查看 →
                </a>
              </div>
            ))}
          </div>
          <div>
            <div className="label">聯絡</div>
            <a href={`mailto:${email}`} style={{ color: accent }}>
              {email}
            </a>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
