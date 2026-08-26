import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, charCount, isValidHttpUrl, limitText } from '../../lib/utils'
import { escapeHtml } from '../../lib/sanitize'

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

  function exportHtml() {
    const avatarBlock =
      avatarMode === 'emoji'
        ? `<div style="width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:#fff3;margin:0 auto">${escapeHtml(avatarEmoji)}</div>`
        : avatarMode === 'color'
          ? `<div style="width:72px;height:72px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:${escapeHtml(avatarColor)};color:#fff;margin:0 auto">${escapeHtml(name.slice(0, 1))}</div>`
          : avatarUpload
            ? `<div style="width:72px;height:72px;border-radius:50%;background:center/cover no-repeat url(${JSON.stringify(avatarUpload)});margin:0 auto"></div>`
            : ''
    const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(name)}</title>
<body style="margin:0;font-family:system-ui,sans-serif;background:${escapeHtml(bg)};color:${escapeHtml(fg)};min-height:100vh;display:flex;align-items:center;justify-content:center">
<main style="width:100%;max-width:360px;padding:32px 20px;text-align:center">
${avatarBlock}
<h1 style="margin:16px 0 8px;font-size:1.5rem">${escapeHtml(name)}</h1>
<p style="opacity:.85;margin:0 0 16px">${escapeHtml(bio)}</p>
<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px">
${socials
  .map(
    (s) =>
      `<a href="${escapeHtml(s.url)}" style="color:${escapeHtml(fg)};text-decoration:none;border:1px solid ${escapeHtml(fg)}44;padding:4px 10px;border-radius:999px;font-size:13px">${escapeHtml(s.icon)} ${escapeHtml(s.label)}</a>`,
  )
  .join('\n')}
</div>
<div style="display:flex;flex-direction:column;gap:10px">
${links
  .map(
    (l) =>
      `<a href="${escapeHtml(l.url)}" style="display:block;padding:12px 16px;border-radius:10px;background:${escapeHtml(btnBg)};color:${escapeHtml(btnFg)};text-decoration:none;font-weight:600">${escapeHtml(l.label)}</a>`,
  )
  .join('\n')}
</div>
</main>
</body></html>`
    downloadText('link-in-bio.html', html, 'text/html;charset=utf-8')
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
          <button type="button" className="btn ghost sm" onClick={() => downloadText('link-in-bio.txt', sharePageText())}>
            匯出頁面文字
          </button>
          <button type="button" className="btn accent sm" onClick={exportHtml}>
            匯出 HTML
          </button>
          <button type="button" className="btn ghost sm" onClick={() => window.print()}>
            列印預覽
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
            <AddButton
              type="button"
              className="sm ghost"
              disabled={socials.length >= MAX_SOCIALS}
              onClick={() =>
                setSocials((xs) =>
                  xs.length >= MAX_SOCIALS
                    ? xs
                    : [...xs, { id: uid('s'), label: '社群', icon: '◎', url: 'https://' }],
                )
              }
            >
              新增
            </AddButton>
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

          <AddButton
            type="button"
            className="ghost"
            onClick={() => setLinks((xs) => xs.length >= MAX_LINKS ? xs : [...xs, { id: uid('l'), label: '新連結', url: 'https://' }])} disabled={links.length >= MAX_LINKS}
          >
            新增連結
          </AddButton>
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
