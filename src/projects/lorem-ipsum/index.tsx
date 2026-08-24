import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('lorem-ipsum')!

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

export default function Page() {
  const [mode, setMode] = useLocalStorage<Mode>('lab:lorem-ipsum:mode', 'paragraphs')
  const [amount, setAmount] = useLocalStorage('lab:lorem-ipsum:amount', 3)
  const [startLorem, setStartLorem] = useLocalStorage('lab:lorem-ipsum:start', true)
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  function generate() {
    const n = Math.min(100, Math.max(1, amount))
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
  }

  const amountLabel =
    mode === 'paragraphs' ? '段落數' : mode === 'sentences' ? '句子數' : '單字數'

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          {(
            [
              ['paragraphs', '段落'],
              ['sentences', '句子'],
              ['words', '單字'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              className={`btn sm ${mode === m ? 'accent' : 'ghost'}`}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="stack">
          <span className="label">
            {amountLabel}（1–100）
          </span>
          <input
            className="field"
            type="number"
            min={1}
            max={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={startLorem}
            onChange={(e) => setStartLorem(e.target.checked)}
          />
          以「Lorem ipsum dolor sit amet」開頭
        </label>
        <div className="row">
          <button className="btn accent" onClick={generate}>
            產生
          </button>
          <button
            className="btn ghost"
            disabled={!text}
            onClick={async () => {
              await copyText(text)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button
            className="btn ghost"
            disabled={!text}
            onClick={() => downloadText('lorem.txt', text)}
          >
            下載
          </button>
        </div>
        {text ? (
          <pre className="metric" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', maxHeight: 420, overflow: 'auto' }}>
            {text}
          </pre>
        ) : (
          <p className="muted">選擇模式後點擊產生假文</p>
        )}
      </div>
    </ProjectShell>
  )
}
