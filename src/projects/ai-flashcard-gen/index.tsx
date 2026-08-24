import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('ai-flashcard-gen')!

type Card = { id: string; front: string; back: string }

function extractCards(notes: string): Card[] {
  const lines = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const cards: Card[] = []
  for (const line of lines) {
    if (line.includes('：') || line.includes(':')) {
      const [a, ...rest] = line.split(/[:：]/)
      const back = rest.join('：').trim()
      if (a && back) cards.push({ id: uid('c'), front: a.trim(), back })
      continue
    }
    if (line.startsWith('-') || line.startsWith('•')) {
      const body = line.replace(/^[-•]\s*/, '')
      const words = body.split(/\s+/)
      if (words.length >= 2) {
        cards.push({ id: uid('c'), front: words[0]!, back: words.slice(1).join(' ') })
      }
    }
  }
  if (cards.length === 0 && notes.trim()) {
    const sentences = notes.split(/[。！？.!?]/).map((s) => s.trim()).filter((s) => s.length > 6)
    sentences.slice(0, 8).forEach((s, i) => {
      cards.push({ id: uid('c'), front: `重點 ${i + 1}`, back: s })
    })
  }
  return cards
}

export default function Page() {
  const [notes, setNotes] = useLocalStorage(
    'lab:ai-flashcard-gen:notes',
    '光合作用：植物利用光能把二氧化碳與水轉成葡萄糖\n線粒體：細胞的能量工廠\n- DNA 遺傳物質\n- RNA 協助蛋白質合成',
  )
  const [cards, setCards] = useLocalStorage<Card[]>('lab:ai-flashcard-gen:cards', [])
  const [flip, setFlip] = useState<Record<string, boolean>>({})
  const [idx, setIdx] = useState(0)

  const current = cards[idx]

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">筆記（可用「詞：解釋」或條列）</label>
          <textarea className="field" rows={12} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button
            type="button"
            className="btn accent"
            onClick={() => {
              const c = extractCards(notes)
              setCards(c)
              setIdx(0)
              setFlip({})
            }}
          >
            產生閃卡（{notes.split('\n').filter(Boolean).length} 行）
          </button>
        </div>
        <div className="panel stack">
          <div className="muted">
            共 {cards.length} 張 · 第 {cards.length ? idx + 1 : 0} 張
          </div>
          {current ? (
            <>
              <button
                type="button"
                className="list-item"
                style={{ minHeight: 140, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setFlip((f) => ({ ...f, [current.id]: !f[current.id] }))}
              >
                <div className="tag">{flip[current.id] ? '背面' : '正面'}</div>
                <div style={{ fontSize: 18, marginTop: 8 }}>{flip[current.id] ? current.back : current.front}</div>
              </button>
              <div className="row">
                <button type="button" className="btn ghost" disabled={idx <= 0} onClick={() => setIdx((i) => i - 1)}>
                  上一張
                </button>
                <button type="button" className="btn ghost" disabled={idx >= cards.length - 1} onClick={() => setIdx((i) => i + 1)}>
                  下一張
                </button>
              </div>
            </>
          ) : (
            <p className="muted">產生後可點卡片翻面複習</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
