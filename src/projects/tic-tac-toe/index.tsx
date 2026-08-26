import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, pick, uid } from '../../lib/utils'

const meta = getProject('tic-tac-toe')!

type Cell = 'X' | 'O' | null
type Mode = 'cpu' | '2p'
type Match = {
  id: string
  at: number
  mode: Mode
  winner: 'X' | 'O' | 'draw'
  moves: number
}

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

function getWinner(b: Cell[]): { winner: Cell | 'draw' | null; line: number[] | null } {
  for (const line of LINES) {
    const [a, b1, c] = line
    if (b[a!] && b[a!] === b[b1!] && b[a!] === b[c!]) return { winner: b[a!]!, line }
  }
  return { winner: b.every(Boolean) ? 'draw' : null, line: null }
}

function cpuMove(board: Cell[]): number {
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0)
  for (const i of empty) {
    const t = [...board]
    t[i!] = 'O'
    if (getWinner(t).winner === 'O') return i!
  }
  for (const i of empty) {
    const t = [...board]
    t[i!] = 'X'
    if (getWinner(t).winner === 'X') return i!
  }
  if (empty.includes(4)) return 4
  return pick(empty)
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:tic-tac-toe:mode', 'cpu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [score, setScore] = useLocalStorage('lab:tic-tac-toe:score', { X: 0, O: 0, draw: 0 })
  const [matches, setMatches] = useLocalStorage<Match[]>('lab:tic-tac-toe:matches', [])
  const [histFilter, setHistFilter] = useState<'全部' | 'X' | 'O' | 'draw'>('全部')
  const scored = useRef(false)
  const { winner, line } = getWinner(board)
  const moves = board.filter(Boolean).length

  useEffect(() => {
    if (mode !== 'cpu' || turn !== 'O' || winner) return
    const t = setTimeout(() => {
      const i = cpuMove(board)
      setBoard((b) => {
        const n = [...b]
        n[i] = 'O'
        return n
      })
      setTurn('X')
    }, 380)
    return () => clearTimeout(t)
  }, [mode, turn, board, winner])

  useEffect(() => {
    if (!winner || scored.current) return
    scored.current = true
    setScore((s) => ({
      ...s,
      ...(winner === 'draw' ? { draw: s.draw + 1 } : winner === 'X' ? { X: s.X + 1 } : { O: s.O + 1 }),
    }))
    const result: Match['winner'] = winner === 'draw' ? 'draw' : winner
    setMatches((m) =>
      [
        {
          id: uid('ttt'),
          at: Date.now(),
          mode,
          winner: result,
          moves: board.filter(Boolean).length,
        },
        ...m,
      ].slice(0, 40),
    )
  }, [winner, setScore, setMatches, mode, board])

  const filteredMatches = useMemo(() => {
    if (histFilter === '全部') return matches
    return matches.filter((m) => m.winner === histFilter)
  }, [matches, histFilter])

  const stats = useMemo(() => {
    const total = score.X + score.O + score.draw
    const winRate = total ? Math.round((score.X / total) * 100) : 0
    const avgMoves = matches.length
      ? Math.round(matches.reduce((s, m) => s + m.moves, 0) / matches.length)
      : 0
    return { total, winRate, avgMoves }
  }, [score, matches])

  function play(i: number) {
    if (board[i] || winner) return
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
    scored.current = false
  }

  function exportMatches() {
    const lines = [
      '時間,模式,勝者,步數',
      ...matches.map((m) =>
        [new Date(m.at).toISOString(), m.mode, m.winner, m.moves].join(','),
      ),
    ]
    downloadText('tic-tac-toe-history.csv', lines.join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={reset}>
            新局
          </button>
          <button type="button" className="btn sm ghost" disabled={!matches.length} onClick={exportMatches}>
            匯出戰績
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        本機對戰，無網路聯機
      </p>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">總場 {stats.total}</span>
        <span className="tag">X 勝率 {stats.winRate}%</span>
        <span className="tag">平均步數 {stats.avgMoves || '—'}</span>
        <span className="tag">本局 {moves} 步</span>
      </div>

      <div className="grid-2">
        <div className="panel stack" style={{ alignItems: 'center' }}>
          <div className="row" style={{ flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
            <button
              type="button"
              className={`btn sm ${mode === 'cpu' ? 'accent' : 'ghost'}`}
              onClick={() => {
                setMode('cpu')
                reset()
              }}
            >
              vs CPU
            </button>
            <button
              type="button"
              className={`btn sm ${mode === '2p' ? 'accent' : 'ghost'}`}
              onClick={() => {
                setMode('2p')
                reset()
              }}
            >
              雙人
            </button>
            <div className="metric" style={{ padding: '4px 12px' }}>
              X {score.X} · O {score.O} · 和 {score.draw}
            </div>
            <button type="button" className="btn sm ghost" onClick={reset}>
              新局
            </button>
            <button
              type="button"
              className="btn sm danger"
              onClick={() => {
                setScore({ X: 0, O: 0, draw: 0 })
                setMatches([])
              }}
            >
              重置分數
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gap: 8, margin: '12px auto' }}>
            {board.map((c, i) => {
              const win = line?.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  className="panel"
                  style={{
                    width: 88,
                    height: 88,
                    fontSize: 36,
                    fontWeight: 700,
                    cursor: c || winner ? 'default' : 'pointer',
                    background: win ? 'var(--amber-soft)' : undefined,
                    outline: win ? '2px solid var(--amber)' : undefined,
                  }}
                  onClick={() => play(i)}
                >
                  {c}
                </button>
              )
            })}
          </div>

          <p style={{ textAlign: 'center', margin: 0 }}>
            {winner === 'draw'
              ? '平手！'
              : winner
                ? `${winner} 獲勝！`
                : `輪到 ${turn}${mode === 'cpu' && turn === 'O' ? '（CPU）' : ''}`}
          </p>
        </div>

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>對局歷史</h3>
            <button type="button" className="btn sm ghost" disabled={!matches.length} onClick={() => setMatches([])}>
              清空
            </button>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['全部', 'X', 'O', 'draw'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn sm ${histFilter === f ? 'accent' : 'ghost'}`}
                onClick={() => setHistFilter(f)}
              >
                {f === '全部' ? '全部' : f === 'draw' ? '平手' : `${f} 勝`}
              </button>
            ))}
          </div>
          <ul className="list">
            {filteredMatches.slice(0, 16).map((m) => (
              <li key={m.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>
                    {m.winner === 'draw' ? '平手' : `${m.winner} 勝`}
                  </strong>
                  <span className="muted">
                    {' '}
                    · {m.mode === 'cpu' ? 'vs CPU' : '雙人'} · {m.moves} 步
                  </span>
                  <div className="muted mono" style={{ fontSize: 11 }}>
                    {new Date(m.at).toLocaleString('zh-TW')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => setMatches((xs) => xs.filter((x) => x.id !== m.id))}
                >
                  刪
                </button>
              </li>
            ))}
            {!filteredMatches.length && <p className="muted">完成一局後會自動記錄。</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
