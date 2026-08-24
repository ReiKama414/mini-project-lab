import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick, randomInt, uid, charCount, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'

const meta = getProject('personal-dashboard')!

type Todo = { id: string; text: string; done: boolean }
type Link = { id: string; label: string; url: string }
type Weather = { city: string; temp: number; condition: string; humidity: number; wind: number }

const MAX_TODOS = 100
const MAX_LINKS = 30
const MAX_TODO = 80
const MAX_FOCUS = 80
const MAX_NOTE = 2000
const MAX_CITY = 40
const MAX_LABEL = 40
const MAX_URL = 2048

const CONDITIONS = ['晴朗', '多雲', '陰天', '小雨', '陣雨', '微風']

export default function Page() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('lab:personal-dashboard:todos', [
    { id: '1', text: '回覆重要郵件', done: false },
    { id: '2', text: '運動 30 分', done: true },
  ])
  const [focus, setFocus] = useLocalStorage('lab:personal-dashboard:focus', '完成側專案首頁')
  const [note, setNote] = useLocalStorage('lab:personal-dashboard:note', '')
  const [links, setLinks] = useLocalStorage<Link[]>('lab:personal-dashboard:links', [
    { id: '1', label: 'GitHub', url: 'https://github.com' },
    { id: '2', label: 'Calendar', url: 'https://calendar.google.com' },
    { id: '3', label: 'Docs', url: 'https://docs.google.com' },
  ])
  const [weather, setWeather] = useLocalStorage<Weather>('lab:personal-dashboard:weather', {
    city: '台北',
    temp: 28,
    condition: '多雲',
    humidity: 72,
    wind: 12,
  })
  const [now, setNow] = useState(new Date())
  const [draft, setDraft] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('https://')
  const [editTodo, setEditTodo] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const done = todos.filter((t) => t.done).length
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0
  const greeting = useMemo(() => {
    const h = now.getHours()
    if (h < 12) return '早安'
    if (h < 18) return '午安'
    return '晚安'
  }, [now])

  const draftOk = isNonEmpty(draft)
  const todosAtLimit = todos.length >= MAX_TODOS
  const canAddTodo = draftOk && !todosAtLimit
  const linkLabelOk = isNonEmpty(linkLabel)
  const linkUrlOk = isValidHttpUrl(linkUrl)
  const linksAtLimit = links.length >= MAX_LINKS
  const canAddLink = linkLabelOk && linkUrlOk && !linksAtLimit

  function addTodo() {
    if (!canAddTodo) return
    setTodos((t) => [...t, { id: uid('t'), text: limitText(draft.trim(), MAX_TODO), done: false }])
    setDraft('')
  }

  function refreshWeather() {
    setWeather((w) => ({
      ...w,
      temp: randomInt(18, 34),
      condition: pick(CONDITIONS),
      humidity: randomInt(40, 95),
      wind: randomInt(3, 28),
    }))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-3">
        <div className="panel metric stack">
          <div className="muted">
            {greeting} · 現在時間
          </div>
          <div className="mono" style={{ fontSize: 28 }}>
            {now.toLocaleTimeString('zh-TW')}
          </div>
          <div className="muted">{now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label" style={{ margin: 0 }}>
              天氣（模擬）
            </div>
            <button type="button" className="btn sm ghost" onClick={refreshWeather}>
              刷新
            </button>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" value={weather.city} maxLength={MAX_CITY} onChange={(e) => setWeather((w) => ({ ...w, city: limitText(e.target.value, MAX_CITY) }))} />
            <div className="field-meta"><span /><span>{charCount(weather.city)} / {MAX_CITY}</span></div>
          </div>
          <div className="metric">
            {weather.temp}°C · {weather.condition}
          </div>
          <div className="muted">
            濕度 {weather.humidity}% · 風速 {weather.wind} km/h
          </div>
        </div>
        <div className="panel stack">
          <div className="label">今日焦點</div>
          <div className="stack" style={{ gap: 0 }}>
            <input className="field" value={focus} maxLength={MAX_FOCUS} onChange={(e) => setFocus(limitText(e.target.value, MAX_FOCUS))} />
            <div className="field-meta"><span /><span>{charCount(focus)} / {MAX_FOCUS}</span></div>
          </div>
          <div className="progress">
            <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: 'var(--teal)' }} />
          </div>
          <span className="muted">
            待辦進度 {done}/{todos.length}（{pct}%）
          </span>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel stack">
          <div className="label">待辦（可編輯）</div>
          <div className="row">
            <div className="stack" style={{ flex: 1, gap: 0 }}>
              <input className={`field${draft.length > 0 && !draftOk ? ' is-invalid' : ''}`} style={{ width: '100%' }} value={draft} maxLength={MAX_TODO} placeholder="新增待辦" onChange={(e) => setDraft(limitText(e.target.value, MAX_TODO))} onKeyDown={(e) => e.key === 'Enter' && addTodo()} />
              <div className="field-meta"><span className={todosAtLimit ? 'warn' : undefined}>{todosAtLimit ? `待辦上限 ${MAX_TODOS}` : ' '}</span><span>{charCount(draft)} / {MAX_TODO}</span></div>
            </div>
            <button type="button" className="btn accent" onClick={addTodo} disabled={!canAddTodo}>
              新增
            </button>
          </div>
          <ul className="list">
            {todos.map((t) => (
              <li key={t.id} className="list-item row">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                />
                {editTodo === t.id ? (
                  <input
                    className="field"
                    style={{ flex: 1 }}
                    value={editText}
                    maxLength={MAX_TODO}
                    onChange={(e) => setEditText(limitText(e.target.value, MAX_TODO))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, text: editText.trim() || x.text } : x)))
                        setEditTodo(null)
                      }
                    }}
                  />
                ) : (
                  <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                )}
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    if (editTodo === t.id) {
                      setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, text: editText.trim() || x.text } : x)))
                      setEditTodo(null)
                    } else {
                      setEditTodo(t.id)
                      setEditText(t.text)
                    }
                  }}
                >
                  {editTodo === t.id ? '存' : '編'}
                </button>
                <button type="button" className="btn sm danger" onClick={() => setTodos((xs) => xs.filter((x) => x.id !== t.id))}>
                  刪
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <div className="label">快速筆記</div>
          <div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={4} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(limitText(e.target.value, MAX_NOTE))} placeholder="隨手記…" />
            <div className="field-meta"><span /><span>{charCount(note)} / {MAX_NOTE}</span></div>
          </div>
          <div className="label">快速連結</div>
          <div className="row">
            <div className="stack" style={{ gap: 0 }}>
              <input className={`field${linkLabel.length > 0 && !linkLabelOk ? ' is-invalid' : ''}`} placeholder="名稱" value={linkLabel} maxLength={MAX_LABEL} onChange={(e) => setLinkLabel(limitText(e.target.value, MAX_LABEL))} />
              <div className="field-meta"><span /><span>{charCount(linkLabel)} / {MAX_LABEL}</span></div>
            </div>
            <div className="stack" style={{ flex: 1, gap: 0 }}>
              <input className={`field${linkUrl.length > 0 && !linkUrlOk ? ' is-invalid' : ''}`} style={{ width: '100%' }} placeholder="URL" value={linkUrl} maxLength={MAX_URL} onChange={(e) => setLinkUrl(limitText(e.target.value, MAX_URL))} />
              <div className="field-meta"><span className={linkUrl.length > 0 && !linkUrlOk ? 'warn' : undefined}>{linkUrl.length > 0 && !linkUrlOk ? '網址無效' : ' '}</span><span>{charCount(linkUrl)} / {MAX_URL}</span></div>
            </div>
            <button
              type="button"
              className="btn ghost"
              disabled={!canAddLink}
              onClick={() => {
                if (!canAddLink) return
                setLinks((xs) => [...xs, { id: uid('l'), label: linkLabel.trim(), url: normalizeHttpUrl(linkUrl) }])
                setLinkLabel('')
                setLinkUrl('https://')
              }}
            >
              加
            </button>
          </div>
          <div className="stack">
            {links.map((l) => (
              <div key={l.id} className="row">
                <a className="btn" href={l.url} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                  {l.label}
                </a>
                <button type="button" className="btn sm danger" onClick={() => setLinks((xs) => xs.filter((x) => x.id !== l.id))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
