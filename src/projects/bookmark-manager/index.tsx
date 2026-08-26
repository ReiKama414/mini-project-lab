import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import {
  charCount,
  downloadText,
  isNonEmpty,
  isValidHttpUrl,
  limitText,
  normalizeHttpUrl,
  uid,
} from '../../lib/utils'

const meta = getProject('bookmark-manager')!

type Bookmark = {
  id: string
  title: string
  url: string
  folder: string
  tags: string[]
  createdAt: number
}

const FOLDERS = ['全部', '工作', '學習', '娛樂', '其他']
const FOLDER_SET = new Set(FOLDERS.filter((f) => f !== '全部'))
const MAX_ITEMS = 200
const MAX_TITLE = 80
const MAX_URL = 2048
const MAX_TAGS = 120
const MAX_SEARCH = 80

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return ''
  }
}

function letterAvatar(title: string) {
  return (title.trim()[0] || '?').toUpperCase()
}

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseBookmarkRow(row: unknown): Bookmark | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const title = typeof r.title === 'string' ? limitText(r.title.trim(), MAX_TITLE) : ''
  const rawUrl = typeof r.url === 'string' ? r.url : ''
  if (!title || !isValidHttpUrl(rawUrl)) return null
  const folderRaw = typeof r.folder === 'string' ? r.folder.trim() : '其他'
  const tags = Array.isArray(r.tags)
    ? r.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20)
    : []
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid('bm'),
    title,
    url: normalizeHttpUrl(limitText(rawUrl, MAX_URL)),
    folder: FOLDER_SET.has(folderRaw) ? folderRaw : '其他',
    tags,
    createdAt:
      typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
  }
}

function parseBookmarksJson(raw: unknown): Bookmark[] | null {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { bookmarks?: unknown }).bookmarks)
      ? (raw as { bookmarks: unknown[] }).bookmarks
      : null
  if (!list) return null
  const out: Bookmark[] = []
  for (const row of list) {
    const b = parseBookmarkRow(row)
    if (b) out.push(b)
  }
  return out.slice(0, MAX_ITEMS)
}

function toNetscapeHtml(bookmarks: Bookmark[]) {
  const byFolder = new Map<string, Bookmark[]>()
  for (const b of bookmarks) {
    const f = b.folder || '其他'
    const list = byFolder.get(f) ?? []
    list.push(b)
    byFolder.set(f, list)
  }
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ]
  for (const [folder, list] of byFolder) {
    lines.push(`    <DT><H3>${escHtml(folder)}</H3>`)
    lines.push('    <DL><p>')
    for (const b of list) {
      const add = Math.floor(b.createdAt / 1000)
      const tags = b.tags.length ? ` TAGS="${escHtml(b.tags.join(','))}"` : ''
      lines.push(
        `        <DT><A HREF="${escHtml(b.url)}" ADD_DATE="${add}"${tags}>${escHtml(b.title)}</A>`,
      )
    }
    lines.push('    </DL><p>')
  }
  lines.push('</DL><p>')
  return lines.join('\n')
}

function parseNetscapeHtml(html: string): Bookmark[] {
  const out: Bookmark[] = []
  let folder = '其他'
  const folderRe = /<H3[^>]*>([^<]*)<\/H3>/gi
  const linkRe = /<A\s+([^>]+)>([^<]*)<\/A>/gi
  // Walk roughly by splitting on DT blocks
  const chunks = html.split(/<DT>/i)
  for (const chunk of chunks) {
    folderRe.lastIndex = 0
    linkRe.lastIndex = 0
    const h3 = folderRe.exec(chunk)
    if (h3?.[1]) {
      const name = h3[1].trim()
      folder = FOLDER_SET.has(name) ? name : '其他'
    }
    const a = linkRe.exec(chunk)
    if (!a) continue
    const attrs = a[1] ?? ''
    const title = limitText((a[2] ?? '').trim() || '未命名', MAX_TITLE)
    const hrefM = /HREF\s*=\s*"([^"]*)"/i.exec(attrs) || /HREF\s*=\s*'([^']*)'/i.exec(attrs)
    const rawUrl = hrefM?.[1]?.trim() ?? ''
    if (!title || !isValidHttpUrl(rawUrl)) continue
    const addM = /ADD_DATE\s*=\s*"(\d+)"/i.exec(attrs)
    const tagsM = /TAGS\s*=\s*"([^"]*)"/i.exec(attrs)
    const addSec = addM ? Number(addM[1]) : NaN
    out.push({
      id: uid('bm'),
      title,
      url: normalizeHttpUrl(limitText(rawUrl, MAX_URL)),
      folder,
      tags: tagsM?.[1]
        ? tagsM[1]
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [],
      createdAt: Number.isFinite(addSec) ? addSec * 1000 : Date.now(),
    })
  }
  return out.slice(0, MAX_ITEMS)
}

