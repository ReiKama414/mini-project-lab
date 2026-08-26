import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('rss-reader')!

const NAME_MAX = 80
const URL_MAX = 2048
const TITLE_MAX = 200
const SUMMARY_MAX = 2000
const Q_MAX = 120

type FeedSource = { id: string; name: string; url: string }
type Item = {
  id: string
  title: string
  sourceId: string
  source: string
  summary: string
  link: string
  read: boolean
  at: string
}

const seedSources: FeedSource[] = [
  { id: 's1', name: 'HN Front', url: 'https://hnrss.org/frontpage' },
  { id: 's2', name: 'Frontend Lab', url: '' },
]

const seedItems: Item[] = [
  {
    id: '1',
    title: 'Vite 6 發佈重點整理',
    sourceId: 's1',
    source: 'HN Front',
    summary: '更快的 HMR、改善 CSS 管線與實驗性功能。',
    link: 'https://example.com/vite6',
    read: false,
    at: '2026-08-20',
  },
  {
    id: '2',
    title: 'React Compiler 實務筆記',
    sourceId: 's2',
    source: 'Frontend Lab',
    summary: '何時不必再手寫 memo，以及邊界案例。',
    link: 'https://example.com/compiler',
    read: false,
    at: '2026-08-21',
  },
  {
    id: '3',
    title: '本機優先的 SaaS 架構',
    sourceId: 's1',
    source: 'HN Front',
    summary: '先 offline-capable，再逐步接雲端。',
    link: 'https://example.com/local-first',
    read: true,
    at: '2026-08-18',
  },
]

function parseRss(xml: string, source: FeedSource): Item[] {
  const items: Item[] = []
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  for (const block of blocks.slice(0, 20)) {
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    const link =
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    const summary = (
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
      ''
    )
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 200)
    const at = (
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ||
      new Date().toISOString()
    ).slice(0, 10)
    if (title) {
      items.push({
        id: uid('f'),
        title,
        sourceId: source.id,
        source: source.name,
        summary: summary || '（無摘要）',
        link: link || '#',
        read: false,
        at,
      })
    }
  }
  return items
}

