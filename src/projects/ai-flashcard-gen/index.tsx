import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-flashcard-gen')!

const NOTES_MAX = 12000
const DECK_NAME_MAX = 80

type Card = { id: string; front: string; back: string }
type Deck = { id: string; name: string; cards: Card[]; updatedAt: number; favorite?: boolean }

const NOTE_PRESETS: { label: string; name: string; notes: string }[] = [
  {
    label: '生物基礎',
    name: '生物基礎',
    notes:
      '光合作用：植物利用光能把二氧化碳與水轉成葡萄糖\n線粒體：細胞的能量工廠\nQ: DNA 是什麼？ A: 遺傳物質\n- RNA 協助蛋白質合成',
  },
  {
    label: '前端詞彙',
    name: '前端詞彙',
    notes:
      '閉包：函式可存取外層作用域變數\n事件冒泡：事件由子節點向上傳播\nQ: 什麼是虛擬 DOM？ A: 以 JS 物件模擬真實 DOM 的輕量結構\n- debounce 延遲觸發直到停止輸入一段時間',
  },
  {
    label: '歷史年表',
    name: '歷史年表',
    notes: '1911：辛亥革命\n1945：二戰結束\nQ: 法國大革命開始年份？ A: 1789\n- 文藝復興起源於義大利',
  },
]

function extractCards(notes: string): Card[] {
  const lines = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const cards: Card[] = []
  for (const line of lines) {
    const qa = line.match(/^(?:Q[:：]\s*)(.+?)(?:\s*[|/／]\s*|\s+A[:：]\s*)(.+)$/i)
    if (qa) {
      cards.push({ id: uid('c'), front: qa[1]!.trim(), back: qa[2]!.trim() })
      continue
    }
    if (line.includes('：') || line.includes(':')) {
      const [a, ...rest] = line.split(/[:：]/)
      const back = rest.join('：').trim()
      if (a && back) cards.push({ id: uid('c'), front: a.trim().replace(/^[-•*]\s*/, ''), back })
      continue
    }
    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      const body = line.replace(/^[-•*]\s*/, '')
      const words = body.split(/\s+/)
      if (words.length >= 2) cards.push({ id: uid('c'), front: words[0]!, back: words.slice(1).join(' ') })
    }
  }
  if (cards.length === 0 && notes.trim()) {
    const sentences = notes
      .split(/[。！？.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 6)
    sentences.slice(0, 12).forEach((s, i) => {
      cards.push({ id: uid('c'), front: `重點 ${i + 1}：這句在說什麼？`, back: s })
    })
  }
  return cards
}

