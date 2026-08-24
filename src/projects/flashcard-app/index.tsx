import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, uid } from '../../lib/utils'

const meta = getProject('flashcard-app')!

type Card = {
  id: string
  front: string
  back: string
  know: number
  again: number
}

type Deck = {
  id: string
  name: string
  cards: Card[]
}

const MAX_DECKS = 50
const MAX_CARDS = 200
const MAX_NAME = 40
const MAX_SIDE = 500

const DEFAULT_DECKS: Deck[] = [
  {
    id: 'deck_default',
    name: '基礎英文',
    cards: [
      { id: '1', front: 'Hello', back: '你好', know: 0, again: 0 },
      { id: '2', front: 'Thank you', back: '謝謝', know: 0, again: 0 },
      { id: '3', front: 'Good morning', back: '早安', know: 0, again: 0 },
    ],
  },
]

function normalizeDecks(raw: unknown): Deck[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_DECKS
  if ('cards' in (raw[0] as object)) {
    return (raw as Deck[]).map((d) => ({
      ...d,
      cards: (d.cards ?? []).map((c) => ({
        ...c,
        know: c.know ?? 0,
        again: c.again ?? 0,
      })),
    }))
  }
  // 舊版：直接存 Card[]
  const cards = (raw as Partial<Card>[]).map((c, i) => ({
    id: c.id ?? `legacy_${i}`,
    front: c.front ?? '',
    back: c.back ?? '',
    know: c.know ?? 0,
    again: c.again ?? 0,
  }))
  return [{ id: 'deck_migrated', name: '我的牌組', cards }]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export default function Page() {
  const [stored, setStored] = useLocalStorage<unknown>('lab:flashcard-app', DEFAULT_DECKS)
  const decks = normalizeDecks(stored)
  const setDecks = (next: Deck[] | ((prev: Deck[]) => Deck[])) => {
    setStored(typeof next === 'function' ? next(decks) : next)
  }
  const [deckId, setDeckId] = useState(() => decks[0]?.id ?? '')
  const [order, setOrder] = useState<string[]>([])
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState<'study' | 'manage'>('study')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')

  const deck = decks.find((d) => d.id === deckId) ?? decks[0]
  const activeDeckId = deck?.id ?? ''

  const studyIds = useMemo(() => {
    if (!deck) return []
    if (order.length && order.every((id) => deck.cards.some((c) => c.id === id))) return order
    return deck.cards.map((c) => c.id)
  }, [deck, order])

  const card = deck?.cards.find((c) => c.id === studyIds[pos]) ?? null

  const stats = useMemo(() => {
    if (!deck) return { know: 0, again: 0 }
    return {
      know: deck.cards.reduce((s, c) => s + c.know, 0),
      again: deck.cards.reduce((s, c) => s + c.again, 0),
    }
  }, [deck])

  function ensureOrder(d: Deck, forceShuffle = false) {
    const ids = forceShuffle ? shuffle(d.cards.map((c) => c.id)) : d.cards.map((c) => c.id)
    setOrder(ids)
    setPos(0)
    setFlipped(false)
  }

  function selectDeck(id: string) {
    setDeckId(id)
    const d = decks.find((x) => x.id === id)
    if (d) ensureOrder(d)
  }

  function updateDeck(id: string, cards: Card[]) {
    setDecks(decks.map((d) => (d.id === id ? { ...d, cards } : d)))
  }

  function addDeck() {
    if (!isNonEmpty(newDeckName) || decks.length >= MAX_DECKS) return
    const d: Deck = { id: uid('deck'), name: limitText(newDeckName.trim(), MAX_NAME), cards: [] }
    setDecks([...decks, d])
    setNewDeckName('')
    selectDeck(d.id)
  }

  function saveCard() {
    if (!deck || !isNonEmpty(front) || !isNonEmpty(back)) return
    if (!editingId && deck.cards.length >= MAX_CARDS) return
    if (editingId) {
      updateDeck(
        deck.id,
        deck.cards.map((c) =>
          c.id === editingId
            ? { ...c, front: limitText(front.trim(), MAX_SIDE), back: limitText(back.trim(), MAX_SIDE) }
            : c,
        ),
      )
      setEditingId(null)
    } else {
      const c: Card = {
        id: uid('fc'),
        front: limitText(front.trim(), MAX_SIDE),
        back: limitText(back.trim(), MAX_SIDE),
        know: 0,
        again: 0,
      }
      const next = [...deck.cards, c]
      updateDeck(deck.id, next)
      setOrder([...studyIds, c.id])
    }
    setFront('')
    setBack('')
  }

  const deckNameOk = isNonEmpty(newDeckName)
  const frontOk = isNonEmpty(front)
  const backOk = isNonEmpty(back)
  const cardsAtLimit = !editingId && (deck?.cards.length ?? 0) >= MAX_CARDS
  const canSaveCard = frontOk && backOk && !cardsAtLimit
  const canAddDeck = deckNameOk && decks.length < MAX_DECKS

  function startEdit(c: Card) {
    setEditingId(c.id)
    setFront(c.front)
    setBack(c.back)
    setMode('manage')
  }

  function deleteCard(id: string) {
    if (!deck) return
    const next = deck.cards.filter((c) => c.id !== id)
    updateDeck(deck.id, next)
    const ids = studyIds.filter((x) => x !== id)
    setOrder(ids)
    setPos(0)
    setFlipped(false)
    if (editingId === id) {
      setEditingId(null)
      setFront('')
      setBack('')
    }
  }

  function score(kind: 'know' | 'again') {
    if (!deck || !card) return
    updateDeck(
      deck.id,
      deck.cards.map((c) =>
        c.id === card.id
          ? { ...c, know: kind === 'know' ? c.know + 1 : c.know, again: kind === 'again' ? c.again + 1 : c.again }
          : c,
      ),
    )
    setFlipped(false)
    if (studyIds.length) setPos((p) => (p + 1) % studyIds.length)
  }

  function go(delta: number) {
    if (!studyIds.length) return
    setFlipped(false)
    setPos((p) => (p + delta + studyIds.length) % studyIds.length)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <select
            className="field"
            style={{ maxWidth: 220 }}
            value={activeDeckId}
            onChange={(e) => selectDeck(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}（{d.cards.length}）
              </option>
            ))}
          </select>
          <div className="stack" style={{ flex: 1, minWidth: 100, gap: 0 }}>
            <input
              className={`field${newDeckName.length > 0 && !deckNameOk ? ' is-invalid' : ''}`}
              style={{ width: '100%' }}
              placeholder="新牌組名稱…"
              value={newDeckName}
              maxLength={MAX_NAME}
              onChange={(e) => setNewDeckName(limitText(e.target.value, MAX_NAME))}
            />
            <div className="field-meta">
              <span className={decks.length >= MAX_DECKS ? 'warn' : undefined}>
                {decks.length >= MAX_DECKS ? `牌組上限 ${MAX_DECKS}` : '\u00a0'}
              </span>
              <span>
                {charCount(newDeckName)} / {MAX_NAME}
              </span>
            </div>
          </div>
          <button className="btn sm teal" onClick={addDeck} disabled={!canAddDeck}>
            新增牌組
          </button>
          <button
            className={`btn sm ${mode === 'study' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('study')}
          >
            複習
          </button>
          <button
            className={`btn sm ${mode === 'manage' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('manage')}
          >
            管理卡片
          </button>
        </div>
        <div className="row">
          <span className="tag">認識 {stats.know}</span>
          <span className="tag" style={{ background: 'var(--rose-soft)', color: '#9a1f45' }}>
            再練 {stats.again}
          </span>
          {deck && deck.cards.length > 0 && (
            <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => ensureOrder(deck, true)}>
              洗牌
            </button>
          )}
        </div>
      </div>

      {mode === 'study' ? (
        <div className="panel stack">
          {card ? (
            <>
              <div
                className="metric"
                style={{
                  minHeight: 180,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: 16,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  background: flipped ? 'var(--teal-soft)' : '#fff',
                }}
                onClick={() => setFlipped((f) => !f)}
              >
                {flipped ? card.back : card.front}
              </div>
              <p className="muted" style={{ textAlign: 'center' }}>
                點擊翻面 · {pos + 1}/{studyIds.length} · 此卡 認識 {card.know} / 再練 {card.again}
              </p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn ghost" onClick={() => go(-1)}>
                  上一張
                </button>
                <button className="btn danger" onClick={() => score('again')}>
                  再練一次
                </button>
                <button className="btn teal" onClick={() => score('know')}>
                  認識
                </button>
                <button className="btn ghost" onClick={() => go(1)}>
                  下一張
                </button>
              </div>
            </>
          ) : (
            <p className="muted">此牌組尚無卡片，切換到「管理卡片」新增</p>
          )}
        </div>
      ) : (
        <div className="panel stack">
          <div className="grid-2">
            <div className="stack" style={{ gap: 0 }}>
              <input
                className={`field${front.length > 0 && !frontOk ? ' is-invalid' : ''}`}
                placeholder="正面"
                value={front}
                maxLength={MAX_SIDE}
                onChange={(e) => setFront(limitText(e.target.value, MAX_SIDE))}
              />
              <div className="field-meta">
                <span className={!frontOk && front.length > 0 ? 'warn' : undefined}>
                  {!frontOk && front.length > 0 ? '請輸入正面' : '\u00a0'}
                </span>
                <span>
                  {charCount(front)} / {MAX_SIDE}
                </span>
              </div>
            </div>
            <div className="stack" style={{ gap: 0 }}>
              <input
                className={`field${back.length > 0 && !backOk ? ' is-invalid' : ''}`}
                placeholder="背面"
                value={back}
                maxLength={MAX_SIDE}
                onChange={(e) => setBack(limitText(e.target.value, MAX_SIDE))}
              />
              <div className="field-meta">
                <span className={!backOk && back.length > 0 ? 'warn' : undefined}>
                  {!backOk && back.length > 0 ? '請輸入背面' : '\u00a0'}
                </span>
                <span>
                  {charCount(back)} / {MAX_SIDE}
                </span>
              </div>
            </div>
          </div>
          <div className="row">
            <button className="btn accent" onClick={saveCard} disabled={!canSaveCard}>
              {editingId ? '儲存修改' : '新增卡片'}
            </button>
            {cardsAtLimit && <p className="field-error">此牌組已達 {MAX_CARDS} 張上限</p>}
            {editingId && (
              <button
                className="btn ghost"
                onClick={() => {
                  setEditingId(null)
                  setFront('')
                  setBack('')
                }}
              >
                取消編輯
              </button>
            )}
            {deck && decks.length > 1 && (
              <button
                className="btn ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  const next = decks.filter((d) => d.id !== deck.id)
                  setDecks(next)
                  selectDeck(next[0]!.id)
                }}
              >
                刪除牌組
              </button>
            )}
          </div>
          <ul className="list">
            {(deck?.cards ?? []).map((c) => (
              <li key={c.id} className="list-item">
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{c.front}</strong>
                  <span className="muted">{c.back}</span>
                </div>
                <span className="tag">
                  ✓{c.know} / ✗{c.again}
                </span>
                <button className="btn sm ghost" onClick={() => startEdit(c)}>
                  編輯
                </button>
                <button className="btn sm ghost" onClick={() => deleteCard(c.id)}>
                  刪
                </button>
              </li>
            ))}
            {!deck?.cards.length && <p className="muted">尚無卡片</p>}
          </ul>
        </div>
      )}
    </ProjectShell>
  )
}
