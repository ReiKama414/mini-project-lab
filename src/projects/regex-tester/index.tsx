import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText, copyText, isNonEmpty } from '../../lib/utils'

const meta = getProject('regex-tester')!

const PATTERN_MAX = 500
const TEXT_MAX = 20_000
const REPL_MAX = 500
const FLAGS_MAX = 10

type Mode = 'match' | 'replace'
type ViewMode = 'split' | 'edit' | 'result'

const PRESETS = [
  {
    label: 'Email',
    pattern: '\\b[\\w.-]+@[\\w.-]+\\.\\w+\\b',
    flags: 'g',
    text: '聯絡：ada@example.com 與 lin@lab.tw\n錯誤：not-an-email',
    replacement: '[$&]',
  },
  {
    label: 'URL',
    pattern: 'https?:\\/\\/[^\\s<>"\']+',
    flags: 'gi',
    text: '文件 https://example.com/docs 與 http://lab.tw/a?x=1\n不是網址：ftp://skip',
    replacement: '<$&>',
  },
  {
    label: 'ISO 日期',
    pattern: '\\b\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)?\\b',
    flags: 'g',
    text: '截止 2026-08-26、會議 2026-08-26T19:00:00+08:00\n無效：26/08/2026',
    replacement: '📅$&',
  },
  {
    label: '台灣手機',
    pattern: '09\\d{2}-?\\d{3}-?\\d{3}',
    flags: 'g',
    text: '電話 0912-345-678、0912345678\n市話 02-1234-5678',
    replacement: '***',
  },
  {
    label: 'Hex 色碼',
    pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b',
    flags: 'g',
    text: '主色 #2a9d8f、強調 #E76F51、無效 #gg0000',
    replacement: 'color($&)',
  },
  {
    label: '具名群組',
    pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
    flags: 'g',
    text: '日期 2026-09-22 與 1999-01-01',
    replacement: '$<day>/$<month>/$<year>',
  },
] as const

const CHEATSHEET = [
  { syn: '.', desc: '任意字元（除換行，除非 s）' },
  { syn: '\\d \\w \\s', desc: '數字／單字字元／空白' },
  { syn: '\\D \\W \\S', desc: '非數字／非單字／非空白' },
  { syn: '\\b \\B', desc: '單字邊界／非邊界' },
  { syn: '^ $', desc: '行首／行尾（m 為每行）' },
  { syn: '* + ?', desc: '0+／1+／0 或 1 次' },
  { syn: '{n,m}', desc: '重複 n 到 m 次' },
  { syn: '[abc] [^]', desc: '字元類／否定類' },
  { syn: '(…)', desc: '擷取群組 → $1' },
  { syn: '(?:…)', desc: '非擷取群組' },
  { syn: '(?<n>…)', desc: '具名群組 → $<n>' },
  { syn: '(?=…) (?!…)', desc: '正向／負向先行斷言' },
  { syn: 'a|b', desc: '或' },
  { syn: '$& $1', desc: '取代：整段匹配／群組' },
]

const FLAG_OPTS = [
  { f: 'g', label: '全域 g', hint: '找全部／取代全部' },
  { f: 'i', label: '忽略大小寫 i', hint: '不分大小寫' },
  { f: 'm', label: '多行 m', hint: '^ $ 對每行' },
  { f: 's', label: 'dotAll s', hint: '. 含換行' },
  { f: 'u', label: 'Unicode u', hint: '完整 Unicode' },
  { f: 'y', label: 'sticky y', hint: '從 lastIndex 接續' },
]

type MatchHit = {
  match: string
  index: number
  groups: string[]
  named?: Record<string, string>
}

