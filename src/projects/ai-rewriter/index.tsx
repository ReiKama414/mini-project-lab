import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-rewriter')!

const INPUT_MAX = 10000

type Mode = 'shorten' | 'expand' | 'formal' | 'casual' | 'bullet' | 'en'

const MODE_LABEL: Record<Mode, string> = {
  shorten: '精簡',
  expand: '擴寫',
  formal: '正式',
  casual: '口語',
  bullet: '條列',
  en: '英譯示範',
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
            .replace(/搞定|弄好/g, '完成')
            .replace(/一下/g, ''),
        )
        .join('')
    case 'casual':
      return `說真的，${t
        .replace(/因此|故|據此/g, '所以')
        .replace(/進行/g, '做')
        .replace(/本人認為/g, '我覺得')}`
    case 'shorten':
      return sentences
        .slice(0, Math.max(1, Math.ceil(sentences.length / 2)))
        .map((s) => s.replace(/，[^，]{10,}，/g, '，').replace(/\s+/g, ' ').slice(0, 120))
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
    case 'en':
      return [
        '（英譯示範，非正式機器翻譯）',
        t
          .replace(/我覺得/g, 'I think ')
          .replace(/我們可以/g, 'we could ')
          .replace(/然後/g, 'then ')
          .replace(/本週/g, 'this week ')
          .replace(/討論/g, 'discuss ')
          .replace(/細節/g, 'the details'),
        '',
        'Suggested polish: Clarify the goal, owner, and deadline in one sentence.',
      ].join('\n')
    default:
      return t
  }
}

type Hist = { at: number; mode: Mode; input: string; output: string }

export default function Page() {
  const [input, setInput] = useLocalStorage(
    'lab:ai-rewriter',
    '我覺得這個方案還不錯，我們可以再討論一下細節，然後看看能不能本週開始。',
  )
  const [mode, setMode] = useLocalStorage<Mode>('lab:ai-rewriter:mode', 'formal')
  const [out, setOut] = useState('')
  const [auto, setAuto] = useLocalStorage('lab:ai-rewriter:auto', true)
  const [history, setHistory] = useLocalStorage<Hist[]>('lab:ai-rewriter:history', [])

  useEffect(() => {
    if (!auto) return
    setOut(rewrite(input, mode))
  }, [input, mode, auto])

  const delta = useMemo(() => {
    if (!out) return null
    const d = out.length - input.length
    return d === 0 ? '字數相近' : d > 0 ? `+${d} 字` : `${d} 字`
  }, [input, out])

  function run() {
    if (!isNonEmpty(input)) return
    const result = rewrite(limitText(input, INPUT_MAX), mode)
    setOut(result)
    if (result) {
      setHistory((h) =>
        [{ at: Date.now(), mode, input: limitText(input, INPUT_MAX), output: result }, ...h].slice(0, 12),
      )
    }
  }

  const canRun = isNonEmpty(input)

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button
          type="button"
          className="btn ghost sm"
          disabled={!out}
          onClick={() => downloadText('rewrite.txt', `【原文】\n${input}\n\n【改寫｜${MODE_LABEL[mode]}】\n${out}`)}
        >
          下載對照
        </button>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <label className="label">改寫模式</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn sm ${mode === m ? 'accent' : 'ghost'}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="row">
            <input type="checkbox" checked={auto} onChange={() => setAuto(!auto)} />
            即時改寫
          </label>
          {!auto && (
            <button type="button" className="btn accent" onClick={run} disabled={!canRun}>
              改寫
            </button>
          )}
          {auto && (
            <button type="button" className="btn ghost sm" onClick={run} disabled={!canRun}>
              存入歷史
            </button>
          )}
          {delta && <span className="tag">{delta}</span>}
        </div>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <span className="label">改寫前</span>
            <span className="muted mono">{charCount(input)}/{INPUT_MAX}</span>
          </div>
          <textarea
            className={cn('field', !canRun && 'is-invalid')}
            rows={12}
            maxLength={INPUT_MAX}
            value={input}
            onChange={(e) => setInput(limitText(e.target.value, INPUT_MAX))}
          />
          <div className="field-meta">
            <span className={!canRun ? 'warn' : undefined}>{canRun ? '可改寫' : '請輸入原文'}</span>
            <span className="field-hint">上限 {INPUT_MAX.toLocaleString()} 字</span>
          </div>
          {!canRun && <p className="field-error">原文不可空白</p>}
        </div>
        <div className="panel stack">
          <div className="row">
            <span className="label">改寫後 · {MODE_LABEL[mode]}</span>
            <span className="muted mono">{out.length} 字</span>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => void copyText(out)}>
              複製結果
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, minHeight: 240 }}>
            {out || '選擇模式後顯示結果'}
          </pre>
        </div>
      </div>
      {!!history.length && (
        <div className="panel stack" style={{ marginTop: 12 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>歷史</h3>
            <button type="button" className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          <ul className="list">
            {history.map((h) => (
              <li key={h.at} className="list-item">
                <span className="tag">{MODE_LABEL[h.mode]}</span>
                <span style={{ flex: 1 }} className="muted">
                  {new Date(h.at).toLocaleString()} · {h.output.slice(0, 40)}…
                </span>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    setInput(h.input)
                    setMode(h.mode)
                    setOut(h.output)
                  }}
                >
                  還原
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProjectShell>
  )
}
