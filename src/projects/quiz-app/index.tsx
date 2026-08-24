import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('quiz-app')!

type Q = {
  id: string
  category: string
  q: string
  options: string[]
  answer: number
}

type HistoryItem = {
  id: string
  at: string
  category: string
  score: number
  total: number
  timed: boolean
  secondsUsed: number
}

const BANK: Q[] = [
  { id: '1', category: 'React', q: 'React 用來描述 UI 的基本單位是？', options: ['Component', 'Module', 'Package', 'Hook'], answer: 0 },
  { id: '2', category: 'React', q: '哪個 Hook 用來處理副作用？', options: ['useState', 'useEffect', 'useMemo', 'useRef'], answer: 1 },
  { id: '3', category: 'React', q: 'React 中 key 的主要用途？', options: ['樣式命名', '協助列表協調', '取代 id', '提升 CSS'], answer: 1 },
  { id: '4', category: 'TypeScript', q: 'TypeScript 的主要優勢？', options: ['更快執行', '靜態型別檢查', '更小檔案', '取代 CSS'], answer: 1 },
  { id: '5', category: 'TypeScript', q: '哪個關鍵字用來定義物件形狀？', options: ['enum', 'interface', 'namespace', 'declare'], answer: 1 },
  { id: '6', category: 'TypeScript', q: '`unknown` 與 `any` 的差異？', options: ['完全相同', 'unknown 需收窄才能用', 'any 更安全', 'unknown 不能賦值'], answer: 1 },
  { id: '7', category: 'Web', q: 'HTTP 狀態碼 404 代表？', options: ['成功', '重新導向', '找不到資源', '伺服器錯誤'], answer: 2 },
  { id: '8', category: 'Web', q: 'localStorage 適合存？', options: ['密碼明文', '本機偏好設定', '大型影片', '伺服器 session'], answer: 1 },
  { id: '9', category: 'Web', q: 'CORS 主要限制什麼？', options: ['本機檔案大小', '跨來源請求', 'CSS 選擇器', '圖片格式'], answer: 1 },
  { id: '10', category: '工具', q: 'Vite 開發伺服器的特色？', options: ['僅支援 Vue', '極快 HMR', '需 Webpack', '無 TypeScript'], answer: 1 },
  { id: '11', category: '工具', q: 'npm 的 package.json 用途？', options: ['只存圖示', '專案依賴與腳本', '瀏覽器快取', 'DNS 設定'], answer: 1 },
  { id: '12', category: '工具', q: 'Git 中 `git commit` 做什麼？', options: ['推到遠端', '建立本機提交', '合併分支', '刪除檔案'], answer: 1 },
  { id: '13', category: '演算法', q: '二元搜尋的時間複雜度？', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], answer: 1 },
  { id: '14', category: '演算法', q: 'Stack 的特性是？', options: ['FIFO', 'LIFO', '隨機存取', '優先佇列'], answer: 1 },
  { id: '15', category: '資料庫', q: 'SQL 中 SELECT 用途？', options: ['刪除資料', '查詢資料', '建立索引', '授權'], answer: 1 },
]

const CATS = ['全部', ...Array.from(new Set(BANK.map((q) => q.category)))]

