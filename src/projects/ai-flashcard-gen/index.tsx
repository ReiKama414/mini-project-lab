import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText } from '../../lib/utils'

const meta = getProject('ai-flashcard-gen')!

type Card = { id: string; front: string; back: string }
type Deck = { id: string; name: string; cards: Card[]; updatedAt: number }

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
  const [notes, setNotes] = useLocalStorage(
    'lab:ai-flashcard-gen:notes',
    '光合作用：植物利用光能把二氧化碳與水轉成葡萄糖\n線粒體：細胞的能量工廠\nQ: DNA 是什麼？ A: 遺傳物質\n- RNA 協助蛋白質合成',
  )
  const [decks, setDecks] = useLocalStorage<Deck[]>('lab:ai-flashcard-gen:decks', [])
  const [deckName, setDeckName] = useState('生物基礎')
  const [activeId, setActiveId] = useLocalStorage('lab:ai-flashcard-gen:active', '')
  const [mode, setMode] = useState<'edit' | 'study'>('edit')
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Record<string, boolean>>({})

  const active = useMemo(() => decks.find((d) => d.id === activeId) || decks[0], [decks, activeId])
  const cards = active?.cards || []
  const current = cards[idx]
  const knownCount = cards.filter((c) => known[c.id]).length

  function generate() {
    const c = extractCards(notes)
    const id = uid('deck')
    const deck: Deck = { id, name: deckName.trim() || '未命名牌組', cards: c, updatedAt: Date.now() }
    setDecks((ds) => [deck, ...ds])
    setActiveId(id)
    setIdx(0)
    setFlipped(false)
    setKnown({})
    setMode('edit')
  }

  function saveCurrentCards(next: Card[]) {
    if (!active) return
    setDecks((ds) => ds.map((d) => (d.id === active.id ? { ...d, cards: next, updatedAt: Date.now() } : d)))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn sm ${mode === 'edit' ? 'accent' : 'ghost'}`} onClick={() => setMode('edit')}>
          編輯／產生
        </button>
        <button
          type="button"
          className={`btn sm ${mode === 'study' ? 'accent' : 'ghost'}`}
          onClick={() => {
            setMode('study')
            setIdx(0)
            setFlipped(false)
          }}
          disabled={!cards.length}
        >
          學習模式
        </button>
        {active && (
          <span className="muted">
            目前：{active.name}（{cards.length} 張）
          </span>
        )}
      </div>

      {mode === 'edit' && (
        <div className="grid-2">
          <div className="panel stack">
            <label className="label">牌組名稱</label>
            <input className="field" value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            <label className="label">筆記（詞：解釋 / Q:… A:… / 條列）</label>
            <textarea className="field" rows={12} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className="btn accent" onClick={generate}>
              解析並存成牌組
            </button>
            <div className="label">已存牌組</div>
            <ul className="list">
              {decks.map((d) => (
                <li key={d.id} className="list-item row">
                  <button type="button" className={`btn sm ${active?.id === d.id ? 'accent' : 'ghost'}`} onClick={() => setActiveId(d.id)}>
                    {d.name} ({d.cards.length})
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() =>
                      downloadText(
                        `${d.name}.txt`,
                        d.cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'),
                      )
                    }
                  >
                    匯出
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => setDecks((xs) => xs.filter((x) => x.id !== d.id))}>
                    刪
                  </button>
                </li>
              ))}
              {decks.length === 0 && <li className="muted">尚無牌組</li>}
            </ul>
          </div>
          <div className="panel stack">
            <div className="label">卡片預覽</div>
            {cards.length === 0 && <p className="muted">產生後顯示 Q/A</p>}
            <ul className="list" style={{ maxHeight: 420, overflow: 'auto' }}>
              {cards.map((c) => (
                <li key={c.id} className="list-item stack" style={{ gap: 4 }}>
                  <strong>{c.front}</strong>
                  <span className="muted">{c.back}</span>
                  <button type="button" className="btn sm danger" onClick={() => saveCurrentCards(cards.filter((x) => x.id !== c.id))}>
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {mode === 'study' && current && (
        <div className="panel stack" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="row">
            <span className="muted">
              {idx + 1}/{cards.length}
            </span>
            <span className="metric">
              已會 {knownCount}/{cards.length}
            </span>
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
        </div>
      )}
    </ProjectShell>
  )
}
