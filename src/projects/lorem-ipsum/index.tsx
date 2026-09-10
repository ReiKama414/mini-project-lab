import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, limitText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('lorem-ipsum')!

const AMOUNT_MAX: Record<'paragraphs' | 'sentences' | 'words', number> = {
  paragraphs: 50,
  sentences: 100,
  words: 500,
}
const FILTER_MAX = 80
const HISTORY_CAP = 20

type Mode = 'paragraphs' | 'sentences' | 'words'
type Flavor = 'classic' | 'modern' | 'zh'
type OutFmt = 'plain' | 'html' | 'markdown'

type HistoryItem = {
  id: string
  at: number
  mode: Mode
  amount: number
  flavor: Flavor
  fmt: OutFmt
  preview: string
  text: string
  startLorem: boolean
}

const AMOUNT_PRESETS: Record<Mode, number[]> = {
  paragraphs: [1, 2, 3, 5, 8],
  sentences: [1, 3, 5, 10, 20],
  words: [10, 25, 50, 100, 200],
}

const CLASSIC_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

const MODERN_WORDS = [
  'design', 'layout', 'content', 'interface', 'prototype', 'wireframe', 'component',
  'spacing', 'typography', 'contrast', 'hierarchy', 'responsive', 'accessible',
  'workflow', 'iteration', 'feedback', 'placeholder', 'draft', 'mockup', 'canvas',
  'palette', 'baseline', 'grid', 'module', 'section', 'headline', 'caption',
  'snippet', 'preview', 'sample', 'neutral', 'balance', 'focus', 'clarity',
  'structure', 'pattern', 'system', 'token', 'surface', 'elevation', 'motion',
]

const ZH_PHRASES = [
  '這是一段用於排版預覽的佔位文字',
  '設計師可用來評估字級與行距',
  '內容尚未定稿時可先填入此段',
  '請依實際需求調整段落長度',
  '介面元件在真實文案出現前仍可測試',
  '閱讀節奏與留白會影響整體感受',
  '行動裝置與桌面版面應分開檢查',
  '標題與內文對比需保持清楚',
  '此段文字不具實際語意',
  '僅供版面與流程展示使用',
]

const LOREM_START = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet']

const FLAVOR_META: Record<Flavor, { label: string; hint: string }> = {
  classic: { label: '經典拉丁', hint: '傳統 Lorem Ipsum 詞庫' },
  modern: { label: '現代英文', hint: '設計／介面相關佔位詞' },
  zh: { label: '中文佔位', hint: '繁中短句，適合在地預覽' },
}

const MODE_LABEL: Record<Mode, string> = {
  paragraphs: '段落',
  sentences: '句子',
  words: '單字',
}

