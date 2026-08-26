import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn, downloadText } from '../../lib/utils'

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

const defaultSources: FeedSource[] = [{ id: 's1', name: 'HN Front', url: 'https://hnrss.org/frontpage' }]

async function fetchViaProxies(url: string): Promise<string> {
  const attempts = [
    { label: 'allorigins', href: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
    { label: 'corsproxy', href: `https://corsproxy.io/?${encodeURIComponent(url)}` },
  ]
  const errors: string[] = []
  for (const a of attempts) {
    try {
      const res = await fetch(a.href)
      if (!res.ok) {
        errors.push(`${a.label}: HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      if (!text.trim()) {
        errors.push(`${a.label}: 空回應`)
        continue
      }
      return text
    } catch (e) {
      errors.push(`${a.label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(errors.join(' → ') || '代理皆失敗')
}

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

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function sourcesToOpml(sources: FeedSource[]) {
  const outlines = sources
    .filter((s) => s.url.trim())
    .map((s) => `    <outline type="rss" text="${escapeXml(s.name)}" title="${escapeXml(s.name)}" xmlUrl="${escapeXml(s.url)}" />`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>RSS feeds</title>\n  </head>\n  <body>\n${outlines}\n  </body>\n</opml>\n`
}

function parseOpml(xml: string): FeedSource[] {
  const found: FeedSource[] = []
  const re = /<outline\b([^>]*)\/?\s*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1] || ''
    const xmlUrl =
      attrs.match(/\bxmlUrl\s*=\s*["']([^"']+)["']/i)?.[1] ||
      attrs.match(/\burl\s*=\s*["']([^"']+)["']/i)?.[1] ||
      ''
    const name =
      attrs.match(/\btext\s*=\s*["']([^"']+)["']/i)?.[1] ||
      attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ||
      xmlUrl
    if (xmlUrl && isValidHttpUrl(normalizeHttpUrl(xmlUrl))) {
      found.push({
        id: uid('s'),
        name: limitText(name.trim() || 'Feed', NAME_MAX),
        url: normalizeHttpUrl(xmlUrl),
      })
    }
  }
  return found
}

export default function Page() {
  const [sources, setSources] = useLocalStorage<FeedSource[]>('lab:rss-reader:sources', defaultSources)
  const [items, setItems] = useLocalStorage<Item[]>('lab:rss-reader', [])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [sourceFilter, setSourceFilter] = useState('全部')
  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [feedName, setFeedName] = useState('')
  const [feedUrl, setFeedUrl] = useState('https://')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [seedCleaned, setSeedCleaned] = useLocalStorage('lab:rss-reader:seed-cleaned', false)
  const opmlRef = useRef<HTMLInputElement>(null)

  // One-time：移除舊版假種子文章與無 URL 的「Frontend Lab」
  useEffect(() => {
    if (seedCleaned) return
    const fakeTitles = new Set(['Vite 6 發佈重點整理', 'React Compiler 實務筆記', '本機優先的 SaaS 架構'])
    setItems((xs) => xs.filter((i) => !fakeTitles.has(i.title) && !i.link.includes('example.com')))
    setSources((xs) => {
      const cleaned = xs.filter((s) => s.url.trim() || s.name !== 'Frontend Lab')
      return cleaned.length ? cleaned : defaultSources
    })
    setSeedCleaned(true)
  }, [seedCleaned, setItems, setSources, setSeedCleaned])

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
    setMsg('擷取中（allorigins → corsproxy）…')
    try {
      const xml = await fetchViaProxies(source.url)
      const parsed = parseRss(xml, source)
      if (!parsed.length) throw new Error('無法解析 <item>/<title>')
      setItems((xs) => {
        const titles = new Set(xs.map((x) => x.title + x.source))
        const fresh = parsed.filter((p) => !titles.has(p.title + p.source))
        return [...fresh, ...xs]
      })
      setMsg(`已匯入 ${parsed.length} 則（略過重複）`)
    } catch (e) {
      setMsg(`擷取失敗：${e instanceof Error ? e.message : String(e)}。可改手動新增。`)
    } finally {
      setBusy(false)
    }
  }

  function importOpml(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseOpml(String(reader.result || ''))
        if (!parsed.length) throw new Error('找不到 outline／xmlUrl')
        setSources((xs) => {
          const urls = new Set(xs.map((s) => s.url))
          const fresh = parsed.filter((p) => !urls.has(p.url))
          return [...xs, ...fresh]
        })
        setMsg(`OPML 匯入 ${parsed.length} 個來源（略過重複 URL）`)
      } catch (e) {
        setMsg(`OPML 匯入失敗：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => downloadText('feeds.opml', sourcesToOpml(sources), 'text/x-opml+xml')}
            disabled={!sources.some((s) => s.url.trim())}
          >
            匯出 OPML
          </button>
          <button type="button" className="btn ghost sm" onClick={() => opmlRef.current?.click()}>
            匯入 OPML
          </button>
        </div>
      }
    >
      <input
        ref={opmlRef}
        type="file"
        accept=".opml,.xml,text/xml,application/xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importOpml(f)
          e.target.value = ''
        }}
      />
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機 RSS 閱讀器：預設僅含真實 HN 來源、無假文章。擷取會依序嘗試 allorigins、corsproxy；訂閱清單可匯入／匯出 OPML。
      </p>
      <div className="grid-2">
        <div className="panel stack">
          <div className="label">訂閱來源</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input
              className={cn('field', !isNonEmpty(feedName) && 'is-invalid')}
              maxLength={NAME_MAX}
              placeholder="名稱"
              value={feedName}
              onChange={(e) => setFeedName(limitText(e.target.value, NAME_MAX))}
            />
            <input
              className={cn('field', !isValidHttpUrl(normalizeHttpUrl(feedUrl)) && 'is-invalid')}
              style={{ flex: 1, minWidth: 160 }}
              maxLength={URL_MAX}
              placeholder="RSS URL"
              value={feedUrl}
              onChange={(e) => setFeedUrl(limitText(e.target.value, URL_MAX))}
              onBlur={() => {
                const n = normalizeHttpUrl(feedUrl)
                if (isValidHttpUrl(n)) setFeedUrl(n)
              }}
            />
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
          <input
            className={cn('field', !isNonEmpty(title) && 'is-invalid')}
            maxLength={TITLE_MAX}
            placeholder="標題"
            value={title}
            onChange={(e) => setTitle(limitText(e.target.value, TITLE_MAX))}
          />
          <textarea
            className="field"
            rows={2}
            maxLength={SUMMARY_MAX}
            placeholder="摘要"
            value={summary}
            onChange={(e) => setSummary(limitText(e.target.value, SUMMARY_MAX))}
          />
          <div className="field-meta">
            <span className="field-hint">手動新增文章</span>
            <span>
              {charCount(summary)}/{SUMMARY_MAX}
            </span>
          </div>
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
            <input
              className="field"
              style={{ flex: 1, minWidth: 120 }}
              placeholder="搜尋…"
              value={q}
              onChange={(e) => setQ(limitText(e.target.value, Q_MAX))}
            />
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
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, read: !x.read } : x)))}
                  >
                    {it.read ? '標未讀' : '標已讀'}
                  </button>
                  <DeleteButton onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} label="刪除" />
                </div>
              </li>
            ))}
            {!shown.length && <li className="list-item muted">尚無項目 · 請擷取訂閱或手動新增</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
