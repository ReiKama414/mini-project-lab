import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('ai-rewriter')!

type Mode = 'shorten' | 'expand' | 'formal' | 'casual' | 'bullet'

const MODE_LABEL: Record<Mode, string> = {
  shorten: '精簡',
  expand: '擴寫',
  formal: '正式',
  casual: '口語',
  bullet: '條列',
}

function rewrite(text: string, mode: Mode) {
  const t = text.trim()
  if (!t) return ''
  const sentences = t
    .split(/(?<=[。！？.!?])/)
    .map((s) => s.trim())
    .filter(Boolean)

  switch (mode) {
    case 'formal':
      return sentences
        .map((s) =>
          s
            .replace(/我覺得|我認為/g, '本人認為')
            .replace(/超|很|蠻/g, '相當')
            .replace(/啦|喔|呀|欸/g, '')
            .replace(/搞定|弄好/g, '完成'),
        )
        .join('')
    case 'casual':
      return `說真的，${t.replace(/因此|故|據此/g, '所以').replace(/進行/g, '做').replace(/本人認為/g, '我覺得')}`
    case 'shorten':
      return sentences
        .slice(0, Math.max(1, Math.ceil(sentences.length / 2)))
        .map((s) => s.replace(/，[^，]{10,}，/g, '，').replace(/\s+/g, ' ').slice(0, 100))
        .join(sentences[0]?.includes('。') ? '' : ' ')
    case 'expand':
      return [
        t,
        '',
        '補充說明：可拆成背景、作法與預期成果三部分，方便對齊。',
        '落地建議：先定義成功指標與時程，再分配負責人。',
        '風險提醒：範圍蔓延時優先保護核心交付。',
      ].join('\n')
    case 'bullet': {
      const parts =
        sentences.length > 1
          ? sentences
          : t.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      return parts.map((p) => `• ${p.replace(/[。．.]$/, '')}`).join('\n')
    }
    default:
      return t
  }
}

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:ai-rewriter',
    '我覺得這個方案還不錯，我們可以再討論一下細節，然後看看能不能本週開始。',
  )
  const [mode, setMode] = useLocalStorage<Mode>('lab:ai-rewriter:mode', 'formal')
  const [out, setOut] = useState('')

  function run() {
    setOut(rewrite(input, mode))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <label className="label">改寫模式</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <button key={m} type="button" className={`btn sm ${mode === m ? 'accent' : 'ghost'}`} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <button type="button" className="btn accent" onClick={run}>
          改寫
        </button>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <span className="label">改寫前</span>
            <span className="muted mono">{input.length} 字</span>
          </div>
          <textarea className="field" rows={12} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="label">改寫後</span>
            <span className="muted mono">{out.length} 字</span>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => copyText(out)}>
              複製結果
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, minHeight: 240 }}>
            {out || '選擇模式後按「改寫」，左右對照'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