function buildHighlightNodes(text: string, matches: MatchHit[]): ReactNode[] {
  if (!matches.length) return [text]
  const nodes: ReactNode[] = []
  let last = 0
  matches.forEach((hit, i) => {
    if (hit.index > last) nodes.push(text.slice(last, hit.index))
    nodes.push(
      <mark key={`m-${i}-${hit.index}`} className="rx-mark" title={`#${i + 1} @${hit.index}`}>
        {hit.match}
      </mark>,
    )
    last = hit.index + hit.match.length
  })
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function Page() {
  const [pattern, setPattern] = useLocalStorage<string>('lab:regex-tester:pattern', PRESETS[0]!.pattern)
  const [flags, setFlags] = useLocalStorage<string>('lab:regex-tester:flags', 'g')
  const [text, setText] = useLocalStorage<string>('lab:regex-tester:text', PRESETS[0]!.text)
  const [mode, setMode] = useLocalStorage<Mode>('lab:regex-tester:mode', 'match')
  const [replacement, setReplacement] = useLocalStorage<string>('lab:regex-tester:repl', '[$&]')
  const [view, setView] = useLocalStorage<ViewMode>('lab:regex-tester:view', 'split')
  const [copied, setCopied] = useState<string | null>(null)

  function toggleFlag(f: string) {
    setFlags((prev) => {
      const next = prev.includes(f) ? prev.replaceAll(f, '') : prev + f
      return limitText([...new Set(next.replace(/[^gimsuy]/g, '').split(''))].join(''), FLAGS_MAX)
    })
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    if (text.trim() && text !== p.text && !confirm('套用預設會覆蓋目前 pattern／文字，確定？')) return
    setPattern(p.pattern)
    setFlags(p.flags)
    setText(p.text)
    setReplacement(p.replacement)
    setMode('match')
  }

  const result = useMemo(() => {
    try {
      if (!pattern) {
        return {
          ok: true as const,
          matches: [] as MatchHit[],
          highlighted: [text] as ReactNode[],
          replaced: text,
          count: 0,
          matchedChars: 0,
        }
      }
      const matchFlags = flags.includes('g') ? flags : `${flags}g`
      const reMatch = new RegExp(pattern, matchFlags)
      const matches: MatchHit[] = []
      let m: RegExpExecArray | null
      while ((m = reMatch.exec(text)) !== null) {
        matches.push({
          match: m[0],
          index: m.index,
          groups: m.slice(1).map((g) => (g == null ? '' : String(g))),
          named: m.groups as Record<string, string> | undefined,
        })
        if (m[0] === '') {
          reMatch.lastIndex++
          if (reMatch.lastIndex > text.length) break
        }
      }

      const highlighted = buildHighlightNodes(text, matches)
      const matchedChars = matches.reduce((n, hit) => n + hit.match.length, 0)

      let replaced = text
      if (mode === 'replace') {
        const reRepl = new RegExp(pattern, flags)
        replaced = text.replace(reRepl, replacement)
      }

      return {
        ok: true as const,
        matches,
        highlighted,
        replaced,
        count: matches.length,
        matchedChars,
      }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : '無效正規式' }
    }
  }, [pattern, flags, text, mode, replacement])

  const coverage =
    result.ok && text.length > 0 ? Math.min(100, (result.matchedChars / text.length) * 100) : 0
  const avgLen =
    result.ok && result.count > 0 ? result.matchedChars / result.count : 0
  const groupCount = result.ok && result.matches[0] ? result.matches[0].groups.length : 0
  const namedCount =
    result.ok && result.matches[0]?.named ? Object.keys(result.matches[0].named).length : 0

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const literal = result.ok && isNonEmpty(pattern) ? `/${pattern}/${flags}` : ''

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row rx-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!literal}
            onClick={() => void copyVal(literal, 'lit')}
            icon="copy"
          >
            {copied === 'lit' ? '已複製' : '複製 /pattern/flags'}
          </ActionButton>
          {mode === 'replace' && result.ok && (
            <ActionButton
              className="btn sm ghost"
              onClick={() => void copyVal(result.replaced, 'repl')}
              icon="copy"
            >
              {copied === 'repl' ? '已複製' : '複製取代結果'}
            </ActionButton>
          )}
        </div>
      }
    >
      <div className="rx-calc">
        <div className="pw-stats">
          <span className={`metric ${result.ok ? '' : 'warn'}`}>
            {result.ok ? `${result.count} 筆匹配` : '語法錯誤'}
          </span>
          <span className="tag">/{flags || '—'}/</span>
          <span className="tag">{mode === 'match' ? '匹配' : '取代'}</span>
          {result.ok && <span className="tag">覆蓋 {coverage.toFixed(1)}%</span>}
          <span className="tag mono">{charCount(text).toLocaleString()} 字</span>
        </div>

        <div className="panel rx-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row rx-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '編輯'],
                  ['result', '結果'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${view === id ? 'accent' : 'ghost'}`}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="row rx-mode-row">
            <button
              type="button"
              className={`btn sm ${mode === 'match' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('match')}
            >
              匹配
            </button>
            <button
              type="button"
              className={`btn sm ${mode === 'replace' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('replace')}
            >
              取代
            </button>
          </div>

          <div className="pw-block">
            <div className="label">預設</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn sm ghost" onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`rx-main rx-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel rx-editor">
              <h3 className="pw-panel-title">編輯</h3>

              <label className="stack">
                <span className="label">Pattern</span>
                <input
                  className={`field mono${!result.ok ? ' is-invalid' : ''}`}
                  value={pattern}
                  maxLength={PATTERN_MAX}
                  spellCheck={false}
                  onChange={(e) => setPattern(limitText(e.target.value, PATTERN_MAX))}
                  placeholder="\\b\\w+@\\w+\\.\\w+\\b"
                />
                <div className="field-meta">
                  <span>
                    {charCount(pattern)} / {PATTERN_MAX}
                  </span>
                  {literal && <code className="mono muted">{literal}</code>}
                </div>
              </label>

              <div className="pw-block">
                <div className="label">Flags</div>
                <div className="rx-flags">
                  {FLAG_OPTS.map(({ f, label, hint }) => (
                    <label key={f} className="rx-flag" title={hint}>
                      <input type="checkbox" checked={flags.includes(f)} onChange={() => toggleFlag(f)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <input
                  className="field mono"
                  value={flags}
                  maxLength={FLAGS_MAX}
                  spellCheck={false}
                  onChange={(e) =>
                    setFlags(limitText(e.target.value.replace(/[^gimsuy]/g, ''), FLAGS_MAX))
                  }
                  aria-label="Flags 字串"
                />
              </div>

              {mode === 'replace' && (
                <label className="stack">
                  <span className="label">取代字串（$&、$1…、$&lt;name&gt;）</span>
                  <input
                    className="field mono"
                    value={replacement}
                    maxLength={REPL_MAX}
                    spellCheck={false}
                    onChange={(e) => setReplacement(limitText(e.target.value, REPL_MAX))}
                  />
                  <div className="field-meta">
                    <span>
                      {charCount(replacement)} / {REPL_MAX}
                    </span>
                    {!flags.includes('g') && (
                      <span className="muted">未開 g 時只取代第一筆</span>
                    )}
                  </div>
                </label>
              )}

              <label className="stack" style={{ flex: 1 }}>
                <span className="label">測試文字</span>
                <textarea
                  className="field mono rx-textarea"
                  value={text}
                  maxLength={TEXT_MAX}
                  spellCheck={false}
                  onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
                  aria-label="測試文字"
                />
                <div className="field-meta">
                  <span>
                    {charCount(text).toLocaleString()} / {TEXT_MAX.toLocaleString()}
                  </span>
                </div>
              </label>
            </section>
          )}

          {(view === 'split' || view === 'result') && (
            <section className="panel rx-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">結果</h3>
                {result.ok && <span className="tag">{result.count} 筆</span>}
              </div>

              {!result.ok ? (
                <p className="field-error">{result.error}</p>
              ) : (
                <>
                  <div className="label">高亮預覽</div>
                  <pre className="rx-highlight mono">{result.highlighted}</pre>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => void copyVal(text, 'text')}
                      icon="copy"
                    >
                      {copied === 'text' ? '已複製' : '複製原文'}
                    </ActionButton>
                    {mode === 'replace' && (
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(result.replaced, 'repl')}
                        icon="copy"
                      >
                        {copied === 'repl' ? '已複製' : '複製取代結果'}
                      </ActionButton>
                    )}
                  </div>

                  {mode === 'replace' && (
                    <>
                      <div className="label">取代結果</div>
                      <pre className="rx-replaced mono">{result.replaced}</pre>
                    </>
                  )}

                  <div className="label">匹配列表</div>
                  <ul className="rx-match-list">
                    {result.matches.map((m, i) => (
                      <li key={`${m.index}-${i}`}>
                        <div className="rx-match-head">
                          <span className="tag">#{i + 1}</span>
                          <span className="muted mono">@{m.index}</span>
                          <code className="mono rx-match-text">{m.match || '（空匹配）'}</code>
                          <ActionButton
                            className="btn sm ghost"
                            onClick={() => void copyVal(m.match, `m-${i}`)}
                            icon="copy"
                            iconOnly
                            tooltip={copied === `m-${i}` ? '已複製' : '複製'}
                          />
                        </div>
                        {m.groups.some((g) => g !== '') && (
                          <div className="rx-groups">
                            {m.groups.map((g, gi) => (
                              <span key={gi} className="tag mono">
                                ${gi + 1}={JSON.stringify(g)}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.named && Object.keys(m.named).length > 0 && (
                          <div className="rx-groups">
                            {Object.entries(m.named).map(([k, v]) => (
                              <span key={k} className="tag mono">
                                {`$<${k}>`}={JSON.stringify(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                    {!result.matches.length && (
                      <li className="muted" style={{ listStyle: 'none' }}>
                        無匹配
                      </li>
                    )}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>

        <div className="rx-bottom">
          <section className="panel rx-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            {result.ok ? (
              <ul className="pw-info-list">
                <li>
                  <span className="muted">匹配數</span>
                  <strong className="mono">{result.count}</strong>
                </li>
                <li>
                  <span className="muted">匹配字元總長</span>
                  <strong className="mono">{result.matchedChars.toLocaleString()}</strong>
                </li>
                <li>
                  <span className="muted">覆蓋率</span>
                  <strong className="mono">{coverage.toFixed(2)}%</strong>
                </li>
                <li>
                  <span className="muted">平均匹配長度</span>
                  <strong className="mono">{avgLen ? avgLen.toFixed(1) : '—'}</strong>
                </li>
                <li>
                  <span className="muted">擷取群組數</span>
                  <strong className="mono">{groupCount}</strong>
                </li>
                <li>
                  <span className="muted">具名群組數</span>
                  <strong className="mono">{namedCount}</strong>
                </li>
                <li>
                  <span className="muted">Flags</span>
                  <strong className="mono">{flags || '（無）'}</strong>
                </li>
                <li>
                  <span className="muted">Literal</span>
                  <strong className="mono">{literal || '—'}</strong>
                </li>
                <li>
                  <span className="muted">引擎</span>
                  <strong>JavaScript RegExp</strong>
                </li>
              </ul>
            ) : (
              <p className="field-error" style={{ margin: 0 }}>
                {result.error}
              </p>
            )}
            <p className="muted pw-hint">
              預覽為求完整列表會以含 <code>g</code> 掃描；取代則依你設定的 flags（未開 g 只替換第一筆）。內容存於本機。
            </p>
          </section>

          <section className="panel rx-cheat">
            <h3 className="pw-panel-title">語法速查</h3>
            <ul className="rx-cheat-list">
              {CHEATSHEET.map((c) => (
                <li key={c.syn}>
                  <code className="mono">{c.syn}</code>
                  <span className="muted">{c.desc}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
