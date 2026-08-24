import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, charCount, isValidHttpUrl, limitText } from '../../lib/utils'

const meta = getProject('link-in-bio')!

type Link = { id: string; label: string; url: string }
type Social = { id: string; label: string; icon: string; url: string }

const THEMES = [
  { id: 'ink', bg: '#111827', fg: '#ffffff', btn: '#ffffff' },
  { id: 'ocean', bg: '#0c4a6e', fg: '#e0f2fe', btn: '#7dd3fc' },
  { id: 'forest', bg: '#14532d', fg: '#dcfce7', btn: '#86efac' },
  { id: 'sunset', bg: '#7c2d12', fg: '#ffedd5', btn: '#fdba74' },
]

const EMOJI_PRESETS = ['🧑‍💻', '🚀', '🎨', '📚', '☕', '🌿', '🐱', '✨']

const MAX_LINKS = 30
const MAX_SOCIALS = 12
const MAX_NAME = 40
const MAX_BIO = 200
const MAX_LABEL = 40
const MAX_URL = 2048
const MAX_EMOJI = 8

export default function Page() {
  const [name, setName] = useLocalStorage('lab:link-in-bio:name', '@kamay')
  const [bio, setBio] = useLocalStorage('lab:link-in-bio:bio', '打造小工具 · 分享學習筆記')
  const [themeId, setThemeId] = useLocalStorage('lab:link-in-bio:themeId', 'ink')
  const [customBg, setCustomBg] = useLocalStorage('lab:link-in-bio:theme', '#111827')
  const [avatarMode, setAvatarMode] = useLocalStorage<'emoji' | 'color' | 'upload'>('lab:link-in-bio:avatarMode', 'emoji')
  const [avatarEmoji, setAvatarEmoji] = useLocalStorage('lab:link-in-bio:emoji', '🧑‍💻')
  const [avatarColor, setAvatarColor] = useLocalStorage('lab:link-in-bio:avatarColor', '#38bdf8')
  const [avatarUpload, setAvatarUpload] = useLocalStorage('lab:link-in-bio:upload', '')
  const [links, setLinks] = useLocalStorage<Link[]>('lab:link-in-bio:links', [
    { id: '1', label: '個人網站', url: 'https://example.com' },
    { id: '2', label: 'GitHub', url: 'https://github.com' },
    { id: '3', label: '作品集', url: 'https://example.com/work' },
  ])
  const [socials, setSocials] = useLocalStorage<Social[]>('lab:link-in-bio:socials', [
    { id: 's1', label: 'GitHub', icon: 'GH', url: 'https://github.com' },
    { id: 's2', label: 'Twitter', icon: 'X', url: 'https://x.com' },
    { id: 's3', label: 'Email', icon: '✉', url: 'mailto:hello@example.com' },
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

  function sharePageText() {
    const lines = [
      name,
      bio,
      '',
      '—— 連結 ——',
      ...links.map((l) => `${l.label}: ${l.url}`),
      '',
      '—— 社群 ——',
      ...socials.map((s) => `${s.icon} ${s.label}: ${s.url}`),
    ]
    return lines.join('\n')
  }

  function onUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarUpload(String(reader.result || ''))
      setAvatarMode('upload')
    }
    reader.readAsDataURL(file)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={() => void copyText(sharePageText())}>
            複製分享文字
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => downloadText('link-in-bio.txt', sharePageText())}
          >
            匯出頁面文字
          </button>
        </div>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" value={name} maxLength={MAX_NAME} onChange={(e) => setName(limitText(e.target.value, MAX_NAME))} />
            <div className="field-meta">
              <span />
              <span>
                {charCount(name)} / {MAX_NAME}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={2} value={bio} maxLength={MAX_BIO} onChange={(e) => setBio(limitText(e.target.value, MAX_BIO))} />
            <div className="field-meta">
              <span />
              <span>
                {charCount(bio)} / {MAX_BIO}
              </span>
            </div>
          </div>
          <span className="label">頭像</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['emoji', 'color', 'upload'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn sm ${avatarMode === m ? 'accent' : 'ghost'}`}
                onClick={() => setAvatarMode(m)}
              >
                {m === 'emoji' ? 'Emoji' : m === 'color' ? '純色' : '上傳'}
              </button>
            ))}
          </div>
          {avatarMode === 'emoji' && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`btn sm ${avatarEmoji === e ? 'accent' : 'ghost'}`}
                  onClick={() => setAvatarEmoji(e)}
                >
                  {e}
                </button>
              ))}
              <input className="field" style={{ width: 80 }} value={avatarEmoji} maxLength={MAX_EMOJI} onChange={(e) => setAvatarEmoji(limitText(e.target.value, MAX_EMOJI))} />
            </div>
          )}
          {avatarMode === 'color' && (
            <input className="field" type="color" value={avatarColor} onChange={(e) => setAvatarColor(e.target.value)} />
          )}
          {avatarMode === 'upload' && (
            <input className="field" type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
          )}

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
            <button
              type="button"
              className={`btn sm ${themeId === 'custom' ? 'accent' : 'ghost'}`}
              onClick={() => setThemeId('custom')}
            >
              自訂
            </button>
          </div>
          {themeId === 'custom' && (
            <input className="field" type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} />
          )}

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="label">社群圖示列</span>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                setSocials((xs) => [...xs, { id: uid('s'), label: '社群', icon: '◎', url: 'https://' }])
              }
            >
              新增
            </button>
          </div>
          {socials.map((s) => (
            <div key={s.id} className="row">
              <input
                className="field"
                style={{ width: 56 }}
                value={s.icon}
                maxLength={MAX_EMOJI} onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, icon: limitText(e.target.value, MAX_EMOJI) } : x)))}
                title="圖示文字"
              />
              <input
                className="field"
                style={{ width: 90 }}
                value={s.label}
                maxLength={MAX_LABEL} onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, label: limitText(e.target.value, MAX_LABEL) } : x)))}
              />
              <input
                className={`field${s.url && !isValidHttpUrl(s.url) ? ' is-invalid' : ''}`}
                style={{ flex: 1 }}
                value={s.url}
                maxLength={MAX_URL}
                onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, url: limitText(e.target.value, MAX_URL) } : x)))}
              />
              <button type="button" className="btn sm danger" onClick={() => setSocials((xs) => xs.filter((x) => x.id !== s.id))}>
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn ghost"
            onClick={() => setLinks((xs) => xs.length >= MAX_LINKS ? xs : [...xs, { id: uid('l'), label: '新連結', url: 'https://' }])} disabled={links.length >= MAX_LINKS}
          >
            新增連結
          </button>
          {links.map((l, i) => (
            <div key={l.id} className="row">
              <div className="row">
                <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={i === links.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </div>
              <input
                className="field"
                value={l.label}
                maxLength={MAX_LABEL} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, label: limitText(e.target.value, MAX_LABEL) } : x)))}
              />
              <input
                className={`field${l.url && !isValidHttpUrl(l.url) ? ' is-invalid' : ''}`}
                style={{ flex: 1 }}
                value={l.url}
                maxLength={MAX_URL}
                onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, url: limitText(e.target.value, MAX_URL) } : x)))}
              />
              <button type="button" className="btn sm danger" onClick={() => setLinks((xs) => xs.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div
          className="panel stack"
          style={{ background: bg, color: fg, alignItems: 'center', textAlign: 'center', padding: 32 }}
        >
          <div className="muted" style={{ color: fg, opacity: 0.7 }}>
            即時預覽
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background:
                avatarMode === 'color'
                  ? avatarColor
                  : avatarMode === 'upload' && avatarUpload
                    ? `center / cover no-repeat url(${avatarUpload})`
                    : '#fff3',
              display: 'grid',
              placeItems: 'center',
              fontSize: 28,
              overflow: 'hidden',
            }}
          >
            {avatarMode === 'emoji' ? avatarEmoji : avatarMode === 'color' ? name.slice(0, 1) : null}
          </div>
          <h2 style={{ margin: '12px 0 4px' }}>{name}</h2>
          <p style={{ color: fg, opacity: 0.85 }}>{bio}</p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.url}
                className="tag"
                style={{ textDecoration: 'none', color: fg, border: `1px solid ${fg}44` }}
                target="_blank"
                rel="noreferrer"
                title={s.label}
              >
                {s.icon} {s.label}
              </a>
            ))}
          </div>
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
