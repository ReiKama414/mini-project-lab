import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, limitText, charCount, downloadText, isNonEmpty } from '../../lib/utils'

const meta = getProject('newsletter-reader')!

const Q_MAX = 120
const FOLDER_MAX = 40
const FROM_MAX = 80
const SUBJECT_MAX = 200
const BODY_MAX = 20000

type Folder = 'inbox' | 'star' | 'archive' | 'unread'
type NL = {
  id: string
  from: string
  subject: string
  body: string
  folder: string
  starred: boolean
  archived: boolean
  read: boolean
  at: number
  sample?: boolean
}

const sampleSeed: NL[] = [
  {
    id: 'sample_1',
    from: 'Bytes.dev',
    subject: '【範例可刪】本週前端精選',
    body: '包含 CSS 新語法、bundler 比較與一則效能案例。此為示範文章，可刪除後改貼你自己的內容。',
    folder: '前端',
    starred: true,
    archived: false,
    read: false,
    at: Date.now() - 86400000,
    sample: true,
  },
  {
    id: 'sample_2',
    from: 'TLDR',
    subject: '【範例可刪】AI 工具速覽',
    body: '本地模型推理、評測基準與授權注意事項。範例內容，匯入 JSON／Markdown 或手動貼上即可建立真實歸檔。',
    folder: 'AI',
    starred: false,
    archived: false,
    read: false,
    at: Date.now() - 3600000 * 5,
    sample: true,
  },
]

