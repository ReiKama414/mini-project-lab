import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, downloadText, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('lorem-ipsum')!

const AMOUNT_MAX: Record<'paragraphs' | 'sentences' | 'words', number> = {
  paragraphs: 50,
  sentences: 100,
  words: 500,
}
const FILTER_MAX = 80

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

const LOREM_START = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet']

type Mode = 'paragraphs' | 'sentences' | 'words'
type HistoryItem = {
  id: string
  at: number
  mode: Mode
  amount: number
  preview: string
  text: string
  htmlWrap: boolean
}

const AMOUNT_PRESETS: Record<Mode, number[]> = {
  paragraphs: [1, 2, 3, 5, 8],
  sentences: [1, 3, 5, 10, 20],
  words: [10, 25, 50, 100],
}

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!
}

function makeSentence(wordCount: number, startWithLorem: boolean, isFirst: boolean) {
  const words: string[] = []
  if (startWithLorem && isFirst) {
    words.push(...LOREM_START)
    while (words.length < wordCount) words.push(pickWord())
  } else {
    for (let i = 0; i < wordCount; i++) words.push(pickWord())
    words[0] = words[0]![0]!.toUpperCase() + words[0]!.slice(1)
  }
  return words.join(' ') + '.'
}

function wrapHtml(plain: string, mode: Mode) {
  if (mode === 'paragraphs') {
    return plain
      .split(/\n\n+/)
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('\n')
  }
  if (mode === 'sentences') {
    return `<p>${plain}</p>`
  }
  return `<span>${plain}</span>`
}

