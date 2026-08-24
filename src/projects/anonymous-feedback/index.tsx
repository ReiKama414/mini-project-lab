import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, charCount, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('anonymous-feedback')!

type Cat = '體驗' | '功能' | '文件' | '其他'
type Item = {
  id: string
  text: string
  mood: '😊' | '😐' | '😞'
  cat: Cat
  votes: number
  at: number
  reply: string
  adminNote: string
}

const MAX_ITEMS = 200
const MAX_TEXT = 1000
const MAX_BOARD = 40
const MAX_REPLY = 500

const CATS: Cat[] = ['體驗', '功能', '文件', '其他']

export default function Page() {
  const [items, setItems] = useLocalStorage<Item[]>('lab:anonymous-feedback', [
    {
      id: '1',
      text: '文件可以再清楚一點',
      mood: '😐',
      cat: '文件',
      votes: 3,
      at: Date.now() - 86400000,
      reply: '',
      adminNote: '待補 FAQ',
    },
    {
      id: '2',
      text: '新版 UI 很好用！',
      mood: '😊',
      cat: '體驗',
      votes: 8,
      at: Date.now() - 3600000,
      reply: '謝謝支持！',
      adminNote: '',
    },
    {
      id: '3',
      text: '希望有離線模式',
      mood: '😐',
      cat: '功能',
      votes: 5,
      at: Date.now() - 7200000,
      reply: '',
      adminNote: '',
    },
  ])
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Item['mood']>('😐')
  const [cat, setCat] = useState<Cat>('體驗')
  const [filter, setFilter] = useState<Cat | '全部'>('全部')
  const [boardName, setBoardName] = useLocalStorage('lab:anonymous-feedback:board', '產品回饋板')
  const [sort, setSort] = useState<'new' | 'votes'>('votes')
  const [editing, setEditing] = useState<string | null>(null)
  const textOk = isNonEmpty(text)
  const atLimit = items.length >= MAX_ITEMS
  const canSubmit = textOk && !atLimit

  // migrate legacy items missing reply/adminNote
  const normalized = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        reply: i.reply ?? '',
        adminNote: i.adminNote ?? '',
      })),
    [items],
  )

  const shown = useMemo(() => {
    const list = normalized.filter((i) => filter === '全部' || i.cat === filter)
    return [...list].sort((a, b) => (sort === 'votes' ? b.votes - a.votes : b.at - a.at))
  }, [normalized, filter, sort])

  const catCounts = useMemo(() => {
    const c: Record<Cat, number> = { 體驗: 0, 功能: 0, 文件: 0, 其他: 0 }
    normalized.forEach((i) => {
      c[i.cat]++
    })
    return c
  }, [normalized])

  function exportCsv() {
    const header = '分類,情緒,票數,內容,公開回覆,管理員備註,時間'
    const rows = normalized.map((i) =>
      [
        i.cat,
        i.mood,
        i.votes,
        `"${i.text.replace(/"/g, '""')}"`,
        `"${(i.reply || '').replace(/"/g, '""')}"`,
        `"${(i.adminNote || '').replace(/"/g, '""')}"`,
        new Date(i.at).toISOString(),
      ].join(','),
    )
    downloadText('feedback.csv', [header, ...rows].join('\n'), 'text/csv;charset=utf-8')
  }

  function patch(id: string, patch: Partial<Item>) {
    const next = { ...patch }
    if (next.reply != null) next.reply = limitText(next.reply, MAX_REPLY)
    if (next.adminNote != null) next.adminNote = limitText(next.adminNote, MAX_REPLY)
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, reply: x.reply ?? '', adminNote: x.adminNote ?? '', ...next } : x)))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" onClick={exportCsv}>
          匯出 CSV
        </button>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        {CATS.map((c) => (
          <div key={c} className="metric panel">
            {c} <strong>{catCounts[c]}</strong>
          </div>
        ))}
      </div>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="stack" style={{ gap: 0 }}>
          <input className="field" value={boardName} maxLength={MAX_BOARD} onChange={(e) => setBoardName(limitText(e.target.value, MAX_BOARD))} />
          <div className="field-meta"><span /><span>{charCount(boardName)} / {MAX_BOARD}</span></div>
        </div>
        <div className="stack" style={{ gap: 0 }}>
          <textarea
            className={`field${text.length > 0 && !textOk ? ' is-invalid' : ''}`}
            rows={3}
            placeholder="匿名留下想法…"
            value={text}
            maxLength={MAX_TEXT}
            onChange={(e) => setText(limitText(e.target.value, MAX_TEXT))}
          />
          <div className="field-meta">
            <span className={atLimit || (!textOk && text.length > 0) ? 'warn' : undefined}>
              {atLimit ? `已達上限 ${MAX_ITEMS} 則` : !textOk && text.length > 0 ? '請輸入回饋內容' : '\u00a0'}
            </span>
            <span>
              {charCount(text)} / {MAX_TEXT}
            </span>
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="muted">分類</span>
          {CATS.map((c) => (
            <button key={c} type="button" className={`btn sm ${cat === c ? 'accent' : 'ghost'}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(['😊', '😐', '😞'] as const).map((m) => (
            <button key={m} type="button" className={`btn sm ${mood === m ? 'accent' : 'ghost'}`} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
          <button
            type="button"
            className="btn accent"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return
              setItems((xs) => [
                {
                  id: uid('fb'),
                  text: limitText(text.trim(), MAX_TEXT),
                  mood,
                  cat,
                  votes: 0,
                  at: Date.now(),
                  reply: '',
                  adminNote: '',
                },
                ...xs,
              ])
              setText('')
            }}
          >
            匿名送出
          </button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {(['全部', ...CATS] as const).map((c) => (
          <button key={c} type="button" className={`btn sm ${filter === c ? 'accent' : 'ghost'}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
        <button type="button" className={`btn sm ${sort === 'votes' ? 'accent' : 'ghost'}`} onClick={() => setSort('votes')}>
          熱門
        </button>
        <button type="button" className={`btn sm ${sort === 'new' ? 'accent' : 'ghost'}`} onClick={() => setSort('new')}>
          最新
        </button>
      </div>
      <div className="grid-3">
        {shown.map((it) => (
          <div key={it.id} className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 22 }}>{it.mood}</span>
              <span className="tag">{it.cat}</span>
            </div>
            <p style={{ margin: 0 }}>{it.text}</p>
            <span className="muted mono">{new Date(it.at).toLocaleString('zh-TW')}</span>
            {it.reply && (
              <div className="metric" style={{ fontSize: 13 }}>
                <span className="muted">公開回覆</span>
                <div>{it.reply}</div>
              </div>
            )}
            {it.adminNote && editing !== it.id && (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                管理員備註：{it.adminNote}
              </p>
            )}
            {editing === it.id && (
              <div className="stack">
                <label className="stack">
                  <span className="label">公開回覆</span>
                  <textarea
                    className="field"
                    rows={2}
                    value={it.reply}
                    maxLength={MAX_REPLY} onChange={(e) => patch(it.id, { reply: limitText(e.target.value, MAX_REPLY) })}
                    placeholder="使用者看得到的回覆…"
                  />
                </label>
                <label className="stack">
                  <span className="label">管理員備註（內部）</span>
                  <textarea
                    className="field"
                    rows={2}
                    value={it.adminNote}
                    maxLength={MAX_REPLY} onChange={(e) => patch(it.id, { adminNote: limitText(e.target.value, MAX_REPLY) })}
                    placeholder="僅管理用…"
                  />
                </label>
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => patch(it.id, { votes: it.votes + 1 })}
              >
                ▲ {it.votes}
              </button>
              <button
                type="button"
                className="btn sm teal"
                onClick={() => setEditing((cur) => (cur === it.id ? null : it.id))}
              >
                {editing === it.id ? '收合' : '回覆／備註'}
              </button>
              <button type="button" className="btn sm danger" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                審核刪除
              </button>
            </div>
          </div>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">此分類尚無回饋</p>}
    </ProjectShell>
  )
}