export default function Page() {
  const [sources, setSources] = useLocalStorage<FeedSource[]>('lab:rss-reader:sources', seedSources)
  const [items, setItems] = useLocalStorage<Item[]>('lab:rss-reader', seedItems)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [sourceFilter, setSourceFilter] = useState('全部')
  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('https://')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((i) => (filter === 'all' ? true : !i.read))
      .filter((i) => sourceFilter === '全部' || i.sourceId === sourceFilter || i.source === sourceFilter)
      .filter((i) => !needle || i.title.toLowerCase().includes(needle) || i.summary.toLowerCase().includes(needle))
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [items, filter, sourceFilter, q])

  async function fetchFeed(source: FeedSource) {
    if (!source.url.trim()) {
      setMsg('此來源沒有 URL，請改用手動新增項目')
      return
    }
    setBusy(true)
    setMsg('擷取中…')
    try {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`
      const res = await fetch(proxy)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()
      const parsed = parseRss(xml, source)
      if (!parsed.length) throw new Error('無法解析 <item>/<title>')
      setItems((xs) => {
        const titles = new Set(xs.map((x) => x.title + x.source))
        const fresh = parsed.filter((p) => !titles.has(p.title + p.source))
        return [...fresh, ...xs]
      })
      setMsg(`已匯入 ${parsed.length} 則（略過重複）`)
    } catch (e) {
      setMsg(`擷取失敗（可能 CORS／來源無效）：${e instanceof Error ? e.message : String(e)}。可改手動新增。`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">訂閱來源</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className={cn('field', !isNonEmpty(feedName) && 'is-invalid')} maxLength={NAME_MAX} placeholder="名稱" value={feedName} onChange={(e) => setFeedName(limitText(e.target.value, NAME_MAX))} />
            <input className={cn('field', !isValidHttpUrl(normalizeHttpUrl(feedUrl)) && 'is-invalid')} style={{ flex: 1, minWidth: 160 }} maxLength={URL_MAX} placeholder="RSS URL" value={feedUrl} onChange={(e) => setFeedUrl(limitText(e.target.value, URL_MAX))} onBlur={() => { const n = normalizeHttpUrl(feedUrl); if (isValidHttpUrl(n)) setFeedUrl(n) }} />
            <button
              type="button"
              className="btn accent"
              onClick={() => {
                if (!isNonEmpty(feedName) || !isValidHttpUrl(normalizeHttpUrl(feedUrl))) return
                const u = normalizeHttpUrl(feedUrl)
                setSources((xs) => [...xs, { id: uid('s'), name: limitText(feedName.trim(), NAME_MAX), url: u }])
                setFeedName('')
                setFeedUrl('https://')
              }}
              disabled={!isNonEmpty(feedName) || !isValidHttpUrl(normalizeHttpUrl(feedUrl))}
            >
              加入
            </button>
          </div>
          <div className="field-meta">
            <span className={!isNonEmpty(feedName) || !isValidHttpUrl(normalizeHttpUrl(feedUrl)) ? 'warn' : undefined}>
              {!isNonEmpty(feedName) ? '請填來源名稱' : !isValidHttpUrl(normalizeHttpUrl(feedUrl)) ? '請輸入有效 RSS URL' : '可加入'}
            </span>
            <span>
              {charCount(feedName)}/{NAME_MAX} · {charCount(feedUrl)}/{URL_MAX}
            </span>
          </div>
          <ul className="list">
            {sources.map((s) => (
              <li key={s.id} className="list-item row" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <strong>{s.name}</strong>
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {s.url || '（僅手動）'}
                  </div>
                </div>
                <button type="button" className="btn sm ghost" disabled={busy || !s.url} onClick={() => void fetchFeed(s)}>
                  擷取
                </button>
                <button type="button" className="btn sm danger" onClick={() => setSources((xs) => xs.filter((x) => x.id !== s.id))}>
                  刪
                </button>
              </li>
            ))}
          </ul>
          {msg && <p className="muted">{msg}</p>}
          <div className="label">手動新增文章</div>
          <input className={cn('field', !isNonEmpty(title) && 'is-invalid')} maxLength={TITLE_MAX} placeholder="標題" value={title} onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))} />
          <textarea className="field" rows={2} maxLength={SUMMARY_MAX} placeholder="摘要" value={summary} onChange={(e) => setSummary(limitText(e.target.value, SUMMARY_MAX))} />
          <div className="field-meta"><span className="field-hint">手動新增文章</span><span>{charCount(summary)}/{SUMMARY_MAX}</span></div>
          <AddButton
            type="button"
            className="ghost"
            onClick={() => {
              if (!isNonEmpty(title)) return
              const src = sources[0]
              setItems((xs) => [
                {
                  id: uid('f'),
                  title: limitText(title.trim(), TITLE_MAX),
                  sourceId: src?.id || 'manual',
                  source: src?.name || '自訂',
                  summary: limitText(summary.trim() || '手動加入的訂閱項目。', SUMMARY_MAX),
                  link: '#',
                  read: false,
                  at: new Date().toISOString().slice(0, 10),
                },
                ...xs,
              ])
              setTitle('')
              setSummary('')
            }}
            disabled={!isNonEmpty(title)}
          >
            新增項目
          </AddButton>
        </div>
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className={`btn sm ${filter === 'all' ? 'accent' : 'ghost'}`} onClick={() => setFilter('all')}>
              全部
            </button>
            <button type="button" className={`btn sm ${filter === 'unread' ? 'accent' : 'ghost'}`} onClick={() => setFilter('unread')}>
              未讀 ({items.filter((i) => !i.read).length})
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => ({ ...x, read: true })))}>
              全部標已讀
            </button>
            <select className="field" style={{ width: 140 }} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="全部">全部來源</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input className="field" style={{ flex: 1, minWidth: 120 }} placeholder="搜尋…" value={q} onChange={(e) => setQ(limitText(e.target.value, Q_MAX))} />
          </div>
          <ul className="list">
            {shown.map((it) => (
              <li key={it.id} className="list-item stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ opacity: it.read ? 0.6 : 1 }}>{it.title}</strong>
                  <span className="tag">{it.source}</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {it.summary}
                </p>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="mono muted">{it.at}</span>
                  {it.link && it.link !== '#' && (
                    <a className="btn sm ghost" href={it.link} target="_blank" rel="noreferrer">
                      開啟
                    </a>
                  )}
                  <button type="button" className="btn sm ghost" onClick={() => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, read: !x.read } : x)))}>
                    {it.read ? '標未讀' : '標已讀'}
                  </button>
                  <DeleteButton onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} label="刪除" />
                </div>
              </li>
            ))}
            {!shown.length && <li className="list-item muted">無項目</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