function countStats(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { words: 0, chars: 0, paragraphs: 0, sentences: 0 }
  const paragraphs = trimmed.split(/\n\n+/).filter(Boolean).length
  const sentences = (trimmed.match(/[.!?]+/g) || []).length || (trimmed ? 1 : 0)
  const words = trimmed.split(/\s+/).filter(Boolean).length
  return { words, chars: trimmed.length, paragraphs, sentences }
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:lorem-ipsum:mode', 'paragraphs')
  const [amount, setAmount] = useLocalStorage('lab:lorem-ipsum:amount', 3)
  const [startLorem, setStartLorem] = useLocalStorage('lab:lorem-ipsum:start', true)
  const [htmlWrap, setHtmlWrap] = useLocalStorage('lab:lorem-ipsum:html', false)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:lorem-ipsum:history', [])
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [histFilter, setHistFilter] = useState('')

  function generate() {
    const max = AMOUNT_MAX[mode]
    const n = clamp(Number.isFinite(amount) ? amount : 1, 1, max)
    let out = ''
    if (mode === 'words') {
      const words: string[] = []
      if (startLorem) {
        words.push(...LOREM_START.map((w) => w.toLowerCase()))
        words[0] = 'Lorem'
      }
      while (words.length < n) words.push(pickWord())
      if (!startLorem && words[0]) words[0] = words[0][0]!.toUpperCase() + words[0].slice(1)
      out = words.slice(0, n).join(' ')
    } else if (mode === 'sentences') {
      out = Array.from({ length: n }, (_, i) =>
        makeSentence(8 + Math.floor(Math.random() * 8), startLorem, i === 0),
      ).join(' ')
    } else {
      out = Array.from({ length: n }, (_, pi) => {
        const sentences = 3 + Math.floor(Math.random() * 3)
        return Array.from({ length: sentences }, (_, si) =>
          makeSentence(8 + Math.floor(Math.random() * 8), startLorem, pi === 0 && si === 0),
        ).join(' ')
      }).join('\n\n')
    }
    setText(out)
    setCopied(false)
    return out
  }

  function generateAndSave() {
    const out = generate()
    setHistory((h) =>
      [
        {
          id: uid('lor'),
          at: Date.now(),
          mode,
          amount,
          preview: out.slice(0, 80).replace(/\n/g, ' '),
          text: out,
          htmlWrap,
        },
        ...h,
      ].slice(0, 16),
    )
  }

  const output = useMemo(() => (htmlWrap && text ? wrapHtml(text, mode) : text), [htmlWrap, text, mode])
  const stats = useMemo(() => countStats(text), [text])
  const amountLabel = mode === 'paragraphs' ? '段落數' : mode === 'sentences' ? '句子數' : '單字數'
  const modeLabel = mode === 'paragraphs' ? '段落' : mode === 'sentences' ? '句子' : '單字'

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    if (!q) return history
    return history.filter((h) => h.preview.toLowerCase().includes(q) || h.mode.includes(q))
  }, [history, histFilter])

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm accent" onClick={generateAndSave}>
            產生並存歷史
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={!output}
            onClick={() => downloadText(htmlWrap ? 'lorem.html' : 'lorem.txt', output)}
          >
            下載
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="metric">字 {stats.words}</span>
        <span className="tag">字元 {stats.chars}</span>
        <span className="tag">句 {stats.sentences}</span>
        <span className="tag">段 {stats.paragraphs}</span>
        <span className="tag">歷史 {history.length}</span>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(
              [
                ['paragraphs', '段落'],
                ['sentences', '句子'],
                ['words', '單字'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className={`btn sm ${mode === m ? 'accent' : 'ghost'}`}
                onClick={() => setMode(m)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="stack">
            <span className="label">{amountLabel}（1–{AMOUNT_MAX[mode]}）</span>
            <input
              className="field"
              type="number"
              min={1}
              max={AMOUNT_MAX[mode]}
              value={amount}
              onChange={(e) => {
                const n = parseNumber(e.target.value)
                if (!Number.isFinite(n)) return
                setAmount(clamp(n, 1, AMOUNT_MAX[mode]))
              }}
            />
          </label>

          <div>
            <div className="label">數量預設（{modeLabel}）</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {AMOUNT_PRESETS[mode].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${amount === n ? 'accent' : 'ghost'}`}
                  onClick={() => setAmount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={startLorem} onChange={(e) => setStartLorem(e.target.checked)} />
            以「Lorem ipsum dolor sit amet」開頭
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={htmlWrap} onChange={(e) => setHtmlWrap(e.target.checked)} />
            輸出包成 HTML（段落用 &lt;p&gt;）
          </label>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={generate}>
              產生
            </button>
            <button type="button" className="btn teal" onClick={generateAndSave}>
              產生並存歷史
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!output}
              onClick={async () => {
                await copyText(output)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已複製' : '複製'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!output}
              onClick={() => downloadText(htmlWrap ? 'lorem.html' : 'lorem.txt', output)}
            >
              下載
            </button>
          </div>

          {output ? (
            <pre
              className="metric mono"
              style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: 420, overflow: 'auto' }}
            >
              {output}
            </pre>
          ) : (
            <p className="muted">選擇模式後點擊產生假文</p>
          )}
        </div>

        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>產生歷史</h3>
            <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          <input
            className="field"
            placeholder="篩選預覽文字…"
            value={histFilter}
            maxLength={FILTER_MAX}
            onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(histFilter)} / {FILTER_MAX}</span>
          </div>
          <ul className="list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="list-item stack">
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="tag">{h.mode === 'paragraphs' ? '段落' : h.mode === 'sentences' ? '句子' : '單字'}</span>
                  <span className="tag">×{h.amount}</span>
                  {h.htmlWrap && <span className="tag">HTML</span>}
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {h.preview}…
                </p>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  {new Date(h.at).toLocaleString('zh-TW')}
                </span>
                <div className="row">
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setMode(h.mode)
                      setAmount(h.amount)
                      setHtmlWrap(h.htmlWrap)
                      setText(h.text)
                    }}
                  >
                    還原
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => void copyText(h.htmlWrap ? wrapHtml(h.text, h.mode) : h.text)}>
                    複製
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                  >
                    刪
                  </button>
                </div>
              </li>
            ))}
            {!filteredHistory.length && <p className="muted">尚無歷史紀錄</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