/** Merge imported into existing by id (or url+title); never wipe on empty/invalid. */
function mergeBookmarks(existing: Bookmark[], incoming: Bookmark[]): Bookmark[] {
  const byId = new Map(existing.map((b) => [b.id, b]))
  const byUrl = new Map(existing.map((b) => [b.url, b.id]))
  for (const b of incoming) {
    const urlId = byUrl.get(b.url)
    if (byId.has(b.id)) {
      byId.set(b.id, { ...byId.get(b.id)!, ...b, id: b.id })
    } else if (urlId && byId.has(urlId)) {
      const prev = byId.get(urlId)!
      byId.set(urlId, { ...prev, ...b, id: urlId })
    } else {
      byId.set(b.id, b)
      byUrl.set(b.url, b.id)
    }
  }
  return [...byId.values()].slice(0, MAX_ITEMS)
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Bookmark[]>('lab:bookmark-manager', [
    {
      id: '1',
      title: 'MDN',
      url: 'https://developer.mozilla.org',
      folder: '學習',
      tags: ['文件', 'Web'],
      createdAt: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'React',
      url: 'https://react.dev',
      folder: '工作',
      tags: ['前端'],
      createdAt: Date.now() - 3600000,
    },
  ])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('https://')
  const [folder, setFolder] = useState('工作')
  const [tagInput, setTagInput] = useState('')
  const [filterFolder, setFilterFolder] = useState('全部')
  const [filterTag, setFilterTag] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const jsonImportRef = useRef<HTMLInputElement>(null)
  const htmlImportRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach((b) => b.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [items])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((b) => filterFolder === '全部' || b.folder === filterFolder)
      .filter((b) => !filterTag || b.tags.includes(filterTag))
      .filter(
        (b) =>
          !s ||
          b.title.toLowerCase().includes(s) ||
          b.url.toLowerCase().includes(s) ||
          b.tags.some((t) => t.toLowerCase().includes(s)),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [items, filterFolder, filterTag, q])

  function parseTags(raw: string) {
    return raw
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)
  }

  const titleOk = isNonEmpty(title)
  const normalizedUrl = normalizeHttpUrl(url)
  const urlOk = isValidHttpUrl(url)
  const atLimit = !editing && items.length >= MAX_ITEMS
  const canSave = titleOk && urlOk && !atLimit

  function add() {
    if (!canSave) return
    setItems([
      {
        id: uid('bm'),
        title: title.trim(),
        url: normalizedUrl,
        folder,
        tags: parseTags(tagInput),
        createdAt: Date.now(),
      },
      ...items,
    ])
    setTitle('')
    setUrl('https://')
    setTagInput('')
  }

  function saveEdit(id: string) {
    if (!titleOk || !urlOk) return
    setItems(
      items.map((x) =>
        x.id === id
          ? {
              ...x,
              title: title.trim(),
              url: normalizedUrl,
              folder,
              tags: parseTags(tagInput),
            }
          : x,
      ),
    )
    setEditing(null)
    setTitle('')
    setUrl('https://')
    setTagInput('')
    setFolder('工作')
  }

  function startEdit(b: Bookmark) {
    setEditing(b.id)
    setTitle(b.title)
    setUrl(b.url)
    setFolder(b.folder)
    setTagInput(b.tags.join(', '))
  }

  function cancelEdit() {
    setEditing(null)
    setTitle('')
    setUrl('https://')
    setTagInput('')
    setFolder('工作')
  }

  function exportJson() {
    downloadText(
      'bookmarks.json',
      JSON.stringify({ version: 1, bookmarks: items }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  function exportHtml() {
    downloadText('bookmarks.html', toNetscapeHtml(items), 'text/html;charset=utf-8')
  }

  async function importJsonFile(file: File | null) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const list = parseBookmarksJson(parsed)
      if (!list?.length) {
        setImportMsg('JSON 無效或無有效書籤')
        return
      }
      setItems(mergeBookmarks(items, list))
      setImportMsg(`已合併匯入 ${list.length} 筆書籤（JSON）`)
    } catch {
      setImportMsg('JSON 讀取或解析失敗，資料未變更')
    }
  }

  async function importHtmlFile(file: File | null) {
    if (!file) return
    try {
      const list = parseNetscapeHtml(await file.text())
      if (!list.length) {
        setImportMsg('bookmarks.html 無有效連結')
        return
      }
      setItems(mergeBookmarks(items, list))
      setImportMsg(`已合併匯入 ${list.length} 筆書籤（HTML）`)
    } catch {
      setImportMsg('HTML 讀取失敗，資料未變更')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!items.length} onClick={exportJson}>
            匯出 JSON
          </button>
          <button type="button" className="btn ghost sm" disabled={!items.length} onClick={exportHtml}>
            匯出 bookmarks.html
          </button>
          <button type="button" className="btn ghost sm" onClick={() => jsonImportRef.current?.click()}>
            匯入 JSON
          </button>
          <button type="button" className="btn ghost sm" onClick={() => htmlImportRef.current?.click()}>
            匯入 HTML
          </button>
          <input
            ref={jsonImportRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importJsonFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <input
            ref={htmlImportRef}
            type="file"
            accept="text/html,.html,.htm"
            hidden
            onChange={(e) => {
              void importHtmlFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </div>
      }
    >
      <div className="panel stack">
        {importMsg && <p className="muted" style={{ fontSize: 13 }}>{importMsg}</p>}
        <div className="grid-2">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="標題"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入標題' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${url.length > 0 && !urlOk ? ' is-invalid' : ''}`}
              placeholder="URL"
              value={url}
              maxLength={MAX_URL}
              onChange={(e) => setUrl(limitText(e.target.value, MAX_URL))}
            />
            <div className="field-meta">
              <span className={!urlOk && url.length > 0 ? 'warn' : undefined}>
                {!urlOk && url.length > 0 ? '請輸入有效的 http(s) 網址' : '\u00a0'}
              </span>
              <span>
                {charCount(url)} / {MAX_URL}
              </span>
            </div>
          </div>
        </div>
        <div className="row">
          <select
            className="field"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            style={{ maxWidth: 140 }}
          >
            {FOLDERS.filter((f) => f !== '全部').map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <div className="field-wrap" style={{ flex: 1 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="標籤（逗號分隔）"
              value={tagInput}
              maxLength={MAX_TAGS}
              onChange={(e) => setTagInput(limitText(e.target.value, MAX_TAGS))}
            />
            <div className="field-meta">
              <span className="field-hint">最多 20 個標籤</span>
              <span>
                {charCount(tagInput)} / {MAX_TAGS}
              </span>
            </div>
          </div>
          {editing ? (
            <>
              <button type="button" className="btn accent" onClick={() => saveEdit(editing)} disabled={!titleOk || !urlOk}>
                儲存
              </button>
              <button type="button" className="btn ghost" onClick={cancelEdit}>
                取消
              </button>
            </>
          ) : (
            <AddButton type="button"  onClick={add} disabled={!canSave}>
              新增書籤</AddButton>
          )}
        </div>
        {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 筆書籤，請先刪除再新增</p>}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {FOLDERS.map((f) => (
            <button type="button"
              key={f}
              className={`btn sm ${filterFolder === f ? 'accent' : 'ghost'}`}
              onClick={() => setFilterFolder(f)}
            >
              {f}
            </button>
          ))}
          <div className="field-wrap" style={{ flex: 1, minWidth: 140 }}>
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋標題 / URL / 標籤…"
              value={q}
              maxLength={MAX_SEARCH}
              onChange={(e) => setQ(limitText(e.target.value, MAX_SEARCH))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(q)} / {MAX_SEARCH}
              </span>
            </div>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button"
              className={`btn sm ${!filterTag ? 'teal' : 'ghost'}`}
              onClick={() => setFilterTag('')}
            >
              全部標籤
            </button>
            {allTags.map((t) => (
              <button type="button"
                key={t}
                className={`btn sm ${filterTag === t ? 'teal' : 'ghost'}`}
                onClick={() => setFilterTag(filterTag === t ? '' : t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <ul className="list">
          {visible.map((b) => {
            const icon = faviconUrl(b.url)
            return (
              <li key={b.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    width={28}
                    height={28}
                    style={{ borderRadius: 6, marginTop: 4 }}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <span
                    className="tag"
                    style={{ width: 28, height: 28, placeContent: 'center', textAlign: 'center' }}
                  >
                    {letterAvatar(b.title)}
                  </span>
                )}
                <div className="stack" style={{ flex: 1, gap: 4 }}>
                  <strong>{b.title}</strong>
                  <a href={b.url} target="_blank" rel="noreferrer" className="muted">
                    {b.url}
                  </a>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <span className="tag">{b.folder}</span>
                    {b.tags.map((t) => (
                      <span key={t} className="tag">
                        #{t}
                      </span>
                    ))}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(b.createdAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                </div>
                <a className="btn sm teal" href={b.url} target="_blank" rel="noreferrer">
                  開啟
                </a>
                <button type="button" className="btn sm ghost" onClick={() => startEdit(b)}>
                  編輯
                </button>
                <DeleteButton onClick={() => setItems(items.filter((x) => x.id !== b.id))} label="刪除" />
              </li>
            )
          })}
          {!visible.length && <p className="muted">尚無符合的書籤</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
