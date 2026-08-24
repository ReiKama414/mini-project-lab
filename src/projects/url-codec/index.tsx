import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, isNonEmpty, limitText, copyText } from '../../lib/utils'

const meta = getProject('url-codec')!

const TEXT_MAX = 8192

type Mode = 'component' | 'uri'

function tryDecode(fn: (s: string) => string, s: string) {
  try {
    return { ok: true as const, value: fn(s) }
  } catch {
    return { ok: false as const, value: s }
  }
}

function componentWiseDecode(input: string) {
  const rows: { part: string; decoded: string; note: string }[] = []
  try {
    const u = new URL(input)
    rows.push({ part: '完整 URL', decoded: decodeURI(input), note: 'decodeURI' })
    rows.push({ part: 'pathname', decoded: decodeURIComponent(u.pathname), note: 'component' })
    rows.push({ part: 'search', decoded: u.search ? decodeURIComponent(u.search.slice(1)) : '(無)', note: 'component' })
    rows.push({ part: 'hash', decoded: u.hash ? decodeURIComponent(u.hash.slice(1)) : '(無)', note: 'component' })
    u.searchParams.forEach((v, k) => {
      rows.push({ part: `query.${k}`, decoded: v, note: 'URLSearchParams' })
    })
    return { ok: true as const, rows }
  } catch {
    // not a full URL — split by common separators
    const pieces = input.split(/([?&#/=])/).filter(Boolean)
    const decodedPieces = pieces.map((p) => {
      if (/^[?&#/=]$/.test(p)) return p
      const r = tryDecode(decodeURIComponent, p)
      return r.ok ? r.value : p
    })
    return {
      ok: false as const,
      rows: [
        { part: '片段解碼', decoded: decodedPieces.join(''), note: '非完整 URL，依分隔符拆解' },
        ...pieces
          .filter((p) => !/^[?&#/=]$/.test(p) && /%/.test(p))
          .map((p, i) => ({
            part: `片段 ${i + 1}`,
            decoded: tryDecode(decodeURIComponent, p).value,
            note: 'component',
          })),
      ],
    }
  }
}

export default function Page() {
  const [raw, setRaw] = useLocalStorage('lab:url-codec:raw', 'https://example.com/?q=你好&x=1%202')
  const [encoded, setEncoded] = useLocalStorage('lab:url-codec:encoded', '')
  const [mode, setMode] = useLocalStorage<Mode>('lab:url-codec:mode', 'component')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const parts = useMemo(() => componentWiseDecode(encoded || raw), [encoded, raw])

  function encode() {
    if (!isNonEmpty(raw)) {
      setError('請輸入原始字串')
      return
    }
    try {
      setEncoded(limitText(mode === 'uri' ? encodeURI(raw) : encodeURIComponent(raw), TEXT_MAX))
      setError('')
      setCopied(false)
    } catch {
      setError('編碼失敗')
    }
  }

  function decode() {
    const src = encoded || raw
    if (!isNonEmpty(src)) {
      setError('請輸入要解碼的字串')
      return
    }
    try {
      setRaw(limitText(mode === 'uri' ? decodeURI(src) : decodeURIComponent(src), TEXT_MAX))
      setError('')
      setCopied(false)
    } catch {
      setError('解碼失敗：字串可能含無效 % 序列')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">模式</span>
          <button
            type="button"
            className={`btn sm ${mode === 'component' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('component')}
          >
            encodeURIComponent
          </button>
          <button
            type="button"
            className={`btn sm ${mode === 'uri' ? 'accent' : 'ghost'}`}
            onClick={() => setMode('uri')}
          >
            encodeURI
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          {mode === 'component'
            ? '適合查詢參數與路徑片段：會編碼 / ? & = 等字元。'
            : '適合完整 URL：保留 : / ? # 等結構字元，只編碼非 ASCII 等。'}
        </p>
        <label className="stack">
          <span className="label">原始字串</span>
          <textarea
            className="field"
            rows={4}
            value={raw}
            maxLength={TEXT_MAX}
            onChange={(e) => setRaw(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(raw)} / {TEXT_MAX}</span>
          </div>
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn accent" onClick={encode} disabled={!isNonEmpty(raw)}>
            Encode
          </button>
          <button type="button" className="btn teal" onClick={decode} disabled={!isNonEmpty(encoded || raw)}>
            Decode
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={async () => {
              await copyText(encoded || raw)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製結果'}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void copyText(raw)}>
            複製原文
          </button>
        </div>
        <label className="stack">
          <span className="label">編碼結果</span>
          <textarea
            className="field mono"
            rows={4}
            value={encoded}
            maxLength={TEXT_MAX}
            onChange={(e) => setEncoded(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span>{charCount(encoded)} / {TEXT_MAX}</span>
          </div>
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="metric stack">
          <span className="muted">即時對照</span>
          <code className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
            component: {(() => {
              try {
                return encodeURIComponent(raw)
              } catch {
                return '（失敗）'
              }
            })()}
          </code>
          <code className="mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
            uri: {(() => {
              try {
                return encodeURI(raw)
              } catch {
                return '（失敗）'
              }
            })()}
          </code>
        </div>
        <div className="stack">
          <h3 style={{ margin: 0 }}>元件拆解解碼</h3>
          <ul className="list">
            {parts.rows.map((r) => (
              <li key={r.part + r.decoded} className="list-item">
                <span className="tag">{r.part}</span>
                <span className="mono" style={{ flex: 1, wordBreak: 'break-all' }}>
                  {r.decoded}
                </span>
                <button type="button" className="btn sm ghost" onClick={() => void copyText(r.decoded)}>
                  複製
                </button>
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 12 }}>
            {parts.ok ? '已辨識為完整 URL，依 pathname／search／hash／query 拆解。' : '非完整 URL，改以分隔符片段解碼。'}
          </p>
        </div>
      </div>
    </ProjectShell>
  )
}
