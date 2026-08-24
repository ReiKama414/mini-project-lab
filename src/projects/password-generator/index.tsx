import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, downloadText, limitText, parseNumber, uid } from '../../lib/utils'

const LENGTH_MIN = 8
const LENGTH_MAX = 128
const BATCH_MIN = 1
const BATCH_MAX = 20
const FILTER_MAX = 80

const meta = getProject('password-generator')!

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*-_=+?~',
}

const AMBIGUOUS = /[0OIl1]/g

type Opts = { lower: boolean; upper: boolean; digits: boolean; symbols: boolean }
type HistoryItem = { id: string; pwd: string; at: number; length: number; score: number }

const PRESETS: { label: string; length: number; opts: Opts; excludeAmbiguous: boolean }[] = [
  { label: '網站帳號', length: 16, opts: { lower: true, upper: true, digits: true, symbols: true }, excludeAmbiguous: true },
  { label: 'PIN 風格', length: 8, opts: { lower: false, upper: false, digits: true, symbols: false }, excludeAmbiguous: false },
  { label: '字母數字', length: 20, opts: { lower: true, upper: true, digits: true, symbols: false }, excludeAmbiguous: true },
  { label: '高強度', length: 32, opts: { lower: true, upper: true, digits: true, symbols: true }, excludeAmbiguous: false },
]

function securePick(pool: string) {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return pool[arr[0]! % pool.length]!
}

