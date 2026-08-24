import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('tic-tac-toe')!

type Cell = 'X' | 'O' | null
type Mode = 'pvp' | 'cpu'

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function findWinner(b: Cell[]) {
  for (const [a, c, d] of LINES) {
    if (b[a!] && b[a!] === b[c!] && b[a!] === b[d!]) return { winner: b[a!]!, line: [a!, c!, d!] }
  }
  return null
}

function cpuMove(board: Cell[]): number {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  for (const i of empty) {
    const t = board.slice()
    t[i] = 'O'
    if (findWinner(t)?.winner === 'O') return i
  }
  for (const i of empty) {
    const t = board.slice()
    t[i] = 'X'
    if (findWinner(t)?.winner === 'X') return i
  }
  if (empty.includes(4)) return 4
  return empty[Math.floor(Math.random() * empty.length)] ?? 0
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:tic-tac-toe:mode', 'cpu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)
  const [score, setScore] = useLocalStorage('lab:tic-tac-toe:score', { X: 0, O: 0, draw: 0 })

  const result = useMemo(() => findWinner(board), [board])
  const full = board.every(Boolean)
  const status = result
    ? `勝者：${result.winner}`
    : full
      ? '平手'
      : `輪到：${xIsNext ? 'X' : 'O'}`

  function finish(next: Cell[], winner: 'X' | 'O' | 'draw') {
    setBoard(next)
    setScore((s) => ({ ...s, [winner]: s[winner] + 1 }))
  }

  function play(i: number) {
    if (board[i] || result) return
    if (mode === 'cpu' && !xIsNext) return
    const next = board.slice()
    next[i] = xIsNext ? 'X' : 'O'
    const w = findWinner(next)
    if (w) {
      finish(next, w.winner)
      return
    }
    if (next.every(Boolean)) {
      finish(next, 'draw')
      return
    }
    setBoard(next)
    setXIsNext(!xIsNext)

    if (mode === 'cpu') {
      window.setTimeout(() => {
        setBoard((cur) => {
          if (findWinner(cur) || cur.every(Boolean)) return cur
          const move = cpuMove(cur)
          const n2 = cur.slice()
          n2[move] = 'O'
          const w2 = findWinner(n2)
          if (w2) {
            setScore((s) => ({ ...s, [w2.winner]: s[w2.winner] + 1 }))
            return n2
          }
          if (n2.every(Boolean)) {
            setScore((s) => ({ ...s, draw: s.draw + 1 }))
            return n2
          }
          setXIsNext(true)
          return n2
        })
      }, 280)
    }
  }

  function resetBoard() {
    setBoard(Array(9).fill(null))
    setXIsNext(true)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className={`btn sm ${mode === 'cpu' ? 'accent' : 'ghost'}`}
            onClick={() => {
              setMode('cpu')
              resetBoard()
            }}
          >
            對電腦
          </button>
          <button
            type="button"
            className={`btn sm ${mode === 'pvp' ? 'accent' : 'ghost'}`}
            onClick={() => {
              setMode('pvp')
              resetBoard()
            }}
          >
            雙人
          </button>
        </div>
        <p>{status}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {board.map((c, i) => {
            const win = result?.line.includes(i)
            return (
              <button
                key={i}
                type="button"
                className="btn ghost"
                style={{
                  height: 76,
                  fontSize: 28,
                  fontFamily: 'var(--font-display)',
                  background: win ? 'var(--accent-soft)' : undefined,
                }}
                onClick={() => play(i)}
              >
                {c}
              </button>
            )
          })}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="tag">X {score.X}</span>
          <span className="tag">O {score.O}</span>
          <span className="tag">平手 {score.draw}</span>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn accent" onClick={resetBoard}>
            再來一局
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setScore({ X: 0, O: 0, draw: 0 })}
          >
            重置分數
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
