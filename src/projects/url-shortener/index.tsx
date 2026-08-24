import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('url-shortener')!

type Link = {
  id: string
  code: string
  url: string
  createdAt: number
  clicks: number
  note?: string
}

function makeCode(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len)
}

function shortPath(code: string) {
  return `/#/s/${code}`
}

function fullShortUrl(code: string) {
  return `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}${shortPath(code)}`
}

export default function Page() {
  const [links, setLinks] = useLocalStorage<Link[]>('lab:url-shortener', [])
  const [url, setUrl] = useState('https://')
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return links
    return links.filter(
      (l) =>
        l.code.toLowerCase().includes(s) ||
        l.url.toLowerCase().includes(s) ||
        (l.note || '').toLowerCase().includes(s),
    )
  }, [links, q])

  const totalClicks = links.reduce((n, l) => n + l.clicks, 0)

  function create() {
    try {
      const u = new URL(url.trim())
      let code = custom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || makeCode()
      if (links.some((l) => l.code === code)) {
        setMsg(`短碼「${code}」已存在`)
        return
      }
      const item: Link = {
        id: uid('url'),
        code,
        url: u.toString(),
        createdAt: Date.now(),
        clicks: 0,
        note: note.trim() || undefined,
      }
      setLinks([item, ...links])
      setUrl('https://')
      setCustom('')
      setNote('')
      setMsg(`已建立：${fullShortUrl(code)}`)
    } catch {
      setMsg('請輸入有效 URL')
    }
  }

  function open(item: Link) {
    setLinks(links.map((l) => (l.id === item.id ? { ...l, clicks: l.clicks + 1 } : l)))
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted">
          本機短網址對照表，資料存在瀏覽器。複製格式為{' '}
          <span className="mono">/#/s/短碼</span>（示範用，不會實際路由轉址）。
        </p>

        <div className="grid-3">
          <div className="metric">
            <div className="muted">連結數</div>
            <div style={{ fontSize: 24 }}>{links.length}</div>
          </div>
          <div className="metric">
            <div className="muted">總點擊</div>
            <div style={{ fontSize: 24 }}>{totalClicks}</div>
          </div>
          <div className="metric">
            <div className="muted">平均點擊</div>
            <div style={{ fontSize: 24 }}>
              {links.length ? (totalClicks / links.length).toFixed(1) : '0'}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <input
            className="field"
            placeholder="原始 URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="自訂短碼（選填）"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="備註（選填）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn accent" onClick={create}>
              縮短
            </button>
          </div>
        </div>

        {msg && <p className="tag">{msg}</p>}

        <div className="row">
          <input
            className="field"
            style={{ flex: 1 }}
            placeholder="搜尋短碼 / URL / 備註…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <ul className="list">
          {visible.map((l) => (
            <li
              key={l.id}
              className="list-item"
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
            >
              <div className="row">
                <span className="mono" style={{ fontWeight: 600 }}>
                  {shortPath(l.code)}
                </span>
                <span className="tag">點擊 {l.clicks}</span>
              </div>
              <span className="muted" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                {l.url}
              </span>
              {l.note && <span className="tag">{l.note}</span>}
              <div className="row muted" style={{ fontSize: 12 }}>
                <span>{new Date(l.createdAt).toLocaleString('zh-TW')}</span>
              </div>
              <div className="row">
                <button className="btn sm teal" onClick={() => open(l)}>
                  開啟（計次）
                </button>
                <button className="btn sm ghost" onClick={() => copyText(l.code)}>
                  複製短碼
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    copyText(fullShortUrl(l.code))
                    setMsg('已複製完整本機 URL')
                  }}
                >
                  複製完整 URL
                </button>
                <button
                  className="btn sm ghost"
                  onClick={() => setLinks(links.filter((x) => x.id !== l.id))}
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
          {!visible.length && <p className="muted">尚無短網址</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
