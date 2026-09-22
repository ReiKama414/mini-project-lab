import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const meta = getProject('url-codec')!

const TEXT_MAX = 32_000

type Mode = 'component' | 'uri' | 'form'
type Side = 'raw' | 'encoded'
type ViewMode = 'split' | 'raw' | 'encoded'

const SAMPLES: Record<string, { label: string; raw: string }> = {
  query: {
    label: '查詢參數',
    raw: 'https://example.com/search?q=你好世界&x=1 2',
  },
  path: {
    label: '路徑',
    raw: 'https://example.com/docs/快速開始/',
  },
  fragment: {
    label: '純文字',
    raw: 'hello world & 你好',
  },
}

const MODE_META: Record<Mode, { label: string; hint: string }> = {
  component: {
    label: 'Component',
    hint: 'encodeURIComponent：編碼 / ? & = 等，適合參數與片段',
  },
  uri: {
    label: 'URI',
    hint: 'encodeURI：保留 : / ? # 等結構字元，適合完整 URL',
  },
  form: {
    label: 'Form',
    hint: '表單風格：同 Component，空白變 +（application/x-www-form-urlencoded）',
  },
}

function tryCall(fn: () => string) {
  try {
    return { ok: true as const, value: fn() }
  } catch {
    return { ok: false as const, value: '' }
  }
}

function encodeValue(raw: string, mode: Mode) {
  if (mode === 'uri') return encodeURI(raw)
  if (mode === 'form') return encodeURIComponent(raw).replace(/%20/g, '+')
  return encodeURIComponent(raw)
}

function decodeValue(encoded: string, mode: Mode) {
  if (mode === 'uri') return decodeURI(encoded)
  const src = mode === 'form' ? encoded.replace(/\+/g, '%20') : encoded
  return decodeURIComponent(src)
}

function tryDecode(fn: (s: string) => string, s: string) {
  try {
    return { ok: true as const, value: fn(s) }
  } catch {
    return { ok: false as const, value: s }
  }
}

function parseUrlParts(input: string) {
  try {
    const u = new URL(input)
    const queries: { key: string; value: string }[] = []
    u.searchParams.forEach((value, key) => {
      queries.push({ key, value })
    })
    return {
      ok: true as const,
      href: u.href,
      protocol: u.protocol,
      username: u.username,
      password: u.password ? '••••' : '',
      host: u.host,
      hostname: u.hostname,
      port: u.port || '(預設)',
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      origin: u.origin,
      queries,
    }
  } catch {
    return { ok: false as const }
  }
}