function strengthScore(pwd: string) {
  let score = 0
  if (pwd.length >= 12) score += 1
  if (pwd.length >= 16) score += 1
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1
  if (/\d/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1
  return score
}

const STRENGTH = ['很弱', '弱', '普通', '強', '很強', '極強']

export default function Page() {
  const [length, setLength] = useLocalStorage('lab:password-generator:length', 20)
  const [opts, setOpts] = useLocalStorage<Opts>('lab:password-generator:opts', {
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
  })
  const [excludeAmbiguous, setExcludeAmbiguous] = useLocalStorage('lab:password-generator:ambiguous', true)
  const [batch, setBatch] = useLocalStorage('lab:password-generator:batch', 1)
  const [pwd, setPwd] = useState('')
  const [batchList, setBatchList] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:password-generator:history-v2', [])
  const [histFilter, setHistFilter] = useState('')
  const [minScore, setMinScore] = useState(0)

  const score = useMemo(() => strengthScore(pwd), [pwd])

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    return history.filter((h) => h.score >= minScore && (!q || h.pwd.toLowerCase().includes(q) || String(h.length).includes(q)))
  }, [history, histFilter, minScore])

  const stats = useMemo(() => {
    if (!history.length) return { avgLen: 0, avgScore: 0, strong: 0 }
    const avgLen = Math.round(history.reduce((s, h) => s + h.length, 0) / history.length)
    const avgScore = (history.reduce((s, h) => s + h.score, 0) / history.length).toFixed(1)
    const strong = history.filter((h) => h.score >= 4).length
    return { avgLen, avgScore, strong }
  }, [history])

  const safeLength = clamp(length, LENGTH_MIN, LENGTH_MAX)
  const safeBatch = clamp(batch, BATCH_MIN, BATCH_MAX)
  const canGenerate = Object.values(opts).some(Boolean)

  function makeOne(): string | null {
    const required: string[] = []
    let pool = ''
    ;(
      [
        ['lower', SETS.lower],
        ['upper', SETS.upper],
        ['digits', SETS.digits],
        ['symbols', SETS.symbols],
      ] as const
    ).forEach(([k, set]) => {
      if (!opts[k]) return
      let s = set
      if (excludeAmbiguous) s = s.replace(AMBIGUOUS, '')
      pool += s
      required.push(securePick(s))
    })
    if (!pool) return null
    const out = [...required]
    while (out.length < safeLength) out.push(securePick(pool))
    for (let i = out.length - 1; i > 0; i--) {
      const arr = new Uint32Array(1)
      crypto.getRandomValues(arr)
      const j = arr[0]! % (i + 1)
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out.join('')
  }

  function generate() {
    if (!canGenerate) return
    const n = safeBatch
    const results: string[] = []
    for (let i = 0; i < n; i++) {
      const r = makeOne()
      if (r) results.push(r)
    }
    if (!results.length) return
    setPwd(results[0]!)
    setBatchList(results)
    setCopied(false)
    setHistory((h) =>
      [
        ...results.map((p) => ({
          id: uid('pw'),
          pwd: p,
          at: Date.now(),
          length: p.length,
          score: strengthScore(p),
        })),
        ...h,
      ].slice(0, 24),
    )
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setLength(clamp(p.length, LENGTH_MIN, LENGTH_MAX))
    setOpts(p.opts)
    setExcludeAmbiguous(p.excludeAmbiguous)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm accent" onClick={generate} disabled={!canGenerate}>
            產生
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={!batchList.length}
            onClick={() => downloadText('passwords.txt', batchList.join('\n'))}
          >
            匯出批次
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">歷史 {history.length}</span>
        <span className="tag">平均長度 {stats.avgLen || '—'}</span>
        <span className="tag">平均強度 {stats.avgScore || '—'}</span>
        <span className="tag">強以上 {stats.strong}</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div>
            <div className="label">預設組合</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="stack">
            <span className="label">長度：{safeLength}（{LENGTH_MIN}–{LENGTH_MAX}）</span>
            <input
              className="field"
              type="range"
              min={LENGTH_MIN}
              max={LENGTH_MAX}
              value={safeLength}
              onChange={(e) => setLength(clamp(parseNumber(e.target.value, LENGTH_MIN), LENGTH_MIN, LENGTH_MAX))}
            />
            <input
              className="field"
              type="number"
              min={LENGTH_MIN}
              max={LENGTH_MAX}
              value={safeLength}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) return
                setLength(clamp(n, LENGTH_MIN, LENGTH_MAX))
              }}
            />
          </label>

          <label className="stack">
            <span className="label">一次產生數量：{safeBatch}（{BATCH_MIN}–{BATCH_MAX}）</span>
            <input
              className="field"
              type="range"
              min={BATCH_MIN}
              max={BATCH_MAX}
              value={safeBatch}
              onChange={(e) => setBatch(clamp(parseNumber(e.target.value, BATCH_MIN), BATCH_MIN, BATCH_MAX))}
            />
          </label>
          {!canGenerate && <p className="field-error">請至少勾選一種字元類型</p>}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['lower', '小寫'],
                ['upper', '大寫'],
                ['digits', '數字'],
                ['symbols', '符號'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={opts[k]}
                  onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <label className="row">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={() => setExcludeAmbiguous(!excludeAmbiguous)}
            />
            排除易混淆字元（0 O I l 1）
          </label>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={generate} disabled={!canGenerate}>
              產生密碼
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!pwd}
              onClick={async () => {
                await copyText(pwd)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!batchList.length}
              onClick={() => void copyText(batchList.join('\n'))}
            >
              複製全部
            </button>
          </div>

          {pwd && (
            <>
              <div className="metric mono" style={{ wordBreak: 'break-all', fontSize: 18 }}>
                {pwd}
              </div>
              <div className="progress">
                <span style={{ width: `${(score / 5) * 100}%` }} />
              </div>
              <p className="muted">強度：{STRENGTH[score]} · 使用 Web Crypto 亂數</p>
            </>
          )}

          {batchList.length > 1 && (
            <ul className="list">
              {batchList.map((p) => (
                <li key={p} className="list-item">
                  <code className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p}
                  </code>
                  <span className="tag">{STRENGTH[strengthScore(p)]}</span>
                  <button type="button" className="btn ghost sm" onClick={() => void copyText(p)}>
                    複製
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="muted" style={{ fontSize: 12 }}>
            僅存在本機，請勿用於真實重要帳號後長期留存。
          </p>
        </div>

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>最近產生</h3>
            <button type="button" className="btn ghost sm" disabled={!history.length} onClick={() => setHistory([])}>
              清空歷史
            </button>
          </div>
          <input
            className="field"
            placeholder="篩選密碼／長度…"
            value={histFilter}
            maxLength={FILTER_MAX}
            onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(histFilter)} / {FILTER_MAX}</span>
          </div>
          <label className="stack">
            <span className="label">最低強度篩選：{STRENGTH[minScore]}</span>
            <input
              className="field"
              type="range"
              min={0}
              max={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </label>
          <ul className="list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="list-item stack">
                <code className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
                  {h.pwd}
                </code>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="tag">{STRENGTH[h.score]}</span>
                  <span className="muted mono" style={{ fontSize: 11 }}>
                    長度 {h.length} · {new Date(h.at).toLocaleString('zh-TW')}
                  </span>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      setPwd(h.pwd)
                      setBatchList([h.pwd])
                    }}
                  >
                    顯示
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => void copyText(h.pwd)}>
                    複製
                  </button>
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                  >
                    刪
                  </button>
                </div>
              </li>
            ))}
            {!filteredHistory.length && <p className="muted">尚無紀錄或不符合篩選</p>}
          </ul>
          {!!history.length && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => downloadText('password-history.txt', history.map((h) => h.pwd).join('\n'))}
            >
              匯出歷史
            </button>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
