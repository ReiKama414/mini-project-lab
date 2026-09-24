import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'filename-cleaner',
  title: '檔名清理器',
  description: '移除非法字元、正規化空白與批次預覽',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['file'],
}
const meta = getProject('filename-cleaner') ?? fallback

const NAME_MAX = 2_000
const BATCH_MAX = 50_000
const FILE_MAX = 5 * 1024 * 1024
const MAX_FILES = 80
const WIN_ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

type SpaceMode = 'dash' | 'underscore' | 'remove' | 'keep'
type CaseMode = 'keep' | 'lower' | 'upper' | 'title'
type ViewMode = 'split' | 'edit' | 'result'

type CleanOpts = {
  spaceMode: SpaceMode
  caseMode: CaseMode
  preserveExt: boolean
  collapseSep: boolean
  stripEdges: boolean
  nfkc: boolean
  stripDiacritics: boolean
  maxLen: number
  find: string
  replace: string
}

type CleanResult = {
  original: string
  cleaned: string
  changed: boolean
  ext: string
  base: string
  removedIllegal: number
  warnings: string[]
}

const SAMPLES = [
  { label: '空白與驚嘆', value: 'My File (最終版)!!!  .PDF' },
  { label: '非法字元', value: 'report<>:"/\\|?*.docx' },
  { label: '日文混排', value: '写真 2024／家族旅行.JPG' },
  { label: '多點與空白', value: '  draft... final  .  txt  ' },
  { label: '保留裝置名', value: 'CON.txt' },
]

const BATCH_SAMPLE = `My File (最終版)!!!  .PDF
report<>:"/\\|?*.docx
写真 2024／家族旅行.JPG
  draft... final  .  txt  
CON.txt`

function splitName(name: string) {
  const trimmed = name.replace(/\r/g, '')
  const dot = trimmed.lastIndexOf('.')
  if (dot > 0 && dot < trimmed.length - 1) {
    return { base: trimmed.slice(0, dot), ext: trimmed.slice(dot) }
  }
  return { base: trimmed, ext: '' }
}

function stripDiacritic(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function titleCase(s: string) {
  return s
    .split(/([-_]+)/)
    .map((part) => {
      if (/^[-_]+$/.test(part) || !part) return part
      return part
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ')
    })
    .join('')
}

function applySpace(s: string, mode: SpaceMode) {
  if (mode === 'keep') return s.replace(/[ \t]+/g, ' ')
  if (mode === 'remove') return s.replace(/\s+/g, '')
  const sep = mode === 'dash' ? '-' : '_'
  return s.replace(/\s+/g, sep)
}

function cleanFilename(raw: string, opts: CleanOpts): CleanResult {
  const original = raw
  let working = raw.replace(/\r/g, '')
  const warnings: string[] = []

  if (opts.nfkc) working = working.normalize('NFKC')
  if (opts.stripDiacritics) working = stripDiacritic(working)

  const parts = opts.preserveExt ? splitName(working) : { base: working, ext: '' }
  let base = parts.base
  let ext = parts.ext

  const beforeIllegal = base.length + ext.length
  base = base.replace(WIN_ILLEGAL, '')
  ext = ext.replace(WIN_ILLEGAL, '')
  // fullwidth slash etc already handled by NFKC often; also strip remaining path-ish
  base = base.replace(/[／＼]/g, '-')
  const removedIllegal = Math.max(0, beforeIllegal - (base.length + ext.length))

  if (opts.find) base = base.split(opts.find).join(opts.replace)

  base = applySpace(base, opts.spaceMode)

  if (opts.collapseSep) {
    base = base.replace(/-+/g, '-').replace(/_+/g, '_').replace(/[.]+/g, '.')
    base = base.replace(/-_/g, '-').replace(/_-/g, '_')
  }

  if (opts.stripEdges) {
    base = base.replace(/^[\s._-]+|[\s._-]+$/g, '')
    ext = ext.replace(/^\.+/, '.')
  }

  if (opts.caseMode === 'lower') {
    base = base.toLowerCase()
    ext = ext.toLowerCase()
  } else if (opts.caseMode === 'upper') {
    base = base.toUpperCase()
    ext = ext.toUpperCase()
  } else if (opts.caseMode === 'title') {
    base = titleCase(base)
    ext = ext.toLowerCase()
  }

  let cleaned = `${base}${ext}` || 'untitled'

  if (opts.maxLen > 0 && cleaned.length > opts.maxLen) {
    if (ext && opts.preserveExt) {
      const keep = Math.max(1, opts.maxLen - ext.length)
      cleaned = `${base.slice(0, keep)}${ext}`
    } else {
      cleaned = cleaned.slice(0, opts.maxLen)
    }
    warnings.push(`已截斷至 ${opts.maxLen} 字元`)
  }

  const stem = splitName(cleaned).base
  if (RESERVED.test(stem)) {
    cleaned = `_${cleaned}`
    warnings.push('避開 Windows 保留名稱')
  }

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    cleaned = 'untitled'
    warnings.push('空白結果已改為 untitled')
  }

  return {
    original,
    cleaned,
    changed: original !== cleaned,
    ext: splitName(cleaned).ext,
    base: splitName(cleaned).base,
    removedIllegal,
    warnings,
  }
}