function componentWiseDecode(input: string) {
  const rows: { part: string; decoded: string; note: string }[] = []
  if (!isNonEmpty(input)) return { ok: false as const, rows }
  try {
    const u = new URL(input)
    rows.push({ part: '完整 URL', decoded: tryDecode(decodeURI, input).value, note: 'decodeURI' })
    rows.push({
      part: 'pathname',
      decoded: tryDecode(decodeURIComponent, u.pathname).value,
      note: 'component',
    })
    rows.push({
      part: 'search',
      decoded: u.search ? tryDecode(decodeURIComponent, u.search.slice(1)).value : '(無)',
      note: 'component',
    })
    rows.push({
      part: 'hash',
      decoded: u.hash ? tryDecode(decodeURIComponent, u.hash.slice(1)).value : '(無)',
      note: 'component',
    })
    u.searchParams.forEach((v, k) => {
      rows.push({ part: `query.${k}`, decoded: v, note: 'URLSearchParams' })
    })
    return { ok: true as const, rows }
  } catch {
    const pieces = input.split(/([?&#/=])/).filter(Boolean)
    const decodedPieces = pieces.map((p) => {
      if (/^[?&#/=]$/.test(p)) return p
      const r = tryDecode(decodeURIComponent, p.replace(/\+/g, '%20'))
      return r.ok ? r.value : p
    })
    return {
      ok: false as const,
      rows: [
        { part: '片段解碼', decoded: decodedPieces.join(''), note: '非完整 URL，依分隔符拆解' },
        ...pieces
          .filter((p) => !/^[?&#/=]$/.test(p) && /%|\+/.test(p))
          .map((p, i) => ({
            part: `片段 ${i + 1}`,
            decoded: tryDecode(decodeURIComponent, p.replace(/\+/g, '%20')).value,
            note: 'component',
          })),
      ],
    }
  }
}

function countPercentEscapes(s: string) {
  const matches = s.match(/%[0-9A-Fa-f]{2}/g)
  return matches ? matches.length : 0
}

export default function Page() {
  const [raw, setRaw] = useLocalStorage('lab:url-codec:raw', SAMPLES.query!.raw)
  const [encoded, setEncoded] = useLocalStorage('lab:url-codec:encoded', '')
  const [mode, setMode] = useLocalStorage<Mode>('lab:url-codec:mode', 'component')
  const [live, setLive] = useLocalStorage('lab:url-codec:live', true)
  const [view, setView] = useLocalStorage<ViewMode>('lab:url-codec:view', 'split')
  const [lastEdited, setLastEdited] = useState<Side>('raw')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!live || lastEdited !== 'raw') return
    if (!isNonEmpty(raw)) {
      setEncoded('')
      setError('')
      return
    }
    const result = tryCall(() => encodeValue(raw, mode))
    if (!result.ok) {
      setError('編碼失敗')
      return
    }
    setEncoded(limitText(result.value, TEXT_MAX))
    setError('')
  }, [live, lastEdited, raw, mode])

  useEffect(() => {
    if (!live || lastEdited !== 'encoded') return
    if (!isNonEmpty(encoded)) {
      setRaw('')
      setError('')
      return
    }
    const result = tryCall(() => decodeValue(encoded, mode))
    if (!result.ok) {
      setError('解碼失敗：字串可能含無效 % 序列')
      return
    }
    setRaw(limitText(result.value, TEXT_MAX))
    setError('')
  }, [live, lastEdited, encoded, mode])

  const parts = useMemo(() => componentWiseDecode(encoded || raw), [encoded, raw])
  const urlInfo = useMemo(() => parseUrlParts(raw.includes('://') ? raw : encoded.includes('://') ? encoded : raw), [raw, encoded])
  const bothEncodes = useMemo(() => {
    const component = tryCall(() => encodeURIComponent(raw))
    const uri = tryCall(() => encodeURI(raw))
    const form = tryCall(() => encodeURIComponent(raw).replace(/%20/g, '+'))
    return { component, uri, form }
  }, [raw])

  const pctCount = countPercentEscapes(encoded)
  const plusCount = (encoded.match(/\+/g) || []).length
  const expansion = raw.length ? encoded.length / raw.length : 0

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1200)
  }

  function encodeNow() {
    if (!isNonEmpty(raw)) {
      setError('請輸入原始字串')
      return
    }
    const result = tryCall(() => encodeValue(raw, mode))
    if (!result.ok) {
      setError('編碼失敗')
      return
    }
    setEncoded(limitText(result.value, TEXT_MAX))
    setLastEdited('raw')
    setError('')
  }

  function decodeNow() {
    const src = encoded || raw
    if (!isNonEmpty(src)) {
      setError('請輸入要解碼的字串')
      return
    }
    const result = tryCall(() => decodeValue(src, mode))
    if (!result.ok) {
      setError('解碼失敗：字串可能含無效 % 序列')
      return
    }
    setRaw(limitText(result.value, TEXT_MAX))
    if (!encoded) setEncoded(limitText(src, TEXT_MAX))
    setLastEdited('encoded')
    setError('')
  }

  function applySample(text: string) {
    if (raw.trim() && !confirm('套用範本會覆蓋目前原文，確定？')) return
    setRaw(text)
    setLastEdited('raw')
    setError('')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row uc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={!raw} onClick={() => void copyVal(raw, 'raw')} icon="copy">
            {copied === 'raw' ? '已複製' : '複製原文'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!encoded}
            onClick={() => void copyVal(encoded, 'enc')}
            icon="copy"
          >
            {copied === 'enc' ? '已複製' : '複製編碼'}
          </ActionButton>
        </div>
      }
    >
      <div className="uc-calc">
        <div className="pw-stats">
          <span className="metric mono">{charCount(raw).toLocaleString()} 字</span>
          <span className="tag">編碼 {charCount(encoded).toLocaleString()}</span>
          <span className="tag">%{pctCount}</span>
          {plusCount > 0 && <span className="tag">+{plusCount}</span>}
          <span className="tag">{MODE_META[mode].label}</span>
          {urlInfo.ok && <span className="tag">{urlInfo.protocol}</span>}
          {live && <span className="tag">即時</span>}
        </div>

        <div className="panel uc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row uc-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['raw', '原文'],
                  ['encoded', '編碼'],
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

          <div className="pw-block">
            <div className="label">模式</div>
            <div className="pw-chips">
              {(Object.keys(MODE_META) as Mode[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${mode === id ? 'accent' : 'ghost'}`}
                  onClick={() => setMode(id)}
                >
                  {MODE_META[id].label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {MODE_META[mode].hint}
            </p>
          </div>

          <div className="pw-block">
            <div className="label">範本</div>
            <div className="pw-chips">
              {Object.entries(SAMPLES).map(([key, s]) => (
                <button key={key} type="button" className="btn sm ghost" onClick={() => applySample(s.raw)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row uc-options">
            <label className="uc-check">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              <span>即時互轉</span>
            </label>
          </div>
        </div>

        <div className={`uc-main uc-view-${view}`}>
          {(view === 'split' || view === 'raw') && (
            <section className="panel uc-pane">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">原文</h3>
                <span className="tag mono">{charCount(raw).toLocaleString()}</span>
              </div>

              <div className="uc-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  {!live && (
                    <button type="button" className="btn sm accent" disabled={!isNonEmpty(raw)} onClick={encodeNow}>
                      Encode →
                    </button>
                  )}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!raw}
                    onClick={() => void copyVal(raw, 'raw')}
                    icon="copy"
                  >
                    {copied === 'raw' ? '已複製' : '複製'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setRaw('')
                      setLastEdited('raw')
                      if (!live) {
                        setEncoded('')
                        setError('')
                      }
                    }}
                  >
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className="field uc-textarea"
                value={raw}
                maxLength={TEXT_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setRaw(limitText(e.target.value, TEXT_MAX))
                  setLastEdited('raw')
                }}
                placeholder="https://example.com/?q=你好"
                aria-label="原始字串"
              />
              <div className="field-meta">
                <span>
                  {charCount(raw).toLocaleString()} / {TEXT_MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}

          {(view === 'split' || view === 'encoded') && (
            <section className="panel uc-pane">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">編碼結果</h3>
                <span className="tag mono">{charCount(encoded).toLocaleString()}</span>
              </div>

              <div className="uc-actions">
                <div className="label">操作</div>
                <div className="pw-chips">
                  {!live && (
                    <button
                      type="button"
                      className="btn sm teal"
                      disabled={!isNonEmpty(encoded || raw)}
                      onClick={decodeNow}
                    >
                      ← Decode
                    </button>
                  )}
                  <ActionButton
                    className="btn sm ghost"
                    disabled={!encoded}
                    onClick={() => void copyVal(encoded, 'enc')}
                    icon="copy"
                  >
                    {copied === 'enc' ? '已複製' : '複製'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setEncoded('')
                      setLastEdited('encoded')
                      if (!live) setError('')
                    }}
                  >
                    清空
                  </ActionButton>
                </div>
              </div>

              <textarea
                className={`field mono uc-textarea${error && lastEdited === 'encoded' ? ' is-invalid' : ''}`}
                value={encoded}
                maxLength={TEXT_MAX}
                spellCheck={false}
                onChange={(e) => {
                  setEncoded(limitText(e.target.value, TEXT_MAX))
                  setLastEdited('encoded')
                }}
                placeholder="https%3A%2F%2Fexample.com%2F%3Fq%3D..."
                aria-label="編碼結果"
              />
              <div className="field-meta">
                <span>
                  {charCount(encoded).toLocaleString()} / {TEXT_MAX.toLocaleString()}
                </span>
              </div>
            </section>
          )}
        </div>

        {error && (
          <div className="panel uc-alerts">
            <p className="field-error">{error}</p>
          </div>
        )}

        <div className="uc-bottom">
          <section className="panel uc-parts">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">元件拆解</h3>
              <span className="tag">{parts.ok ? '完整 URL' : '片段'}</span>
            </div>
            {!parts.rows.length ? (
              <p className="muted" style={{ margin: 0 }}>
                輸入內容後會顯示拆解結果
              </p>
            ) : (
              <ul className="uc-parts-list">
                {parts.rows.map((r) => (
                  <li key={`${r.part}-${r.note}-${r.decoded.slice(0, 24)}`}>
                    <div className="uc-part-head">
                      <span className="tag">{r.part}</span>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {r.note}
                      </span>
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(r.decoded, `part-${r.part}`)}
                        icon="copy"
                        iconOnly
                        tooltip={copied === `part-${r.part}` ? '已複製' : '複製'}
                      />
                    </div>
                    <code className="mono uc-part-value">{r.decoded}</code>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted pw-hint">
              {parts.ok
                ? '已辨識為完整 URL，依 pathname／search／hash／query 拆解'
                : '非完整 URL，改以分隔符片段解碼'}
            </p>
          </section>

          <section className="panel uc-info">
            <h3 className="pw-panel-title">更多資訊</h3>
            <ul className="pw-info-list">
              <li>
                <span className="muted">原文長度</span>
                <strong className="mono">{charCount(raw).toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">編碼長度</span>
                <strong className="mono">{charCount(encoded).toLocaleString()}</strong>
              </li>
              <li>
                <span className="muted">膨脹比</span>
                <strong className="mono">{expansion ? `${expansion.toFixed(2)}×` : '—'}</strong>
              </li>
              <li>
                <span className="muted">%XX 數量</span>
                <strong className="mono">{pctCount}</strong>
              </li>
              <li>
                <span className="muted">+ 數量</span>
                <strong className="mono">{plusCount}</strong>
              </li>
              <li>
                <span className="muted">模式</span>
                <strong>{MODE_META[mode].label}</strong>
              </li>
              {urlInfo.ok && (
                <>
                  <li>
                    <span className="muted">協議</span>
                    <strong className="mono">{urlInfo.protocol}</strong>
                  </li>
                  <li>
                    <span className="muted">主機</span>
                    <strong className="mono">{urlInfo.host}</strong>
                  </li>
                  <li>
                    <span className="muted">路徑</span>
                    <strong className="mono">{urlInfo.pathname}</strong>
                  </li>
                  <li>
                    <span className="muted">查詢參數</span>
                    <strong className="mono">{urlInfo.queries.length}</strong>
                  </li>
                </>
              )}
            </ul>

            {urlInfo.ok && urlInfo.queries.length > 0 && (
              <div className="pw-block">
                <div className="label">查詢參數</div>
                <ul className="uc-query-list">
                  {urlInfo.queries.map((q, i) => (
                    <li key={`${q.key}-${i}`}>
                      <code className="mono">{q.key}</code>
                      <span className="muted">=</span>
                      <code className="mono">{q.value}</code>
                      <ActionButton
                        className="btn sm ghost"
                        onClick={() => void copyVal(q.value, `q-${q.key}-${i}`)}
                        icon="copy"
                        iconOnly
                        tooltip="複製值"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pw-block">
              <div className="label">三種編碼對照</div>
              <div className="uc-compare">
                {(
                  [
                    ['component', bothEncodes.component],
                    ['uri', bothEncodes.uri],
                    ['form', bothEncodes.form],
                  ] as const
                ).map(([label, result]) => (
                  <div key={label} className="uc-compare-row">
                    <span className="muted">{label}</span>
                    <code className="mono">{result.ok ? result.value || '（空）' : '（失敗）'}</code>
                    <ActionButton
                      className="btn sm ghost"
                      disabled={!result.ok || !result.value}
                      onClick={() => void copyVal(result.value, label)}
                      icon="copy"
                      iconOnly
                      tooltip={copied === label ? '已複製' : '複製'}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="muted pw-hint">
              Component 適合單一參數；URI 適合整段網址；Form 把空白編成 <code>+</code>
              。內容存於本機。
            </p>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