function randInt(max: number) {
  if (max <= 0) return 0
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function pick<T>(list: T[]) {
  return list[randInt(list.length)]!
}

function wordPool(flavor: Flavor) {
  return flavor === 'modern' ? MODERN_WORDS : CLASSIC_WORDS
}

function makeSentence(flavor: Flavor, startWithLorem: boolean, isFirst: boolean) {
  if (flavor === 'zh') {
    const s = pick(ZH_PHRASES)
    return isFirst && startWithLorem ? `佔位文字。${s}。` : `${s}。`
  }
  const words: string[] = []
  const pool = wordPool(flavor)
  const len = 8 + randInt(8)
  if (startWithLorem && isFirst && flavor === 'classic') {
    words.push(...LOREM_START)
    while (words.length < len) words.push(pick(pool))
  } else {
    for (let i = 0; i < len; i++) words.push(pick(pool))
    words[0] = words[0]![0]!.toUpperCase() + words[0]!.slice(1)
  }
  return `${words.join(' ')}.`
}

function wrapOutput(plain: string, mode: Mode, fmt: OutFmt) {
  if (fmt === 'plain' || !plain) return plain
  if (fmt === 'markdown') {
    if (mode === 'paragraphs') return plain.split(/\n\n+/).filter(Boolean).join('\n\n')
    if (mode === 'sentences') return plain
    return plain
  }
  // html
  if (mode === 'paragraphs') {
    return plain
      .split(/\n\n+/)
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('\n')
  }
  if (mode === 'sentences') return `<p>${plain}</p>`
  return `<span>${plain}</span>`
}

function countStats(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { words: 0, chars: 0, paragraphs: 0, sentences: 0, bytes: 0, unique: 0, avgSentence: 0, readMin: 0 }
  const paragraphs = trimmed.split(/\n\n+/).filter(Boolean).length
  const sentences = (trimmed.match(/[.!?。]+/g) || []).length || 1
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  const words = tokens.length
  const unique = new Set(tokens.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))).size
  const avgSentence = sentences ? Math.round((words / sentences) * 10) / 10 : 0
  const bytes = new TextEncoder().encode(trimmed).length
  const readMin = Math.max(1, Math.ceil(words / 200))
  return { words, chars: trimmed.length, paragraphs, sentences, bytes, unique, avgSentence, readMin }
}

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:lorem-ipsum:mode', 'paragraphs')
  const [amount, setAmount] = useLocalStorage('lab:lorem-ipsum:amount', 3)
  const [flavor, setFlavor] = useLocalStorage<Flavor>('lab:lorem-ipsum:flavor', 'classic')
  const [fmt, setFmt] = useLocalStorage<OutFmt>('lab:lorem-ipsum:fmt', 'plain')
  const [startLorem, setStartLorem] = useLocalStorage('lab:lorem-ipsum:start', true)
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:lorem-ipsum:history-v2', [])
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [histFilter, setHistFilter] = useState('')

  const maxAmount = AMOUNT_MAX[mode]
  const safeAmount = clamp(Number.isFinite(amount) ? amount : 1, 1, maxAmount)
  const amountLabel = mode === 'paragraphs' ? '段落數' : mode === 'sentences' ? '句子數' : flavor === 'zh' ? '短句數' : '單字數'

  function generatePlain() {
    const n = safeAmount
    if (mode === 'words') {
      if (flavor === 'zh') {
        const parts: string[] = []
        while (parts.length < n) parts.push(pick(ZH_PHRASES))
        return parts.slice(0, n).join('，') + '。'
      }
      const pool = wordPool(flavor)
      const words: string[] = []
      if (startLorem && flavor === 'classic') {
        words.push(...LOREM_START.map((w) => w.toLowerCase()))
        words[0] = 'Lorem'
      }
      while (words.length < n) words.push(pick(pool))
      if (!(startLorem && flavor === 'classic') && words[0]) {
        words[0] = words[0][0]!.toUpperCase() + words[0].slice(1)
      }
      return words.slice(0, n).join(' ')
    }
    if (mode === 'sentences') {
      return Array.from({ length: n }, (_, i) => makeSentence(flavor, startLorem, i === 0)).join(flavor === 'zh' ? '' : ' ')
    }
    return Array.from({ length: n }, (_, pi) => {
      const sentences = 3 + randInt(3)
      return Array.from({ length: sentences }, (_, si) =>
        makeSentence(flavor, startLorem, pi === 0 && si === 0),
      ).join(flavor === 'zh' ? '' : ' ')
    }).join('\n\n')
  }

  function generate(save = false) {
    const out = generatePlain()
    setText(out)
    setCopied(false)
    if (!save) return
    setHistory((h) =>
      [
        {
          id: uid('lor'),
          at: Date.now(),
          mode,
          amount: safeAmount,
          flavor,
          fmt,
          preview: out.slice(0, 80).replace(/\n/g, ' '),
          text: out,
          startLorem,
        },
        ...h,
      ].slice(0, HISTORY_CAP),
    )
  }

  const output = useMemo(() => wrapOutput(text, mode, fmt), [text, mode, fmt])
  const stats = useMemo(() => countStats(text), [text])
  const htmlTags = useMemo(() => (fmt === 'html' && output ? (output.match(/<\/?[a-z]+>/gi) || []).length : 0), [fmt, output])

  const filteredHistory = useMemo(() => {
    const q = histFilter.trim().toLowerCase()
    if (!q) return history
    return history.filter(
      (h) =>
        h.preview.toLowerCase().includes(q) ||
        h.mode.includes(q) ||
        h.flavor.includes(q) ||
        h.fmt.includes(q),
    )
  }, [history, histFilter])

  const fileName = fmt === 'html' ? 'lorem.html' : fmt === 'markdown' ? 'lorem.md' : 'lorem.txt'

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row lorem-shell-actions">
          <ActionButton className="btn sm accent" onClick={() => generate(false)}>
            產生
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!output}
            onClick={() => downloadText(fileName, output)}
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="lorem-calc">
        <div className="pw-stats">
          <span className="metric">{MODE_LABEL[mode]}</span>
          <span className="tag">{FLAVOR_META[flavor].label}</span>
          <span className="tag">字 {stats.words}</span>
          <span className="tag">字元 {stats.chars}</span>
          <span className="tag">歷史 {history.length}</span>
        </div>

        <div className="lorem-main">
          <section className="panel lorem-settings">
            <h3 className="pw-panel-title">產生設定</h3>

            <div className="pw-block">
              <div className="label">單位</div>
              <div className="pw-chips">
                {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn sm ${mode === m ? 'accent' : 'ghost'}`}
                    onClick={() => {
                      setMode(m)
                      setAmount(clamp(amount, 1, AMOUNT_MAX[m]))
                    }}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="pw-block">
              <div className="label">文風</div>
              <div className="pw-chips">
                {(Object.keys(FLAVOR_META) as Flavor[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn sm ${flavor === f ? 'accent' : 'ghost'}`}
                    title={FLAVOR_META[f].hint}
                    onClick={() => setFlavor(f)}
                  >
                    {FLAVOR_META[f].label}
                  </button>
                ))}
              </div>
              <p className="field-hint">{FLAVOR_META[flavor].hint}</p>
            </div>

            <label className="stack">
              <span className="label">
                {amountLabel}：{safeAmount}（1–{maxAmount}）
              </span>
              <input
                className="field"
                type="range"
                min={1}
                max={maxAmount}
                value={safeAmount}
                onChange={(e) => setAmount(clamp(parseNumber(e.target.value, 1), 1, maxAmount))}
              />
              <input
                className="field"
                type="number"
                min={1}
                max={maxAmount}
                value={safeAmount}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) return
                  setAmount(clamp(n, 1, maxAmount))
                }}
              />
            </label>

            <div className="pw-chips">
              {AMOUNT_PRESETS[mode].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${safeAmount === n ? 'accent' : 'ghost'}`}
                  onClick={() => setAmount(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="pw-block">
              <div className="label">輸出格式</div>
              <div className="pw-chips">
                {(
                  [
                    ['plain', '純文字'],
                    ['html', 'HTML'],
                    ['markdown', 'Markdown'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn sm ${fmt === k ? 'accent' : 'ghost'}`}
                    onClick={() => setFmt(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="pw-check">
              <input type="checkbox" checked={startLorem} onChange={(e) => setStartLorem(e.target.checked)} />
              <span>
                {flavor === 'zh' ? '以「佔位文字」開頭' : flavor === 'classic' ? '以 Lorem ipsum… 開頭' : '首句大寫開頭'}
              </span>
            </label>

            <div className="pw-actions">
              <ActionButton className="btn accent" onClick={() => generate(false)}>
                產生
              </ActionButton>
              <ActionButton className="btn teal" onClick={() => generate(true)}>
                產生並存歷史
              </ActionButton>
              <ActionButton
                className="btn ghost"
                disabled={!output}
                onClick={async () => {
                  await copyText(output)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1500)
                }}
                icon="copy"
              >
                {copied ? '已複製' : '複製'}
              </ActionButton>
              <ActionButton
                className="btn ghost"
                disabled={!output}
                onClick={() => downloadText(fileName, output)}
              >
                下載
              </ActionButton>
            </div>
          </section>

          <aside className="lorem-side">
            <section className="panel lorem-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">預覽</h3>
                <span className="tag">{fmt === 'html' ? 'HTML' : fmt === 'markdown' ? 'MD' : 'TXT'}</span>
              </div>
              {output ? (
                <pre className="lorem-output mono">{output}</pre>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  調整左側設定後按「產生」
                </p>
              )}
            </section>

            <section className="panel lorem-info">
              <h3 className="pw-panel-title">更多資訊</h3>
              <ul className="pw-info-list">
                <li>
                  <span className="muted">單字／短句</span>
                  <strong>{stats.words}</strong>
                </li>
                <li>
                  <span className="muted">字元</span>
                  <strong>{stats.chars}</strong>
                </li>
                <li>
                  <span className="muted">句子</span>
                  <strong>{stats.sentences}</strong>
                </li>
                <li>
                  <span className="muted">段落</span>
                  <strong>{stats.paragraphs}</strong>
                </li>
                <li>
                  <span className="muted">不重複詞</span>
                  <strong>{stats.unique}</strong>
                </li>
                <li>
                  <span className="muted">平均句長</span>
                  <strong>{stats.avgSentence || '—'}</strong>
                </li>
                <li>
                  <span className="muted">資料量</span>
                  <strong>{stats.bytes} bytes</strong>
                </li>
                <li>
                  <span className="muted">約略閱讀</span>
                  <strong>{stats.words ? `約 ${stats.readMin} 分` : '—'}</strong>
                </li>
                {fmt === 'html' && (
                  <li>
                    <span className="muted">HTML 標籤數</span>
                    <strong>{htmlTags}</strong>
                  </li>
                )}
              </ul>
              <p className="muted pw-hint">
                佔位文不具真實語意，僅供排版與流程預覽。亂數來自本機 crypto，不上傳。
              </p>
            </section>
          </aside>
        </div>

        <section className="panel lorem-history">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">產生歷史</h3>
            <ActionButton
              className="btn sm ghost"
              disabled={!history.length}
              onClick={() => {
                if (confirm('確定清空全部歷史？')) setHistory([])
              }}
            >
              清空
            </ActionButton>
          </div>
          <input
            className="field"
            placeholder="篩選預覽／模式／文風…"
            value={histFilter}
            maxLength={FILTER_MAX}
            onChange={(e) => setHistFilter(limitText(e.target.value, FILTER_MAX))}
          />
          {!filteredHistory.length && (
            <p className="muted" style={{ margin: 0 }}>
              尚無歷史，可按「產生並存歷史」
            </p>
          )}
          <ul className="lorem-history-list">
            {filteredHistory.map((h) => (
              <li key={h.id} className="lorem-history-card">
                <div className="pw-history-meta">
                  <span className="tag">{MODE_LABEL[h.mode]}</span>
                  <span className="tag">×{h.amount}</span>
                  <span className="tag">{FLAVOR_META[h.flavor]?.label ?? h.flavor}</span>
                  <span className="tag">{h.fmt === 'html' ? 'HTML' : h.fmt === 'markdown' ? 'MD' : 'TXT'}</span>
                </div>
                <p className="lorem-history-preview">{h.preview}…</p>
                <div className="muted pw-history-time">{new Date(h.at).toLocaleString('zh-TW')}</div>
                <div className="pw-history-actions">
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setMode(h.mode)
                      setAmount(h.amount)
                      setFlavor(h.flavor)
                      setFmt(h.fmt)
                      setStartLorem(h.startLorem)
                      setText(h.text)
                    }}
                    icon="check"
                  >
                    還原
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyText(wrapOutput(h.text, h.mode, h.fmt))}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton
                    onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                    label="刪除"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
