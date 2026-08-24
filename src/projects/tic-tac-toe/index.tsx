import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { pick } from '../../lib/utils'

const meta = getProject('tic-tac-toe')!

type Cell = 'X' | 'O' | null
type Mode = 'cpu' | '2p'

function winner(b: Cell[]): Cell | 'draw' | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]
  for (const [a, b1, c] of lines) {
    if (b[a!] && b[a!] === b[b1!] && b[a!] === b[c!]) return b[a!]!
  }
  return b.every(Boolean) ? 'draw' : null
}

function cpuMove(board: Cell[]): number {
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
  for (const i of empty) {
    const t = [...board]
    t[i!] = 'O'
    if (winner(t) === 'O') return i!
  }
  for (const i of empty) {
    const t = [...board]
    t[i!] = 'X'
    if (winner(t) === 'X') return i!
  }
  if (empty.includes(4)) return 4
  return pick(empty)
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:tic-tac-toe:mode', 'cpu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [score, setScore] = useLocalStorage('lab:tic-tac-toe:score', { X: 0, O: 0, draw: 0 })
  const w = winner(board)

  useEffect(() => {
    if (mode !== 'cpu' || turn !== 'O' || w) return
    const t = setTimeout(() => {
      const i = cpuMove(board)
      setBoard((b) => {
        const n = [...b]
        n[i] = 'O'
        return n
      })
      setTurn('X')
    }, 400)
    return () => clearTimeout(t)
  }, [mode, turn, board, w])

  useEffect(() => {
    if (!w) return
    setScore((s) => ({
      ...s,
      ...(w === 'draw' ? { draw: s.draw + 1 } : w === 'X' ? { X: s.X + 1 } : { O: s.O + 1 }),
    }))
  }, [w, setScore])

  function play(i: number) {
    if (board[i] || w) return
    if (mode === 'cpu' && turn !== 'X') return
    setBoard((b) => {
      const n = [...b]
      n[i] = turn
      return n
    })
    setTurn((t) => (t === 'X' ? 'O' : 'X'))
  }

  function reset() {
    setBoard(Array(9).fill(null))
    setTurn('X')
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn sm ${mode === 'cpu' ? 'accent' : 'ghost'}`} onClick={() => { setMode('cpu'); reset() }}>
          vs CPU
        </button>
        <button type="button" className={`btn sm ${mode === '2p' ? 'accent' : 'ghost'}`} onClick={() => { setMode('2p'); reset() }}>
          雙人
        </button>
        <span className="muted">
          分數 X {score.X} · O {score.O} · 和 {score.draw}
        </span>
        <button type="button" className="btn sm ghost" onClick={reset}>
          新局
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gap: 8, margin: '0 auto', width: 'fit-content' }}>
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            className="panel"
            style={{ width: 88, height: 88, fontSize: 36, fontWeight: 700, cursor: c || w ? 'default' : 'pointer' }}
            onClick={() => play(i)}
          >
            {c}
          </button>
        ))}
      </div>
      <p style={{ textAlign: 'center', marginTop: 12 }}>
        {w === 'draw' ? '平手！' : w ? `${w} 獲勝！` : `輪到 ${turn}`}
      </p>
    </ProjectShell>
  )
}