export default function Page() {
  const [notes, setNotes] = useLocalStorage('lab:ai-flashcard-gen:notes', NOTE_PRESETS[0]!.notes)
  const [decks, setDecks] = useLocalStorage<Deck[]>('lab:ai-flashcard-gen:decks', [])
  const [deckName, setDeckName] = useState('生物基礎')
  const [activeId, setActiveId] = useLocalStorage('lab:ai-flashcard-gen:active', '')
  const [mode, setMode] = useState<'edit' | 'study'>('edit')
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useLocalStorage<Record<string, boolean>>('lab:ai-flashcard-gen:known', {})
  const [previewOnly, setPreviewOnly] = useState<Card[] | null>(null)

  const active = useMemo(() => decks.find((d) => d.id === activeId) || decks[0], [decks, activeId])
  const cards = previewOnly ?? active?.cards ?? []
  const current = cards[idx]
  const knownCount = cards.filter((c) => known[c.id]).length
  const noteChars = charCount(notes)
  const favDecks = decks.filter((d) => d.favorite)
  const canGenerate = isNonEmpty(notes)

  function generate(save: boolean) {
    if (!canGenerate) return
    const c = extractCards(limitText(notes, NOTES_MAX))
    if (!save) {
      setPreviewOnly(c)
      setIdx(0)
      setFlipped(false)
      return
    }
    const id = uid('deck')
    const deck: Deck = {
      id,
      name: limitText(deckName.trim() || '未命名牌組', DECK_NAME_MAX),
      cards: c,
      updatedAt: Date.now(),
    }
    setDecks((ds) => [deck, ...ds])
    setActiveId(id)
    setPreviewOnly(null)
    setIdx(0)
    setFlipped(false)
    setMode('edit')
  }

  function saveCurrentCards(next: Card[]) {
    if (!active || previewOnly) return
    setDecks((ds) => ds.map((d) => (d.id === active.id ? { ...d, cards: next, updatedAt: Date.now() } : d)))
  }

  function clearStudyStats() {
    if (!active) return
    setKnown((k) => {
      const next = { ...k }
      active.cards.forEach((c) => delete next[c.id])
      return next
    })
    setIdx(0)
    setFlipped(false)
  }

  function exportDeck(d: Deck) {
    downloadText(
      `${d.name}.txt`,
      d.cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'),
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          {active && !previewOnly && (
            <button type="button" className="btn ghost sm" onClick={() => exportDeck(active)}>
              匯出目前牌組
            </button>
          )}
          <button
            type="button"
            className="btn ghost sm"
            disabled={!decks.length}
            onClick={() => {
              setDecks([])
              setActiveId('')
              setKnown({})
              setPreviewOnly(null)
            }}
          >
            清空牌組
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn sm ${mode === 'edit' ? 'accent' : 'ghost'}`}
          onClick={() => {
            setMode('edit')
            setPreviewOnly(null)
          }}
        >
          編輯／產生
        </button>
        <button
          type="button"
          className={`btn sm ${mode === 'study' ? 'accent' : 'ghost'}`}
          onClick={() => {
            setPreviewOnly(null)
            setMode('study')
            setIdx(0)
            setFlipped(false)
          }}
          disabled={!active?.cards.length}
        >
          學習模式
        </button>
        {active && !previewOnly && (
          <span className="muted">
            目前：{active.name}（{active.cards.length} 張）
            {active.favorite ? ' ★' : ''}
          </span>
        )}
        {previewOnly && <span className="tag">預覽中（尚未存檔）</span>}
      </div>

      {mode === 'edit' && (
        <div className="grid-2">
          <div className="panel stack">
            <div className="label">筆記預設</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {NOTE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setNotes(p.notes)
                    setDeckName(p.name)
                    setPreviewOnly(null)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="label">牌組名稱</label>
            <input
              className="field"
              maxLength={DECK_NAME_MAX}
              value={deckName}
              onChange={(e) => setDeckName(limitText(e.target.value, DECK_NAME_MAX))}
            />
            <div className="field-meta">
              <span className="field-hint">存檔時顯示的名稱</span>
              <span>{charCount(deckName)}/{DECK_NAME_MAX}</span>
            </div>
            <div className="row">
              <label className="label">筆記（詞：解釋 / Q:… A:… / 條列）</label>
              <span className="mono muted">{noteChars}/{NOTES_MAX}</span>
            </div>
            <textarea
              className={cn('field', !canGenerate && 'is-invalid')}
              rows={12}
              maxLength={NOTES_MAX}
              value={notes}
              onChange={(e) => setNotes(limitText(e.target.value, NOTES_MAX))}
            />
            <div className="field-meta">
              <span className={!canGenerate ? 'warn' : undefined}>{canGenerate ? '可解析' : '請貼上筆記'}</span>
              <span className="field-hint">上限 {NOTES_MAX.toLocaleString()} 字</span>
            </div>
            {!canGenerate && <p className="field-error">筆記不可空白</p>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost" onClick={() => generate(false)} disabled={!canGenerate}>
                僅預覽解析
              </button>
              <button type="button" className="btn accent" onClick={() => generate(true)} disabled={!canGenerate}>
                解析並存成牌組
              </button>
            </div>
            <div className="row">
              <div className="label">已存牌組</div>
              {favDecks.length > 0 && <span className="muted">收藏 {favDecks.length}</span>}
            </div>
            {decks.length === 0 ? (
              <div className="list-item stack">
                <strong>尚無牌組</strong>
                <p className="muted" style={{ margin: 0 }}>
                  貼上筆記或選預設，按「解析並存成牌組」開始。
                </p>
              </div>
            ) : (
              <ul className="list">
                {decks.map((d) => (
                  <li key={d.id} className="list-item row" style={{ flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`btn sm ${active?.id === d.id && !previewOnly ? 'accent' : 'ghost'}`}
                      onClick={() => {
                        setActiveId(d.id)
                        setPreviewOnly(null)
                      }}
                    >
                      {d.favorite ? '★ ' : ''}
                      {d.name} ({d.cards.length})
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => setDecks((xs) => xs.map((x) => (x.id === d.id ? { ...x, favorite: !x.favorite } : x)))}
                    >
                      {d.favorite ? '取消收藏' : '收藏'}
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => exportDeck(d)}>
                      匯出
                    </button>
                    <button type="button" className="btn sm danger" onClick={() => setDecks((xs) => xs.filter((x) => x.id !== d.id))}>
                      刪
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel stack">
            <div className="row">
              <div className="label">卡片預覽</div>
              <span className="muted">{cards.length} 張</span>
            </div>
            {cards.length === 0 ? (
              <div className="list-item stack">
                <strong>還沒有卡片</strong>
                <p className="muted" style={{ margin: 0 }}>
                  支援「詞：解釋」、Q/A 行，或條列。無法解析時會依句子產生問答。
                </p>
              </div>
            ) : (
              <ul className="list" style={{ maxHeight: 420, overflow: 'auto' }}>
                {cards.map((c) => (
                  <li key={c.id} className="list-item stack" style={{ gap: 4 }}>
                    <strong>{c.front}</strong>
                    <span className="muted">{c.back}</span>
                    <div className="row">
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        {c.front.length + c.back.length} 字
                      </span>
                      {!previewOnly && (
                        <button type="button" className="btn sm danger" onClick={() => saveCurrentCards(cards.filter((x) => x.id !== c.id))}>
                          移除
                        </button>
                      )}
                      <button type="button" className="btn sm ghost" onClick={() => void copyText(`Q: ${c.front}\nA: ${c.back}`)}>
                        複製
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mode === 'study' && (
        <div className="panel stack" style={{ maxWidth: 520, margin: '0 auto' }}>
          {!current ? (
            <div className="list-item stack">
              <strong>沒有可學習的卡片</strong>
              <p className="muted" style={{ margin: 0 }}>
                回到編輯模式產生或選擇有卡片的牌組。
              </p>
            </div>
          ) : (
            <>
              <div className="row">
                <span className="muted">
                  {idx + 1}/{cards.length}
                </span>
                <span className="metric">
                  已會 {knownCount}/{cards.length}
                </span>
                <button type="button" className="btn sm ghost" onClick={clearStudyStats}>
                  清除進度
                </button>
              </div>
              <div className="progress">
                <div
                  style={{
                    width: `${cards.length ? ((idx + 1) / cards.length) * 100 : 0}%`,
                    height: 8,
                    borderRadius: 4,
                    background: '#3b82f6',
                  }}
                />
              </div>
              <button
                type="button"
                className="list-item"
                style={{ minHeight: 180, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setFlipped((f) => !f)}
              >
                <div className="tag">{flipped ? '答案' : '問題'}</div>
                <div style={{ fontSize: 20, marginTop: 12 }}>{flipped ? current.back : current.front}</div>
                <p className="muted">點擊翻面</p>
              </button>
              <div className="row">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={idx <= 0}
                  onClick={() => {
                    setIdx((i) => i - 1)
                    setFlipped(false)
                  }}
                >
                  上一張
                </button>
                <button
                  type="button"
                  className="btn teal"
                  onClick={() => {
                    setKnown((k) => ({ ...k, [current.id]: true }))
                    setFlipped(false)
                    setIdx((i) => Math.min(cards.length - 1, i + 1))
                  }}
                >
                  會了
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={idx >= cards.length - 1}
                  onClick={() => {
                    setIdx((i) => i + 1)
                    setFlipped(false)
                  }}
                >
                  下一張
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </ProjectShell>
  )
}
