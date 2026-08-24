import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('ai-rewriter')!

type Mode = '正式' | '口語' | '精簡' | '擴寫' | '更有力'

function rewrite(text: string, mode: Mode) {
  const t = text.trim()
  if (!t) return ''
  const sentences = t.split(/(?<=[。！？.!?])/).map((s) => s.trim()).filter(Boolean)
  switch (mode) {
    case '正式':
      return sentences
        .map((s) => s.replace(/我覺得|我認為/g, '本人認為').replace(/超|很|蠻/g, '相當').replace(/啦|喔|呀/g, ''))
        .join('')
    case '口語':
      return `說真的，${t.replace(/因此|故|據此/g, '所以').replace(/進行/g, '做')}`
    case '精簡':
      return sentences
        .slice(0, Math.max(1, Math.ceil(sentences.length / 2)))
        .map((s) => s.replace(/，[^，]{8,}，/g, '，').slice(0, 80))
        .join(' ')
    case '擴寫':
      return `${t}\n\n補充說明：上述重點可再拆解為背景、作法與預期成果三部分，以利溝通對齊。若需落地，建議先定義成功指標與時程。`
    case '更有力':
      return `重點一次說清楚：${sentences[0] || t}\n\n接下來要做的是——${sentences.slice(1).join(' ') || '立刻採取明確行動，並追蹤結果。'}`
    default:
      return t
  }
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:ai-rewriter', '我覺得這個方案還不錯，我們可以再討論一下細節，然後看看能不能本週開始。')
  const [mode, setMode] = useLocalStorage<Mode>('lab:ai-rewriter:mode', '正式')
  const [out, setOut] = useState('')

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">原文</label>
          <textarea className="field" rows={10} value={input} onChange={(e) => setInput(e.target.value)} />
          <label className="label">改寫模式</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['正式', '口語', '精簡', '擴寫', '更有力'] as Mode[]).map((m) => (
              <button key={m} type="button" className={`btn sm ${mode === m ? 'accent' : 'ghost'}`} onClick={() => setMode(m)}>
                {m}
              </button>
            ))}
          </div>
          <button type="button" className="btn accent" onClick={() => setOut(rewrite(input, mode))}>
            改寫
          </button>
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="label">結果</span>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => copyText(out)}>
              複製
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {out || '選擇模式後按「改寫」'}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
