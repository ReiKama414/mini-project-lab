import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('link-in-bio')!

type Link = { id: string; label: string; url: string }

const THEMES = [
  { id: 'ink', bg: '#111827', fg: '#ffffff', btn: '#ffffff' },
  { id: 'ocean', bg: '#0c4a6e', fg: '#e0f2fe', btn: '#7dd3fc' },
  { id: 'forest', bg: '#14532d', fg: '#dcfce7', btn: '#86efac' },
  { id: 'sunset', bg: '#7c2d12', fg: '#ffedd5', btn: '#fdba74' },
]

export default function Page() {
  const [name, setName] = useLocalStorage('lab:link-in-bio:name', '@kamay')
  const [bio, setBio] = useLocalStorage('lab:link-in-bio:bio', '打造小工具 · 分享學習筆記')
  const [themeId, setThemeId] = useLocalStorage('lab:link-in-bio:themeId', 'ink')
  const [customBg, setCustomBg] = useLocalStorage('lab:link-in-bio:theme', '#111827')
  const [links, setLinks] = useLocalStorage<Link[]>('lab:link-in-bio:links', [
    { id: '1', label: '個人網站', url: 'https://example.com' },
    { id: '2', label: 'GitHub', url: 'https://github.com' },
    { id: '3', label: '作品集', url: 'https://example.com/work' },
  ])

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0]!
  const bg = themeId === 'custom' ? customBg : theme.bg
  const fg = themeId === 'custom' ? '#ffffff' : theme.fg
  const btnBg = themeId === 'custom' ? '#ffffff' : theme.btn
  const btnFg = themeId === 'custom' ? customBg : theme.bg

  function move(index: number, dir: -1 | 1) {
    const next = [...links]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j]!, next[index]!]
    setLinks(next)
  }

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
          <label className="label">主題色</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn sm ${themeId === t.id ? 'accent' : 'ghost'}`}
                onClick={() => setThemeId(t.id)}
                style={{ borderLeft: `6px solid ${t.bg}` }}
              >
                {t.id}
              </button>
            ))}
            <button type="button" className={`btn sm ${themeId === 'custom' ? 'accent' : 'ghost'}`} onClick={() => setThemeId('custom')}>
              自訂
            </button>
          </div>
          {themeId === 'custom' && <input className="field" type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} />}
          <button type="button" className="btn ghost" onClick={() => setLinks((xs) => [...xs, { id: uid('l'), label: '新連結', url: 'https://' }])}>
            新增連結
          </button>
          {links.map((l, i) => (
            <div key={l.id} className="row">
              <div className="row">
                <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="btn sm ghost" disabled={i === links.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
              <input className="field" value={l.label} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
              <input className="field" style={{ flex: 1 }} value={l.url} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="btn sm danger" onClick={() => setLinks((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="panel stack" style={{ background: bg, color: fg, alignItems: 'center', textAlign: 'center', padding: 32 }}>
          <div className="muted" style={{ color: fg, opacity: 0.7 }}>
            即時預覽
          </div>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff3', display: 'grid', placeItems: 'center', fontSize: 28 }}>
            {name.slice(0, 1)}
          </div>
          <h2 style={{ margin: '12px 0 4px' }}>{name}</h2>
          <p style={{ color: fg, opacity: 0.85 }}>{bio}</p>
          <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
            {links.map((l) => (
              <a
                key={l.id}
                href={l.url}
                className="btn"
                style={{ background: btnBg, color: btnFg, textDecoration: 'none' }}
                target="_blank"
                rel="noreferrer"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