function parseMarkdownImport(text: string): Partial<NL>[] {
  const parts = text.split(/\n(?=#{1,3}\s)/)
  const out: Partial<NL>[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const titleMatch = trimmed.match(/^#{1,3}\s+(.+)\n?/)
    if (titleMatch) {
      const subject = titleMatch[1]!.trim()
      const body = trimmed.slice(titleMatch[0].length).trim()
      out.push({ subject, body, from: '匯入' })
    } else if (out.length === 0) {
      const lines = trimmed.split('\n')
      out.push({ subject: lines[0]!.slice(0, SUBJECT_MAX) || '無標題', body: lines.slice(1).join('\n').trim() || trimmed, from: '匯入' })
    }
  }
  return out
}

function parseJsonImport(text: string): Partial<NL>[] {
  const data = JSON.parse(text) as unknown
  const arr = Array.isArray(data) ? data : [data]
  return arr.map((row) => {
    const r = row as Record<string, unknown>
    return {
      from: String(r.from ?? r.author ?? '匯入'),
      subject: String(r.subject ?? r.title ?? '無標題'),
      body: String(r.body ?? r.content ?? r.text ?? ''),
      folder: String(r.folder ?? ''),
      at: typeof r.at === 'number' ? r.at : Date.now(),
    }
  })
}

export default function Page() {
  const [items, setItems] = useLocalStorage<NL[]>('lab:newsletter-reader', sampleSeed)
  const [folders, setFolders] = useLocalStorage<string[]>('lab:newsletter-reader:folders', ['前端', 'AI', '設計', '其他'])
  const [sel, setSel] = useState(sampleSeed[0]!.id)
  const [tab, setTab] = useState<Folder>('inbox')
  const [folderFilter, setFolderFilter] = useState<string>('全部')
  const [newFolder, setNewFolder] = useState('')
  const [q, setQ] = useLocalStorage('lab:newsletter-reader:q', '')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftFolder, setDraftFolder] = useState(() => folders[0] || '其他')
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((i) => {
        if (tab === 'inbox') return !i.archived
        if (tab === 'star') return i.starred && !i.archived
        if (tab === 'archive') return i.archived
        return !i.read && !i.archived
      })
      .filter((i) => folderFilter === '全部' || i.folder === folderFilter)
      .filter((i) => {
        if (!needle) return true
        return (
          i.subject.toLowerCase().includes(needle) ||
          i.from.toLowerCase().includes(needle) ||
          i.body.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => b.at - a.at)
  }, [items, tab, folderFilter, q])

  const current = items.find((i) => i.id === sel) || list[0]
  const unread = items.filter((i) => !i.read && !i.archived).length
  const sampleCount = items.filter((i) => i.sample || i.subject.includes('【範例可刪】')).length

  function patch(id: string, partial: Partial<NL>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...partial, sample: false } : x)))
  }

  function addArticle(partial: Partial<NL>) {
    const subject = limitText((partial.subject || '').trim() || '無標題', SUBJECT_MAX)
    const n: NL = {
      id: uid('nl'),
      from: limitText((partial.from || '自訂').trim() || '自訂', FROM_MAX),
      subject,
      body: limitText((partial.body || '').trim(), BODY_MAX),
      folder: partial.folder && folders.includes(partial.folder) ? partial.folder : folders[0] || '其他',
      starred: false,
      archived: false,
      read: false,
      at: partial.at && Number.isFinite(partial.at) ? partial.at : Date.now(),
    }
    setItems((xs) => [n, ...xs])
    setSel(n.id)
    setTab('inbox')
    return n
  }

  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result || '')
        const name = file.name.toLowerCase()
        const rows =
          name.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')
            ? parseJsonImport(text)
            : parseMarkdownImport(text)
        if (!rows.length) throw new Error('沒有可匯入項目')
        const created = rows.map((r) => {
          const n: NL = {
            id: uid('nl'),
            from: limitText((r.from || '匯入').trim(), FROM_MAX),
            subject: limitText((r.subject || '無標題').trim(), SUBJECT_MAX),
            body: limitText((r.body || '').trim(), BODY_MAX),
            folder: r.folder && folders.includes(r.folder) ? r.folder : folders[0] || '其他',
            starred: false,
            archived: false,
            read: false,
            at: r.at && Number.isFinite(r.at) ? r.at : Date.now(),
          }
          return n
        })
        setItems((xs) => [...created, ...xs])
        setSel(created[0]!.id)
        setImportMsg(`已匯入 ${created.length} 篇`)
      } catch (e) {
        setImportMsg(`匯入失敗：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    reader.readAsText(file)
  }

  function exportJson() {
    const payload = items.map(({ id, from, subject, body, folder, at, starred, archived, read }) => ({
      id,
      from,
      subject,
      body,
      folder,
      at,
      starred,
      archived,
      read,
    }))
    downloadText('newsletter-archive.json', JSON.stringify(payload, null, 2), 'application/json')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" onClick={exportJson} disabled={!items.length}>
            匯出 JSON
          </button>
          <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            匯入 JSON／MD
          </button>
        </div>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportFile(f)
          e.target.value = ''
        }}
      />
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機電子報／文章歸檔：資料僅存此瀏覽器。可貼上標題＋內文，或匯入簡易 JSON／Markdown；非真實信箱同步。
        {sampleCount > 0 && ` 目前有 ${sampleCount} 則標示為「範例可刪」。`}
      </p>

      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          貼上新文章
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="field"
            style={{ width: 140 }}
            placeholder="來源／寄件者"
            maxLength={FROM_MAX}
            value={draftFrom}
            onChange={(e) => setDraftFrom(limitText(e.target.value, FROM_MAX))}
          />
          <input
            className={`field${!isNonEmpty(draftSubject) && draftSubject.length > 0 ? ' is-invalid' : ''}`}
            style={{ flex: 1, minWidth: 160 }}
            placeholder="標題"
            maxLength={SUBJECT_MAX}
            value={draftSubject}
            onChange={(e) => setDraftSubject(limitText(e.target.value, SUBJECT_MAX))}
          />
          <select className="field" style={{ width: 120 }} value={draftFolder} onChange={(e) => setDraftFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="field"
          rows={3}
          placeholder="內文／摘要…"
          maxLength={BODY_MAX}
          value={draftBody}
          onChange={(e) => setDraftBody(limitText(e.target.value, BODY_MAX))}
        />
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span className="muted mono" style={{ fontSize: 12 }}>
            {charCount(draftSubject)}/{SUBJECT_MAX} · {charCount(draftBody)}/{BODY_MAX}
          </span>
          <div className="row">
            {sampleCount > 0 && (
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setItems((xs) => xs.filter((x) => !x.sample && !x.subject.includes('【範例可刪】')))}
              >
                清除範例
              </button>
            )}
            <AddButton
              type="button"
              className="sm teal"
              disabled={!isNonEmpty(draftSubject)}
              onClick={() => {
                if (!isNonEmpty(draftSubject)) return
                addArticle({
                  from: draftFrom || '自訂',
                  subject: draftSubject,
                  body: draftBody,
                  folder: draftFolder || folders[0],
                })
                setDraftFrom('')
                setDraftSubject('')
                setDraftBody('')
                setImportMsg('已新增文章')
              }}
            >
              加入歸檔
            </AddButton>
          </div>
        </div>
        {importMsg && <p className="muted" style={{ margin: 0 }}>{importMsg}</p>}
      </div>

      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['inbox', '收件匣'],
            ['unread', `未讀 (${unread})`],
            ['star', '星號'],
            ['archive', '封存'],
          ] as [Folder, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" className={`btn sm ${tab === t ? 'accent' : 'ghost'}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
        <input
          className="field"
          style={{ flex: 1, minWidth: 160 }}
          placeholder="搜尋主旨／來源／內容…"
          maxLength={Q_MAX}
          value={q}
          onChange={(e) => setQ(limitText(e.target.value, Q_MAX))}
        />
        <span className="mono muted" style={{ fontSize: 12 }}>
          {charCount(q)}/{Q_MAX}
        </span>
      </div>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <span className="muted">資料夾</span>
        <button type="button" className={`btn sm ${folderFilter === '全部' ? 'accent' : 'ghost'}`} onClick={() => setFolderFilter('全部')}>
          全部
        </button>
        {folders.map((f) => (
          <button key={f} type="button" className={`btn sm ${folderFilter === f ? 'accent' : 'ghost'}`} onClick={() => setFolderFilter(f)}>
            {f}
          </button>
        ))}
        <input
          className="field"
          style={{ width: 120 }}
          placeholder="新資料夾"
          maxLength={FOLDER_MAX}
          value={newFolder}
          onChange={(e) => setNewFolder(limitText(e.target.value, FOLDER_MAX))}
        />
        <button
          type="button"
          className="btn sm ghost"
          disabled={!newFolder.trim() || folders.includes(newFolder.trim())}
          onClick={() => {
            if (!newFolder.trim() || folders.includes(newFolder.trim())) return
            setFolders((fs) => [...fs, newFolder.trim()])
            setNewFolder('')
          }}
        >
          加資料夾
        </button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <ul className="list">
            {list.map((i) => (
              <li
                key={i.id}
                className="list-item"
                style={{ cursor: 'pointer', opacity: i.read ? 0.7 : 1, fontWeight: i.read ? 400 : 600 }}
                onClick={() => {
                  setSel(i.id)
                  patch(i.id, { read: true })
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{i.from}</span>
                  <span className="tag">{i.sample || i.subject.includes('【範例可刪】') ? '範例可刪' : i.folder}</span>
                </div>
                <div>
                  {!i.read && <span className="tag">未讀</span>} {i.starred && '★ '}
                  {i.subject}
                </div>
              </li>
            ))}
            {list.length === 0 && <li className="muted">尚無文章 · 請貼上或匯入</li>}
          </ul>
        </div>
        <div className="panel stack">
          {current ? (
            <>
              {(current.sample || current.subject.includes('【範例可刪】')) && (
                <span className="tag" style={{ alignSelf: 'flex-start' }}>
                  範例可刪
                </span>
              )}
              <input
                className="field"
                value={current.subject}
                maxLength={SUBJECT_MAX}
                onChange={(e) => patch(current.id, { subject: limitText(e.target.value, SUBJECT_MAX) })}
              />
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input
                  className="field"
                  style={{ flex: 1, minWidth: 120 }}
                  value={current.from}
                  maxLength={FROM_MAX}
                  onChange={(e) => patch(current.id, { from: limitText(e.target.value, FROM_MAX) })}
                />
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {new Date(current.at).toLocaleString('zh-TW')}
                </span>
              </div>
              <select className="field" value={current.folder} onChange={(e) => patch(current.id, { folder: e.target.value })}>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <textarea
                className="field"
                rows={8}
                maxLength={BODY_MAX}
                value={current.body}
                onChange={(e) => patch(current.id, { body: limitText(e.target.value, BODY_MAX) })}
              />
              <div className="field-meta">
                <span className="field-hint">內文上限</span>
                <span>
                  {charCount(current.body)}/{BODY_MAX}
                </span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { starred: !current.starred })}>
                  {current.starred ? '取消星號' : '加星號'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { read: !current.read })}>
                  {current.read ? '標未讀' : '標已讀'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => patch(current.id, { archived: !current.archived })}>
                  {current.archived ? '移回收件匣' : '封存'}
                </button>
                <DeleteButton onClick={() => setItems((xs) => xs.filter((x) => x.id !== current.id))} label="刪除" />
              </div>
            </>
          ) : (
            <p className="muted">尚無文章</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