export default function Page() {
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:quiz-app:history', [])
  const [category, setCategory] = useState('全部')
  const [useTimer, setUseTimer] = useState(false)
  const [limitSec, setLimitSec] = useState(60)
  const [phase, setPhase] = useState<'setup' | 'quiz' | 'result'>('setup')
  const [queue, setQueue] = useState<Q[]>([])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [wrong, setWrong] = useState<{ q: Q; picked: number }[]>([])
  const [review, setReview] = useState(false)
  const [left, setLeft] = useState(60)
  const [startedAt, setStartedAt] = useState(0)
  const endedRef = useRef(false)

  const q = queue[i]

  const pool = useMemo(
    () => (category === '全部' ? BANK : BANK.filter((x) => x.category === category)),
    [category],
  )

  function recordHistory(finalScore: number, total: number, secondsUsed: number, timed: boolean, cat: string) {
    setHistory((prev) =>
      [
        {
          id: uid('qz'),
          at: new Date().toISOString(),
          category: cat,
          score: finalScore,
          total,
          timed,
          secondsUsed: Math.max(0, secondsUsed),
        },
        ...prev,
      ].slice(0, 20),
    )
  }

  function endQuiz(finalScore: number, finalWrong: { q: Q; picked: number }[], secondsUsed: number) {
    if (endedRef.current) return
    endedRef.current = true
    recordHistory(finalScore, queue.length, secondsUsed, useTimer, category)
    setScore(finalScore)
    setWrong(finalWrong)
    setPhase('result')
  }

  useEffect(() => {
    if (phase !== 'quiz' || !useTimer) return
    if (left <= 0) {
      endQuiz(score, wrong, limitSec)
      return
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, useTimer, left, score, wrong, limitSec])

  function start() {
    const list = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(10, pool.length))
    endedRef.current = false
    setQueue(list)
    setI(0)
    setScore(0)
    setPicked(null)
    setWrong([])
    setReview(false)
    setLeft(limitSec)
    setStartedAt(Date.now())
    setPhase('quiz')
  }

  function choose(opt: number) {
    if (picked != null || !q) return
    setPicked(opt)
    if (opt === q.answer) setScore((s) => s + 1)
    else setWrong((w) => [...w, { q, picked: opt }])
  }

  function next() {
    if (!q || picked == null) return
    if (i + 1 >= queue.length) {
      const secondsUsed = useTimer ? limitSec - left : Math.round((Date.now() - startedAt) / 1000)
      endQuiz(score, wrong, secondsUsed)
      return
    }
    setI((x) => x + 1)
    setPicked(null)
  }

  return (
    <ProjectShell meta={meta}>
      {phase === 'setup' && (
        <div className="panel stack">
          <div className="label">題庫分類（共 {pool.length} 題）</div>
          <div className="row">
            {CATS.map((c) => (
              <button key={c} className={`btn sm ${category === c ? 'accent' : 'ghost'}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} />
            <span>啟用計時</span>
            {useTimer && (
              <input
                className="field"
                type="number"
                min={15}
                max={300}
                style={{ width: 100 }}
                value={limitSec}
                onChange={(e) => setLimitSec(Math.max(15, Number(e.target.value)))}
              />
            )}
            {useTimer && <span className="muted">秒</span>}
          </label>
          <button className="btn accent" onClick={start} disabled={!pool.length}>
            開始測驗（最多 10 題）
          </button>

          {history.length > 0 && (
            <div className="stack">
              <strong>成績紀錄</strong>
              <ul className="list">
                {history.map((h) => (
                  <li key={h.id} className="list-item">
                    <div className="stack" style={{ flex: 1, gap: 2 }}>
                      <strong>
                        {h.score}/{h.total}（{Math.round((h.score / Math.max(1, h.total)) * 100)}%）
                      </strong>
                      <span className="muted">
                        {new Date(h.at).toLocaleString('zh-TW')} · {h.category}
                        {h.timed ? ` · 限時用了 ${h.secondsUsed}s` : ` · 用時 ${h.secondsUsed}s`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <button className="btn sm ghost" onClick={() => setHistory([])}>
                清除紀錄
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'quiz' && q && (
        <div className="panel stack">
          <div className="row">
            <span className="tag">
              第 {i + 1}/{queue.length} 題 · {q.category}
            </span>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              得分 {score}
              {useTimer && ` · 剩餘 ${left}s`}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${((i + (picked != null ? 1 : 0)) / queue.length) * 100}%` }} />
          </div>
          <h2 style={{ margin: 0 }}>{q.q}</h2>
          <div className="stack">
            {q.options.map((opt, oi) => {
              let cls = 'btn ghost'
              if (picked != null) {
                if (oi === q.answer) cls = 'btn teal'
                else if (oi === picked) cls = 'btn accent'
              }
              return (
                <button key={oi} className={cls} style={{ justifyContent: 'flex-start' }} onClick={() => choose(oi)}>
                  {String.fromCharCode(65 + oi)}. {opt}
                </button>
              )
            })}
          </div>
          {picked != null && (
            <button className="btn accent" onClick={next}>
              {i + 1 >= queue.length ? '看結果' : '下一題'}
            </button>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="panel stack">
          <div className="stack" style={{ textAlign: 'center' }}>
            <div className="metric" style={{ fontSize: 36 }}>
              {score} / {queue.length}
            </div>
            <p className="muted">答對率 {queue.length ? Math.round((score / queue.length) * 100) : 0}%</p>
          </div>
          {wrong.length > 0 && (
            <div className="stack">
              <div className="row">
                <strong>錯題複習（{wrong.length}）</strong>
                <button className="btn sm ghost" onClick={() => setReview((r) => !r)}>
                  {review ? '收合' : '展開'}
                </button>
              </div>
              {review && (
                <ul className="list">
                  {wrong.map(({ q: wq, picked: p }) => (
                    <li key={wq.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                      <strong>{wq.q}</strong>
                      <span className="muted" style={{ color: 'var(--rose)' }}>
                        你的答案：{wq.options[p]}
                      </span>
                      <span style={{ color: 'var(--teal)' }}>正解：{wq.options[wq.answer]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn accent" onClick={start}>
              再測一次
            </button>
            <button className="btn ghost" onClick={() => setPhase('setup')}>
              回到設定
            </button>
          </div>
        </div>
      )}
    </ProjectShell>
  )
}
