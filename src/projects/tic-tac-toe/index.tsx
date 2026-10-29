import { PortfolioLayout } from '../../components/PortfolioLayout'
import { FtSection } from '../../components/FeatureToolUI'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, pick, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

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

function statusText(
  winner: Cell | 'draw' | null,
  turn: 'X' | 'O',
  mode: Mode,
  cpuThinking: boolean,
): string {
  if (winner === 'draw') return '平手'
  if (winner === 'X') return 'X 獲勝'
  if (winner === 'O') return mode === 'cpu' ? '電腦（O）獲勝' : 'O 獲勝'
  if (mode === 'cpu' && turn === 'O') {
    return cpuThinking ? '電腦思考中…' : '輪到 O（電腦）'
  }
  return `輪到 ${turn}`
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:tic-tac-toe:mode', 'cpu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [cpuThinking, setCpuThinking] = useState(false)
  const [score, setScore] = useLocalStorage('lab:tic-tac-toe:score', { X: 0, O: 0, draw: 0 })
  const [matches, setMatches] = useLocalStorage<Match[]>('lab:tic-tac-toe:matches', [])
  const [histFilter, setHistFilter] = useState<'全部' | 'X' | 'O' | 'draw'>('全部')
  const scored = useRef(false)
  const { winner, line } = getWinner(board)
  const moves = board.filter(Boolean).length

  useEffect(() => {
    if (mode !== 'cpu' || turn !== 'O' || winner) {
      setCpuThinking(false)
      return
    }
    setCpuThinking(true)
    const t = setTimeout(() => {
      const i = cpuMove(board)
      setBoard((b) => {
        const n = [...b]
        n[i] = 'O'
        return n
      })
      setTurn('X')
      setCpuThinking(false)
    }, 380)
    return () => {
      clearTimeout(t)
      setCpuThinking(false)
    }
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
    if (board[i] || winner || cpuThinking) return
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
    setCpuThinking(false)
  }

  function clearAllStats() {
    if (!window.confirm('重置分數與對局歷史？')) return
    setScore({ X: 0, O: 0, draw: 0 })
    setMatches([])
    reset()
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

  const modeLabel = mode === 'cpu' ? '人機（你是 X）' : '雙人同機'

  return (
    <PortfolioLayout
      slug="tic-tac-toe"
      heroSubtitle="同機對戰或簡易人機；戰績存本機"
      footerHint="人機模式：你下 X，電腦下 O · 歷史最多 40 局 · 詳見頁底「更多資訊」"
      extraInfo={[
        { label: '本局', value: statusText(winner, turn, mode, cpuThinking) },
        { label: '累積場次', value: `${stats.total} 局` },
      ]}
      metrics={[
        { label: '模式', value: modeLabel },
        { label: '本局步數', value: moves },
        { label: 'X 勝率', value: stats.total ? `${stats.winRate}%` : '—' },
        { label: '比分', value: `${score.X} / ${score.O} / ${score.draw}` },
        { label: '平均步數', value: stats.avgMoves || '—' },
      ]}
      actions={
        <div className="row">
          <button type="button" className="btn sm accent" onClick={reset}>
            新局
          </button>
          <ActionButton className="btn sm ghost" disabled={!matches.length} onClick={exportMatches}>
            匯出 CSV
          </ActionButton>
        </div>
      }
    >
      <div className="ttt-layout">
        <FtSection title="棋盤" hint="點空格落子；人機模式下僅 X 可點。">
          <div className="panel ttt-game">
            <div className="ttt-mode-bar">
              <div className="ttt-mode-group">
                <span className="ttt-mode-label">模式</span>
                <button
                  type="button"
                  className={`btn sm ${mode === 'cpu' ? 'accent' : 'ghost'}`}
                  onClick={() => {
                    setMode('cpu')
                    reset()
                  }}
                >
                  人機
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
              </div>
              <div className="ttt-score-chip" aria-label="累積比分">
                <span>X {score.X}</span>
                <span className="muted">·</span>
                <span>O {score.O}</span>
                <span className="muted">·</span>
                <span>和 {score.draw}</span>
              </div>
              <div className="ttt-mode-actions">
                <button type="button" className="btn sm ghost" onClick={reset}>
                  新局
                </button>
                <button type="button" className="btn sm danger" onClick={clearAllStats}>
                  重置戰績
                </button>
              </div>
            </div>

            <div
              className="ttt-board"
              role="grid"
              aria-label="井字棋棋盤"
              aria-busy={cpuThinking}
            >
              {board.map((c, i) => {
                const win = line?.includes(i)
                const disabled =
                  Boolean(c) || Boolean(winner) || cpuThinking || (mode === 'cpu' && turn !== 'X')
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    aria-label={c ? `第 ${i + 1} 格，${c}` : `第 ${i + 1} 格，空`}
                    className={`ttt-cell${win ? ' ttt-cell--win' : ''}${c === 'X' ? ' ttt-cell--x' : ''}${c === 'O' ? ' ttt-cell--o' : ''}`}
                    disabled={disabled}
                    onClick={() => play(i)}
                  >
                    <span aria-hidden>{c ?? ''}</span>
                  </button>
                )
              })}
            </div>

            <p className="ttt-status" aria-live="polite">
              {statusText(winner, turn, mode, cpuThinking)}
            </p>
          </div>
        </FtSection>

        <FtSection title="對局歷史" hint="每局結束自動記錄，最多 40 筆。">
          <div className="panel stack ttt-history">
            <div className="row ttt-history-head">
              <span className="label" style={{ margin: 0 }}>
                共 {matches.length} 筆
              </span>
              <ActionButton className="btn sm ghost" disabled={!matches.length} onClick={() => setMatches([])}>
                清空
              </ActionButton>
            </div>
            <div className="ttt-filter-row">
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
            <ul className="list ttt-match-list">
              {filteredMatches.slice(0, 16).map((m) => (
                <li key={m.id} className="list-item ttt-match-item">
                  <div className="ttt-match-body">
                    <strong>{m.winner === 'draw' ? '平手' : `${m.winner} 勝`}</strong>
                    <span className="muted ttt-match-meta">
                      {m.mode === 'cpu' ? '人機' : '雙人'} · {m.moves} 步
                    </span>
                    <div className="muted mono ttt-match-time">
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
              {!filteredMatches.length && <p className="muted ttt-empty">完成一局後會自動記錄</p>}
            </ul>
          </div>
        </FtSection>
      </div>
    </PortfolioLayout>
  )
}