function analyzeBatch(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
}

export default function Page() {
  const [input, setInput] = useLocalStorage('lab:filename-cleaner:input', 'My File (最終版)!!!  .PDF')
  const [batchIn, setBatchIn] = useLocalStorage('lab:filename-cleaner:batch', '')
  const [spaceMode, setSpaceMode] = useLocalStorage<SpaceMode>('lab:filename-cleaner:space', 'dash')
  const [caseMode, setCaseMode] = useLocalStorage<CaseMode>('lab:filename-cleaner:case', 'keep')
  const [preserveExt, setPreserveExt] = useLocalStorage('lab:filename-cleaner:ext', true)
  const [collapseSep, setCollapseSep] = useLocalStorage('lab:filename-cleaner:collapse', true)
  const [stripEdges, setStripEdges] = useLocalStorage('lab:filename-cleaner:edges', true)
  const [nfkc, setNfkc] = useLocalStorage('lab:filename-cleaner:nfkc', true)
  const [stripDia, setStripDia] = useLocalStorage('lab:filename-cleaner:dia', false)
  const [maxLen, setMaxLen] = useLocalStorage('lab:filename-cleaner:maxlen', 120)
  const [find, setFind] = useLocalStorage('lab:filename-cleaner:find', '')
  const [replace, setReplace] = useLocalStorage('lab:filename-cleaner:replace', '')
  const [view, setView] = useLocalStorage<ViewMode>('lab:filename-cleaner:view', 'split')
  const [mode, setMode] = useLocalStorage<'single' | 'batch'>('lab:filename-cleaner:mode', 'single')

  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')

  const opts: CleanOpts = useMemo(
    () => ({
      spaceMode,
      caseMode,
      preserveExt,
      collapseSep,
      stripEdges,
      nfkc,
      stripDiacritics: stripDia,
      maxLen: Math.max(0, Math.min(255, Number(maxLen) || 0)),
      find,
      replace,
    }),
    [spaceMode, caseMode, preserveExt, collapseSep, stripEdges, nfkc, stripDia, maxLen, find, replace],
  )

  const single = useMemo(() => cleanFilename(limitText(input, NAME_MAX), opts), [input, opts])

  const batchRows = useMemo(() => {
    const lines = analyzeBatch(limitText(batchIn, BATCH_MAX)).slice(0, 500)
    const used = new Set<string>()
    return lines.map((line) => {
      const r = cleanFilename(line, opts)
      let name = r.cleaned
      const warnings = [...r.warnings]
      if (used.has(name.toLowerCase())) {
        let n = 1
        const { base, ext } = splitName(name)
        let candidate = `${base}-${n}${ext}`
        while (used.has(candidate.toLowerCase())) {
          n++
          candidate = `${base}-${n}${ext}`
        }
        name = candidate
        warnings.push('批次重名已加序號')
      }
      used.add(name.toLowerCase())
      return { ...r, cleaned: name, changed: line !== name, warnings }
    })
  }, [batchIn, opts])

  const batchStats = useMemo(() => {
    const changed = batchRows.filter((r) => r.changed).length
    const illegal = batchRows.reduce((s, r) => s + r.removedIllegal, 0)
    return { total: batchRows.length, changed, illegal }
  }, [batchRows])

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function resetDefaults() {
    setSpaceMode('dash')
    setCaseMode('keep')
    setPreserveExt(true)
    setCollapseSep(true)
    setStripEdges(true)
    setNfkc(true)
    setStripDia(false)
    setMaxLen(120)
    setFind('')
    setReplace('')
    setHint('已還原預設規則')
    setError('')
  }

  function onFiles(files: File[]) {
    if (!files.length) return
    if (files.length === 1 && mode === 'single') {
      setInput(limitText(files[0]!.name, NAME_MAX))
      setHint(`已載入檔名「${files[0]!.name}」`)
      setError('')
      return
    }
    const names = files
      .slice(0, MAX_FILES)
      .map((f) => f.name)
      .join('\n')
    setBatchIn(limitText(names, BATCH_MAX))
    setMode('batch')
    setHint(`已載入 ${Math.min(files.length, MAX_FILES)} 個檔名`)
    setError('')
  }

  function downloadBatch() {
    if (!batchRows.length) return
    const body = ['original,cleaned,changed', ...batchRows.map((r) => `"${r.original.replace(/"/g, '""')}","${r.cleaned.replace(/"/g, '""')}",${r.changed}`)].join(
      '\n',
    )
    downloadText('filename-clean.csv', body, 'text/csv;charset=utf-8')
  }

  const invalid = mode === 'single' ? !isNonEmpty(input) : !batchRows.length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row fnc-shell-actions">
          <ActionButton className="btn sm ghost" onClick={resetDefaults} icon="reset">
            預設
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={invalid}
            onClick={() => void copyVal(mode === 'single' ? single.cleaned : batchRows.map((r) => r.cleaned).join('\n'), 'main')}
            icon="copy"
          >
            {copied === 'main' ? '已複製' : mode === 'single' ? '複製結果' : '複製全部'}
          </ActionButton>
        </div>
      }
    >
      <div className="fnc-calc">
        <div className="panel fnc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row fnc-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '設定'],
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

          <div className="pw-stats">
            <span className="tag">{mode === 'single' ? '單檔' : `批次 ${batchStats.total}`}</span>
            {mode === 'single' ? (
              <>
                <span className="tag">{charCount(input)} → {charCount(single.cleaned)}</span>
                <span className={`tag${single.changed ? '' : ' muted'}`}>{single.changed ? '已變更' : '無變更'}</span>
                {single.removedIllegal > 0 && <span className="tag fnc-tag-warn">移除 {single.removedIllegal} 非法字</span>}
                {single.ext && <span className="tag mono">{single.ext}</span>}
              </>
            ) : (
              <>
                <span className="tag">{batchStats.changed} 筆變更</span>
                {batchStats.illegal > 0 && <span className="tag fnc-tag-warn">非法字 {batchStats.illegal}</span>}
              </>
            )}
          </div>

          <div className="row fnc-mode-row">
            <button
              type="button"
              className={`btn sm ${mode === 'single' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('single')}
            >
              單檔
            </button>
            <button
              type="button"
              className={`btn sm ${mode === 'batch' ? 'accent' : 'ghost'}`}
              onClick={() => setMode('batch')}
            >
              批次
            </button>
          </div>

          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setMode('single')
                    setInput(s.value)
                    setHint(`已套用「${s.label}」`)
                    setError('')
                  }}
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setMode('batch')
                  setBatchIn(BATCH_SAMPLE)
                  setHint('已載入批次範例')
                  setError('')
                }}
              >
                批次範例
              </button>
            </div>
          </div>
        </div>

        <div className={`fnc-main fnc-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel fnc-settings">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">輸入與規則</h3>
                <ActionButton
                  className="btn sm ghost"
                  icon="trash"
                  disabled={mode === 'single' ? !input : !batchIn}
                  onClick={() => {
                    if (mode === 'single') setInput('')
                    else setBatchIn('')
                    setHint('')
                    setError('')
                  }}
                >
                  清除
                </ActionButton>
              </div>

              {error && <p className="field-error">{error}</p>}
              {hint && !error && <p className="field-hint">{hint}</p>}

              <FileDrop
                multiple
                maxFiles={MAX_FILES}
                maxBytes={FILE_MAX}
                label="拖放檔案（可多選，僅取檔名）"
                hint={`上限 ${MAX_FILES} 個 · 單檔 ${formatBytes(FILE_MAX)} · 不讀內容`}
                onFiles={onFiles}
              />

              {mode === 'single' ? (
                <label className="stack">
                  <span className="label">原始檔名</span>
                  <input
                    className={`field mono${!isNonEmpty(input) ? ' is-invalid' : ''}`}
                    value={input}
                    maxLength={NAME_MAX}
                    spellCheck={false}
                    onChange={(e) => {
                      setInput(limitText(e.target.value, NAME_MAX))
                      setError('')
                    }}
                    aria-label="原始檔名"
                  />
                  <div className="field-meta">
                    <span>
                      {charCount(input)} / {NAME_MAX}
                    </span>
                  </div>
                </label>
              ) : (
                <label className="stack">
                  <span className="label">批次檔名（每行一個）</span>
                  <textarea
                    className="field mono fnc-batch-input"
                    value={batchIn}
                    maxLength={BATCH_MAX}
                    spellCheck={false}
                    onChange={(e) => setBatchIn(limitText(e.target.value, BATCH_MAX))}
                    placeholder={'file one.pdf\nreport final!!.docx'}
                    aria-label="批次檔名"
                  />
                  <div className="field-meta">
                    <span>最多顯示 500 行</span>
                    <span>
                      {charCount(batchIn).toLocaleString()} / {BATCH_MAX.toLocaleString()}
                    </span>
                  </div>
                </label>
              )}

              <div className="fnc-controls">
                <div className="pw-block">
                  <div className="label">空白處理</div>
                  <div className="pw-chips">
                    {(
                      [
                        ['dash', '轉 -'],
                        ['underscore', '轉 _'],
                        ['remove', '移除'],
                        ['keep', '保留'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn sm ${spaceMode === id ? 'accent' : 'ghost'}`}
                        onClick={() => setSpaceMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pw-block">
                  <div className="label">大小寫</div>
                  <div className="pw-chips">
                    {(
                      [
                        ['keep', '維持'],
                        ['lower', '小寫'],
                        ['upper', '大寫'],
                        ['title', '字首大寫'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn sm ${caseMode === id ? 'accent' : 'ghost'}`}
                        onClick={() => setCaseMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pw-block">
                  <div className="label">長度上限</div>
                  <div className="pw-chips">
                    {[0, 64, 100, 120, 200, 255].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`btn sm ${Number(maxLen) === n ? 'accent' : 'ghost'}`}
                        onClick={() => setMaxLen(n)}
                      >
                        {n === 0 ? '不限' : n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fnc-checks">
                  <label className="fnc-check">
                    <input type="checkbox" checked={preserveExt} onChange={(e) => setPreserveExt(e.target.checked)} />
                    保留副檔名分開處理
                  </label>
                  <label className="fnc-check">
                    <input type="checkbox" checked={collapseSep} onChange={(e) => setCollapseSep(e.target.checked)} />
                    合併重複分隔符
                  </label>
                  <label className="fnc-check">
                    <input type="checkbox" checked={stripEdges} onChange={(e) => setStripEdges(e.target.checked)} />
                    去掉首尾 .-_
                  </label>
                  <label className="fnc-check">
                    <input type="checkbox" checked={nfkc} onChange={(e) => setNfkc(e.target.checked)} />
                    Unicode NFKC 正規化
                  </label>
                  <label className="fnc-check">
                    <input type="checkbox" checked={stripDia} onChange={(e) => setStripDia(e.target.checked)} />
                    去除變音符號（é→e）
                  </label>
                </div>

                <div className="fnc-fields-2">
                  <label className="stack">
                    <span className="label">尋找</span>
                    <input
                      className="field"
                      value={find}
                      maxLength={80}
                      onChange={(e) => setFind(e.target.value)}
                      placeholder="可選"
                    />
                  </label>
                  <label className="stack">
                    <span className="label">取代為</span>
                    <input
                      className="field"
                      value={replace}
                      maxLength={80}
                      onChange={(e) => setReplace(e.target.value)}
                      placeholder="可選"
                    />
                  </label>
                </div>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'result') && (
            <section className="panel fnc-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">結果</h3>
                <div className="row" style={{ gap: 6 }}>
                  {mode === 'batch' && (
                    <ActionButton className="btn sm ghost" disabled={!batchRows.length} onClick={downloadBatch} icon="download">
                      CSV
                    </ActionButton>
                  )}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={invalid}
                    onClick={() =>
                      void copyVal(mode === 'single' ? single.cleaned : batchRows.map((r) => r.cleaned).join('\n'), 'result')
                    }
                    icon="copy"
                    iconOnly
                    tooltip={copied === 'result' ? '已複製' : '複製'}
                  />
                </div>
              </div>

              {mode === 'single' ? (
                <div className="fnc-single-out">
                  <div className="muted" style={{ fontSize: 12 }}>
                    清理後
                  </div>
                  <code className="mono fnc-out-name">{single.cleaned}</code>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <ActionButton
                      className="btn sm accent"
                      disabled={invalid}
                      onClick={() => void copyVal(single.cleaned, 'result')}
                      icon="copy"
                    >
                      {copied === 'result' ? '已複製' : '複製檔名'}
                    </ActionButton>
                    <ActionButton
                      className="btn sm ghost"
                      disabled={!single.changed}
                      onClick={() => {
                        setInput(single.cleaned)
                        setHint('已寫回輸入')
                      }}
                    >
                      寫回輸入
                    </ActionButton>
                  </div>
                  {single.warnings.length > 0 && (
                    <ul className="fnc-warns">
                      {single.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <div className="fnc-diff">
                    <div>
                      <span className="muted">原始</span>
                      <code className="mono">{single.original || '—'}</code>
                    </div>
                    <div>
                      <span className="muted">主檔名</span>
                      <code className="mono">{single.base || '—'}</code>
                    </div>
                    <div>
                      <span className="muted">副檔名</span>
                      <code className="mono">{single.ext || '（無）'}</code>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="fnc-batch-list">
                  {batchRows.map((r, i) => (
                    <li key={`${r.original}-${i}`} className={r.changed ? 'is-changed' : ''}>
                      <code className="mono muted">{r.original}</code>
                      <strong className="mono">{r.cleaned}</strong>
                      <div className="row" style={{ gap: 6 }}>
                        {r.changed && <span className="tag">變更</span>}
                        {r.warnings[0] && <span className="tag">{r.warnings[0]}</span>}
                        <ActionButton
                          className="btn sm ghost"
                          icon="copy"
                          iconOnly
                          tooltip="複製"
                          onClick={() => void copyVal(r.cleaned, `b-${i}`)}
                        />
                      </div>
                    </li>
                  ))}
                  {!batchRows.length && (
                    <li className="muted" style={{ listStyle: 'none' }}>
                      貼上檔名或拖放多個檔案後即時預覽
                    </li>
                  )}
                </ul>
              )}
            </section>
          )}
        </div>

        <section className="panel fnc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">非法字元</span>
              <strong className="mono">{`< > : " / \\ | ? *`} 與控制字元</strong>
            </li>
            <li>
              <span className="muted">Windows 保留名</span>
              <strong>CON／PRN／AUX／NUL／COM1–9／LPT1–9（會自動加前綴）</strong>
            </li>
            <li>
              <span className="muted">目前結果</span>
              <strong className="mono">{mode === 'single' ? single.cleaned : `${batchStats.total} 筆／${batchStats.changed} 變更`}</strong>
            </li>
            <li>
              <span className="muted">長度</span>
              <strong>
                {mode === 'single'
                  ? `${single.cleaned.length} 字元${opts.maxLen ? `（上限 ${opts.maxLen}）` : ''}`
                  : `批次最多預覽 500 行`}
              </strong>
            </li>
            <li>
              <span className="muted">NFKC</span>
              <strong>全形符號、相容字元會正規化（例如 ／→/ 再清理）</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>只讀檔名、不上傳；拖放不會讀取檔案內容</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>跨平台請避免空白與特殊符號；需要批次改實體檔名可用「批次重新命名」</strong>
            </li>
            <li>
              <span className="muted">相關工具</span>
              <strong>批次重新命名、檔案雜湊、ZIP 打包</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
