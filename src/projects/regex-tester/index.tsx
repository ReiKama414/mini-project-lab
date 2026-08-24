import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('regex-tester')!

const CHEATSHEET = [
  { syn: '.', desc: '任意字元（除換行，除非 s）' },
  { syn: '\\d \\w \\s', desc: '數字／單字字元／空白' },
  { syn: '\\b', desc: '單字邊界' },
  { syn: '^ $', desc: '行首／行尾（m 為每行）' },
  { syn: '* + ?', desc: '0+／1+／0 或 1 次' },
  { syn: '{n,m}', desc: '重複 n 到 m 次' },
  { syn: '[abc]', desc: '字元類' },
  { syn: '(…)', desc: '擷取群組' },
  { syn: '(?:…)', desc: '非擷取群組' },
  { syn: 'a|b', desc: '或' },
]

const FLAG_OPTS = [
  { f: 'g', label: '全域 g' },
  { f: 'i', label: '忽略大小寫 i' },
  { f: 'm', label: '多行 m' },
  { f: 's', label: '點含換行 s' },
  { f: 'u', label: 'Unicode u' },
]

export default function Page() {
  const [pattern, setPattern] = useLocalStorage('lab:regex-tester:pattern', '\\b[\\w.-]+@[\\w.-]+\\.\\w+\\b')
  const [flags, setFlags] = useLocalStorage('lab:regex-tester:flags', 'g')
  const [text, setText] = useLocalStorage(
    'lab:regex-tester:text',
    '聯絡：ada@example.com 與 lin@lab.tw\n錯誤：not-an-email\n測試 Test TEST',
  )
  const [mode, setMode] = useLocalStorage<'match' | 'replace'>('lab:regex-tester:mode', 'match')
  const [replacement, setReplacement] = useLocalStorage('lab:regex-tester:repl', '[$&]')
  const [showCheat, setShowCheat] = useState(true)

  function toggleFlag(f: string) {
    setFlags((prev) => (prev.includes(f) ? prev.replace(f, '') : prev + f))
  }

  const result = useMemo(() => {
    try {
      if (!pattern) return { ok: true as const, matches: [], highlighted: text, replaced: text, count: 0 }
      const flagSet = flags.includes('g') ? flags : `${flags}g`
      const reMatch = new RegExp(pattern, flagSet)
      const matches: { match: string; index: number; groups: string[]; named?: Record<string, string> }[] = []
      let m: RegExpExecArray | null
      while ((m = reMatch.exec(text)) !== null) {
        matches.push({
          match: m[0],
          index: m.index,
          groups: m.slice(1),
          named: m.groups as Record<string, string> | undefined,
        })
        if (m[0] === '') {
          reMatch.lastIndex++
          if (reMatch.lastIndex > text.length) break
        }
      }

      let highlighted = ''
      let last = 0
      for (const hit of matches) {
        highlighted += text.slice(last, hit.index)
        highlighted += `⟦${hit.match}⟧`
        last = hit.index + hit.match.length
      }
      highlighted += text.slice(last)

      let replaced = text
      if (mode === 'replace') {
        const reRepl = new RegExp(pattern, flags.includes('g') ? flags : flags)
        replaced = text.replace(reRepl, replacement)
      }

      return { ok: true as const, matches, highlighted, replaced, count: matches.length }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : '無效正規式' }
    }
  }, [pattern, flags, text, mode, replacement])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <button className={`btn sm ${mode === 'match' ? 'accent' : 'ghost'}`} onClick={() => setMode('match')}>
              匹配
            </button>
            <button className={`btn sm ${mode === 'replace' ? 'accent' : 'ghost'}`} onClick={() => setMode('replace')}>
              取代
            </button>
          </div>
          <label className="stack">
            <span className="label">Pattern</span>
            <input className="field mono" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {FLAG_OPTS.map(({ f, label }) => (
              <label key={f} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={flags.includes(f)} onChange={() => toggleFlag(f)} />
                {label}
              </label>
            ))}
          </div>
          <label className="stack">
            <span className="label">Flags 字串</span>
            <input className="field mono" value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ''))} />
          </label>
          {mode === 'replace' && (
            <label className="stack">
              <span className="label">取代字串（可用 $&、$1…）</span>
              <input className="field mono" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
            </label>
          )}
          <label className="stack">
            <span className="label">測試文字</span>
            <textarea className="field mono" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </div>
        <div className="panel stack">
          {!result.ok ? (
            <p className="tag" style={{ background: 'var(--rose)', color: '#fff' }}>
              {result.error}
            </p>
          ) : (
            <>
              <div className="metric">
                <div className="muted">匹配數：{result.count}</div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                  {result.highlighted}
                </pre>
                <button className="btn sm ghost" onClick={() => void copyText(result.highlighted)}>
                  複製標示結果
                </button>
              </div>
              {mode === 'replace' && (
                <div className="metric">
                  <div className="muted">取代結果</div>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap' }}>
                    {result.replaced}
                  </pre>
                  <button className="btn sm ghost" onClick={() => void copyText(result.replaced)}>
                    複製取代結果
                  </button>
                </div>
              )}
              <ul className="list">
                {result.matches.map((m, i) => (
                  <li key={i} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                    <span className="mono">
                      #{i + 1} @{m.index}: {m.match}
                    </span>
                    {m.groups.length > 0 && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        groups: {m.groups.map((g, gi) => `$${gi + 1}=${JSON.stringify(g)}`).join(' · ')}
                      </span>
                    )}
                    {m.named && Object.keys(m.named).length > 0 && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        named: {JSON.stringify(m.named)}
                      </span>
                    )}
                  </li>
                ))}
                {!result.matches.length && <p className="muted">無匹配</p>}
              </ul>
            </>
          )}
          <div className="stack">
            <button className="btn sm ghost" onClick={() => setShowCheat(!showCheat)}>
              {showCheat ? '收合速查表' : '展開速查表'}
            </button>
            {showCheat && (
              <ul className="list">
                {CHEATSHEET.map((c) => (
                  <li key={c.syn} className="list-item">
                    <code className="mono">{c.syn}</code>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {c.desc}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
