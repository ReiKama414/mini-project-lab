import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('link-in-bio')!

type Link = { id: string; label: string; url: string }

export default function Page() {
  const [name, setName] = useLocalStorage('lab:link-in-bio:name', '@kamay')
  const [bio, setBio] = useLocalStorage('lab:link-in-bio:bio', '打造小工具 · 分享學習筆記')
  const [theme, setTheme] = useLocalStorage('lab:link-in-bio:theme', '#111827')
  const [links, setLinks] = useLocalStorage<Link[]>('lab:link-in-bio:links', [
    { id: '1', label: '個人網站', url: 'https://example.com' },
    { id: '2', label: 'GitHub', url: 'https://github.com' },
    { id: '3', label: '作品集', url: 'https://example.com/work' },
  ])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" onClick={() => copyText(links.map((l) => `${l.label}: ${l.url}`).join('\n'))}>
          複製連結
        </button>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="field" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
          <label className="label">背景色</label>
          <input className="field" type="color" value={theme} onChange={(e) => setTheme(e.target.value)} />
          <button type="button" className="btn ghost" onClick={() => setLinks((xs) => [...xs, { id: uid('l'), label: '新連結', url: 'https://' }])}>
            新增連結
          </button>
          {links.map((l) => (
            <div key={l.id} className="row">
              <input className="field" value={l.label} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
              <input className="field" style={{ flex: 1 }} value={l.url} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="btn sm danger" onClick={() => setLinks((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="panel stack" style={{ background: theme, color: '#fff', alignItems: 'center', textAlign: 'center', padding: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff3', display: 'grid', placeItems: 'center', fontSize: 28 }}>{name.slice(0, 1)}</div>
          <h2 style={{ margin: '12px 0 4px' }}>{name}</h2>
          <p className="muted" style={{ color: '#ffffffcc' }}>
            {bio}
          </p>
          <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
            {links.map((l) => (
              <a key={l.id} href={l.url} className="btn" style={{ background: '#fff', color: theme, textDecoration: 'none' }} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
