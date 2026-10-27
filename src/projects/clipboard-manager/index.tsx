import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText, downloadText, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtRowItem,
  FtRowList,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

const meta = getProject('clipboard-manager')!

const TEXT_MAX = 5000
const SEARCH_MAX = 80

type Category = '一般' | '程式碼' | '連結' | '備註'
type Clip = {
  id: string
  text: string
  category: Category
  pinned: boolean
  createdAt: number
}

const CATS: Category[] = ['一般', '程式碼', '連結', '備註']

function guessCategory(text: string): Category {
  if (/^https?:\/\//i.test(text.trim())) return '連結'
  if (/[{};=<>]|function |const |let |import /.test(text)) return '程式碼'
  return '一般'
}

function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATS as string[]).includes(v)
}

function parseClips(raw: unknown): Clip[] | null {
  if (!Array.isArray(raw)) return null
  const out: Clip[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const text = typeof r.text === 'string' ? limitText(r.text, TEXT_MAX) : ''
    if (!text) continue
    out.push({
      id: typeof r.id === 'string' ? r.id : uid('clip'),
      text,
      category: isCategory(r.category) ? r.category : guessCategory(text),
      pinned: Boolean(r.pinned),
      createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
    })
  }
  return out.slice(0, 80)
}

export default function Page() {
  const [items, setItems] = useLocalStorage<Clip[]>('lab:clipboard-manager', [])
  const [text, setText] = useState('')
  const [category, setCategory] = useState<Category>('一般')
  const [filter, setFilter] = useState<'全部' | Category>('全部')
  const [q, setQ] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const [error, setError] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const canAdd = isNonEmpty(text)

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items
      .filter((c) => (filter === '全部' ? true : c.category === filter))
      .filter((c) => (!onlyPinned ? true : c.pinned))
      .filter((c) => !s || c.text.toLowerCase().includes(s))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.createdAt - a.createdAt
      })
  }, [items, filter, q, onlyPinned])

  function add(content: string, cat?: Category) {
    const t = limitText(content.trim(), TEXT_MAX)
    if (!t) {
      setError('請輸入內容')
      return
    }
    setError('')
    const next: Clip = {
      id: uid('clip'),
      text: t,
      category: cat || category || guessCategory(t),
      pinned: false,
      createdAt: Date.now(),
    }
    setItems([next, ...items].slice(0, 80))
    setText('')
  }

  async function pasteFromSystem() {
    try {
      const t = await navigator.clipboard.readText()
      add(t, guessCategory(t))
    } catch {
      add(text)
    }
  }

  function togglePin(id: string) {
    setItems(items.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
  }

  function exportJson() {
    downloadText('clipboard.json', JSON.stringify(items, null, 2), 'application/json;charset=utf-8')
  }

  async function importJson(file: File | null) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const clips = parseClips(parsed)
      if (!clips) {
        setImportMsg('JSON 格式無效，需為剪貼陣列')
        return
      }
      setItems(clips)
      setImportMsg(`已匯入 ${clips.length} 筆`)
    } catch {
      setImportMsg('讀取或解析失敗')
    }
  }

  const CLIP_SAMPLES = ['https://example.com', 'npm install', 'TODO: 待辦事項']

  return (
    <FeatureLayout
      meta={meta}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" onClick={exportJson} disabled={!items.length}>
            匯出 JSON
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => importRef.current?.click()}>
            匯入 JSON
          </ActionButton>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importJson(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <ActionButton
            className="btn sm ghost"
            disabled={!items.length}
            onClick={() => {
              if (window.confirm('確定清除全部剪貼紀錄？')) setItems([])
            }}
          >
            全部清除
          </ActionButton>
        </div>
      }
      toolbar={
        <>
          <textarea
            className={`field${!canAdd && error ? ' is-invalid' : ''}`}
            rows={3}
            placeholder="手動加入剪貼內容…"
            value={text}
            maxLength={TEXT_MAX}
            onChange={(e) => {
              setText(limitText(e.target.value, TEXT_MAX))
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canAdd) add(text)
            }}
          />
          <div className="field-meta">
            <span>{charCount(text)} / {TEXT_MAX}</span>
            <span className="muted">Ctrl/⌘ + Enter 快速加入</span>
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="row">
            <select
              className="field"
              style={{ maxWidth: 140 }}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ActionButton type="button" className="btn accent" onClick={() => add(text)} disabled={!canAdd}>
              加入
            </ActionButton>
            <ActionButton type="button" className="btn teal" onClick={pasteFromSystem}>
              讀取系統剪貼簿
            </ActionButton>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {CLIP_SAMPLES.map((s) => (
              <button key={s} type="button" className="btn sm ghost" onClick={() => add(s, guessCategory(s))}>
                {s.slice(0, 24)}
                {s.length > 24 ? '…' : ''}
              </button>
            ))}
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['全部', ...CATS] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn sm ${filter === f ? 'accent' : 'ghost'}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <button
              type="button"
              className={`btn sm ${onlyPinned ? 'teal' : 'ghost'}`}
              onClick={() => setOnlyPinned(!onlyPinned)}
            >
              僅釘選
            </button>
          </div>
          <div className="field-wrap">
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋…"
              value={q}
              maxLength={SEARCH_MAX}
              onChange={(e) => setQ(limitText(e.target.value, SEARCH_MAX))}
            />
            <div className="field-meta">
              <span>搜尋 {charCount(q)} / {SEARCH_MAX}</span>
            </div>
          </div>
          {importMsg && <p className="muted" style={{ fontSize: 13 }}>{importMsg}</p>}
        </>
      }
      infoItems={[
        { label: '儲存', value: '本機 localStorage，最多 80 筆' },
        { label: '單筆上限', value: `${TEXT_MAX.toLocaleString()} 字元` },
        { label: '分類', value: '一般、程式碼、連結、備註（可自動推測）' },
        { label: '系統剪貼簿', value: '需瀏覽器權限，HTTPS 或 localhost' },
      ]}
      faq={[
        ftPrivacyLocal,
        {
          title: '讀取剪貼簿失敗',
          body: '若未授權或環境不支援，請改用手動貼上後按「加入」。',
        },
        {
          title: '匯入格式',
          body: 'JSON 需為含 text 欄位的物件陣列；無效列會略過。',
        },
      ]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="📋"
          title={`${items.length} 筆剪貼`}
          subtitle={
            filter !== '全部' || onlyPinned || q.trim()
              ? `篩選「${filter}」· 顯示 ${visible.length} 筆`
              : `本機最多 80 筆 · ${items.filter((c) => c.pinned).length} 筆已釘選`
          }
        />
        <FtMetricGrid>
          <FtMetric label="總筆數" value={`${items.length} / 80`} />
          <FtMetric label="顯示中" value={visible.length} />
          <FtMetric label="釘選" value={items.filter((c) => c.pinned).length} />
          <FtMetric label="分類篩選" value={filter} />
        </FtMetricGrid>
        <FtSection title="歷史紀錄">
          <FtRowList>
            {visible.map((c) => (
              <FtRowItem key={c.id}>
                <div className="stack" style={{ flex: 1, gap: 6, minWidth: 0 }}>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {c.pinned && <span className="tag">釘選</span>}
                    <span className="tag">{c.category}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {new Date(c.createdAt).toLocaleString('zh-TW')}
                    </span>
                  </div>
                  <span
                    className={c.category === '程式碼' ? 'mono' : undefined}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {c.text}
                  </span>
                </div>
                <div className="row">
                  <ActionButton type="button" className="btn sm ghost" onClick={() => togglePin(c.id)}>
                    {c.pinned ? '取消釘選' : '釘選'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm accent"
                    onClick={() => copyText(c.text)}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton onClick={() => setItems(items.filter((x) => x.id !== c.id))} label="刪除" />
                </div>
              </FtRowItem>
            ))}
          </FtRowList>
          {!visible.length && <p className="muted">尚無符合的紀錄</p>}
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
