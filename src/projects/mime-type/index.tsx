import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, formatBytes, isNonEmpty, limitText, uid } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'mime-type',
  title: 'MIME Type Lookup',
  description: '副檔名／魔術位元組／雙向查詢 MIME',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['file', 'dev'],
}
const meta = getProject('mime-type') ?? fallback

const NAME_MAX = 260
const FILE_MAX = 50 * 1024 * 1024
const MAX_FILES = 40

/** Common extension → MIME */
const EXT_MAP: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  jsx: 'text/jsx',
  json: 'application/json',
  map: 'application/json',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  pdf: 'application/pdf',
  zip: 'application/zip',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  wasm: 'application/wasm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  sh: 'application/x-sh',
  py: 'text/x-python',
  go: 'text/x-go',
  rs: 'text/x-rust',
  java: 'text/x-java-source',
  c: 'text/x-c',
  cpp: 'text/x-c',
  h: 'text/x-c',
  php: 'application/x-httpd-php',
  sql: 'application/sql',
  graphql: 'application/graphql',
  apk: 'application/vnd.android.package-archive',
  dmg: 'application/x-apple-diskimage',
  iso: 'application/x-iso9660-image',
  bin: 'application/octet-stream',
  exe: 'application/vnd.microsoft.portable-executable',
  dll: 'application/vnd.microsoft.portable-executable',
}

const CATEGORIES: { id: string; label: string; prefix: string }[] = [
  { id: 'all', label: '全部', prefix: '' },
  { id: 'image', label: '影像', prefix: 'image/' },
  { id: 'audio', label: '音訊', prefix: 'audio/' },
  { id: 'video', label: '視訊', prefix: 'video/' },
  { id: 'text', label: '文字', prefix: 'text/' },
  { id: 'app', label: '應用', prefix: 'application/' },
  { id: 'font', label: '字型', prefix: 'font/' },
]

const SAMPLES = [
  { label: 'xlsx', value: 'report.xlsx' },
  { label: 'png', value: 'photo.png' },
  { label: 'json', value: 'data.json' },
  { label: 'mp4', value: 'clip.mp4' },
  { label: 'woff2', value: 'font.woff2' },
  { label: '無副檔名', value: 'README' },
]

type ViewMode = 'split' | 'lookup' | 'table'
type FileRow = {
  id: string
  name: string
  size: number
  browser: string
  sniff: string
  extGuess: string
  ext: string
  agree: 'all' | 'partial' | 'none' | 'na'
}

function extOf(name: string) {
  const base = name.split(/[/\\]/).pop() || name
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

function guessByExt(name: string) {
  const ext = extOf(name)
  if (!ext) return { ext: '', mime: 'application/octet-stream' }
  return { ext, mime: EXT_MAP[ext] || 'application/octet-stream' }
}

function reverseLookup(mime: string) {
  const m = mime.trim().toLowerCase()
  if (!m) return [] as string[]
  return Object.entries(EXT_MAP)
    .filter(([, v]) => v.toLowerCase() === m)
    .map(([k]) => k)
    .sort()
}

function asciiAt(buf: Uint8Array, offset: number, text: string) {
  if (buf.length < offset + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (buf[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** Magic-byte sniff for common formats. */
async function sniffMime(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (buf.length < 4) return null

  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (asciiAt(buf, 0, 'GIF8')) return 'image/gif'
  if (asciiAt(buf, 0, 'RIFF') && asciiAt(buf, 8, 'WEBP')) return 'image/webp'
  if (asciiAt(buf, 0, 'BM')) return 'image/bmp'
  if (buf[0] === 0x00 && buf[1] === 0x00 && (buf[2] === 0x01 || buf[2] === 0x02) && buf[3] === 0x00) return 'image/x-icon'
  if (asciiAt(buf, 0, '%PDF')) return 'application/pdf'
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'application/zip'
  if (buf[0] === 0x1f && buf[1] === 0x8b) return 'application/gzip'
  if (asciiAt(buf, 0, 'Rar!')) return 'application/vnd.rar'
  if (buf[0] === 0x37 && buf[1] === 0x7a && buf[2] === 0xbc && buf[3] === 0xaf) return 'application/x-7z-compressed'
  if (asciiAt(buf, 0, '\x7fELF')) return 'application/x-elf'
  if (asciiAt(buf, 0, 'MZ')) return 'application/vnd.microsoft.portable-executable'
  if (asciiAt(buf, 0, '\0asm')) return 'application/wasm'
  if (asciiAt(buf, 0, 'OggS')) return 'application/ogg'
  if (asciiAt(buf, 0, 'fLaC')) return 'audio/flac'
  if (asciiAt(buf, 0, 'ID3') || (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (asciiAt(buf, 0, 'RIFF') && asciiAt(buf, 8, 'WAVE')) return 'audio/wav'
  if (asciiAt(buf, 4, 'ftyp')) {
    const brand = String.fromCharCode(buf[8] || 0, buf[9] || 0, buf[10] || 0, buf[11] || 0)
    if (/^(mp4|isom|iso2|avc1|M4V|M4A)/i.test(brand)) {
      if (/^M4A/i.test(brand)) return 'audio/mp4'
      return 'video/mp4'
    }
    if (/^qt/i.test(brand)) return 'video/quicktime'
  }
  // EBML → often WebM/Matroska
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm'
  return null
}

function agreement(extGuess: string, browser: string, sniff: string | null): FileRow['agree'] {
  const values = [extGuess, browser, sniff].filter((v): v is string => !!v && !v.startsWith('（'))
  if (values.length < 2) return 'na'
  const norm = values.map((v) => v.toLowerCase())
  const uniq = new Set(norm)
  if (uniq.size === 1) return 'all'
  // zip vs ooxml soft-agree
  const soft = norm.map((v) => (v.includes('zip') || v.includes('openxml') ? 'zip-family' : v))
  if (new Set(soft).size === 1) return 'partial'
  if (uniq.size < values.length) return 'partial'
  return 'none'
}

function categoryOf(mime: string) {
  const i = mime.indexOf('/')
  return i > 0 ? mime.slice(0, i) : 'other'
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:mime-type:name', 'report.xlsx')
  const [query, setQuery] = useLocalStorage('lab:mime-type:query', '')
  const [cat, setCat] = useLocalStorage('lab:mime-type:cat', 'all')
  const [view, setView] = useLocalStorage<ViewMode>('lab:mime-type:view', 'split')
  const [reverseMime, setReverseMime] = useLocalStorage('lab:mime-type:reverse', '')

  const [fileRows, setFileRows] = useState<FileRow[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { ext, mime: guessed } = useMemo(() => guessByExt(name), [name])
  const reverseExts = useMemo(() => reverseLookup(reverseMime), [reverseMime])
  const headerLine = `Content-Type: ${guessed}`

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const prefix = CATEGORIES.find((c) => c.id === cat)?.prefix ?? ''
    return Object.entries(EXT_MAP)
      .filter(([e, m]) => {
        if (prefix && !m.startsWith(prefix)) return false
        if (!q) return true
        return e.includes(q) || m.toLowerCase().includes(q)
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [query, cat])

  const invalid = !isNonEmpty(name)

  async function copyVal(val: string, key: string) {
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function onFiles(files: File[]) {
    if (!files.length) return
    if (files.length > MAX_FILES) {
      setError(`一次最多 ${MAX_FILES} 個檔案`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const rows: FileRow[] = []
      for (const file of files.slice(0, MAX_FILES)) {
        if (file.size > FILE_MAX) {
          setError(`「${file.name}」過大（單檔上限 ${formatBytes(FILE_MAX)}）`)
          continue
        }
        const g = guessByExt(file.name)
        const browser = file.type || '（瀏覽器未提供）'
        let sniff = '（無法判斷）'
        try {
          sniff = (await sniffMime(file)) ?? '（無法從魔術位元組判斷）'
        } catch {
          sniff = '（讀取失敗）'
        }
        const sniffVal = sniff.startsWith('（') ? null : sniff
        rows.push({
          id: uid('m'),
          name: file.name,
          size: file.size,
          browser,
          sniff,
          extGuess: g.mime,
          ext: g.ext || '（無）',
          agree: agreement(g.mime, browser.startsWith('（') ? '' : browser, sniffVal),
        })
      }
      if (rows[0]) {
        setName(limitText(rows[0].name, NAME_MAX))
        setReverseMime(rows[0].extGuess)
      }
      setFileRows(rows)
      setHint(`已分析 ${rows.length} 個檔案`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row mime-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={invalid}
            onClick={() => void copyVal(headerLine, 'hdr')}
            icon="copy"
          >
            {copied === 'hdr' ? '已複製' : 'Content-Type'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={invalid}
            onClick={() => void copyVal(guessed, 'mime')}
            icon="copy"
          >
            {copied === 'mime' ? '已複製' : '複製 MIME'}
          </ActionButton>
        </div>
      }
    >
      <div className="mime-calc">
        <div className="panel mime-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row mime-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['lookup', '查詢'],
                  ['table', '對照表'],
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
            <span className="tag mono">{guessed}</span>
            <span className="tag">{ext ? `.${ext}` : '無副檔名'}</span>
            <span className="tag">{categoryOf(guessed)}</span>
            {fileRows.length > 0 && <span className="tag">{fileRows.length} 檔</span>}
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
                    setName(s.value)
                    setHint(`已套用「${s.label}」`)
                    setError('')
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`mime-main mime-view-${view}`}>
          {(view === 'split' || view === 'lookup') && (
            <section className="panel mime-settings">
              <h3 className="pw-panel-title">查詢</h3>

              {error && <p className="field-error">{error}</p>}
              {hint && !error && <p className="field-hint">{hint}</p>}
              {busy && <p className="field-hint">分析中…</p>}

              <label className="stack">
                <span className="label">檔名 → MIME</span>
                <input
                  className={`field mono${!isNonEmpty(name) ? ' is-invalid' : ''}`}
                  value={name}
                  maxLength={NAME_MAX}
                  spellCheck={false}
                  onChange={(e) => {
                    setName(limitText(e.target.value, NAME_MAX))
                    setError('')
                  }}
                  placeholder="example.png"
                  aria-label="檔名"
                />
                <div className="field-meta">
                  <span>副檔名 {ext || '（無）'}</span>
                  <span>
                    {charCount(name)} / {NAME_MAX}
                  </span>
                </div>
              </label>

              <label className="stack">
                <span className="label">MIME → 常見副檔名</span>
                <input
                  className="field mono"
                  value={reverseMime}
                  maxLength={120}
                  spellCheck={false}
                  onChange={(e) => setReverseMime(limitText(e.target.value, 120))}
                  placeholder="image/png"
                  aria-label="MIME 反查"
                />
                <div className="pw-chips mime-rev-chips">
                  {reverseExts.length ? (
                    reverseExts.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="btn sm ghost"
                        onClick={() => {
                          setName(`file.${e}`)
                          setHint(`已填入 .${e}`)
                        }}
                      >
                        .{e}
                      </button>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      {reverseMime.trim() ? '對照表無完全相符項目' : '輸入 MIME 顯示副檔名'}
                    </span>
                  )}
                </div>
              </label>

              <FileDrop
                multiple
                maxFiles={MAX_FILES}
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放檔案（可多選）對照 File.type 與魔術位元組"
                hint={`最多 ${MAX_FILES} 個 · 單檔 ${formatBytes(FILE_MAX)} · 只讀檔頭`}
                onFiles={(files) => void onFiles(files)}
              />
            </section>
          )}

          {(view === 'split' || view === 'lookup') && (
            <section className="panel mime-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">結果</h3>
                <ActionButton
                  className="btn sm ghost"
                  icon="copy"
                  iconOnly
                  disabled={invalid}
                  tooltip={copied === 'mime' ? '已複製' : '複製 MIME'}
                  onClick={() => void copyVal(guessed, 'mime')}
                />
              </div>

              <div className="mime-hero">
                <div className="muted">副檔名推斷</div>
                <code className="mono mime-hero-mime">{guessed}</code>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className="tag">{ext ? `.${ext}` : '無副檔名'}</span>
                  <span className="tag">{categoryOf(guessed)}</span>
                  {!EXT_MAP[ext] && ext && <span className="tag mime-tag-warn">未收錄，回落 octet-stream</span>}
                </div>
                <code className="mono mime-header">{headerLine}</code>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton className="btn sm accent" disabled={invalid} onClick={() => void copyVal(guessed, 'mime')} icon="copy">
                    {copied === 'mime' ? '已複製' : '複製 MIME'}
                  </ActionButton>
                  <ActionButton className="btn sm ghost" disabled={invalid} onClick={() => void copyVal(headerLine, 'hdr')} icon="copy">
                    {copied === 'hdr' ? '已複製標頭' : '複製標頭'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    disabled={invalid}
                    onClick={() => {
                      setReverseMime(guessed)
                      setHint('已帶入反查')
                    }}
                  >
                    反查此 MIME
                  </ActionButton>
                </div>
              </div>

              {fileRows.length > 0 && (
                <ul className="mime-file-list">
                  {fileRows.map((r) => (
                    <li key={r.id} className={`mime-agree-${r.agree}`}>
                      <div className="mime-file-head">
                        <strong className="mono">{r.name}</strong>
                        <span className="tag">{formatBytes(r.size)}</span>
                      </div>
                      <div className="mime-compare">
                        <div>
                          <span className="muted">副檔名</span>
                          <code className="mono">{r.extGuess}</code>
                        </div>
                        <div>
                          <span className="muted">File.type</span>
                          <code className="mono">{r.browser}</code>
                        </div>
                        <div>
                          <span className="muted">魔術位元組</span>
                          <code className="mono">{r.sniff}</code>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="tag">
                          {r.agree === 'all'
                            ? '三者一致'
                            : r.agree === 'partial'
                              ? '部分一致'
                              : r.agree === 'none'
                                ? '不一致'
                                : '資料不足'}
                        </span>
                        <ActionButton
                          className="btn sm ghost"
                          icon="copy"
                          iconOnly
                          tooltip="複製副檔名 MIME"
                          onClick={() => void copyVal(r.extGuess, r.id)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {view === 'table' && (
            <section className="panel mime-table-panel">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">對照表</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {tableRows.length} 筆
                </span>
              </div>
              <div className="pw-block">
                <div className="label">分類</div>
                <div className="pw-chips">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`btn sm ${cat === c.id ? 'accent' : 'ghost'}`}
                      onClick={() => setCat(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="stack">
                <span className="label">搜尋副檔名或 MIME</span>
                <input
                  className="field"
                  value={query}
                  maxLength={80}
                  onChange={(e) => setQuery(limitText(e.target.value, 80))}
                  placeholder="png / image/"
                />
              </label>
              <ul className="mime-table-list">
                {tableRows.map(([e, m]) => (
                  <li key={e}>
                    <button
                      type="button"
                      className="mime-table-row"
                      onClick={() => {
                        setName(`file.${e}`)
                        setReverseMime(m)
                        setView('split')
                        setHint(`已選擇 .${e}`)
                      }}
                    >
                      <code className="mono">.{e}</code>
                      <code className="mono muted">{m}</code>
                    </button>
                  </li>
                ))}
                {!tableRows.length && (
                  <li className="muted" style={{ listStyle: 'none' }}>
                    沒有符合的項目
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        <section className="panel mime-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">目前推斷</span>
              <strong className="mono">{guessed}</strong>
            </li>
            <li>
              <span className="muted">副檔名</span>
              <strong>{ext ? `.${ext}` : '（無）'} · 對照表 {Object.keys(EXT_MAP).length} 種</strong>
            </li>
            <li>
              <span className="muted">魔術位元組</span>
              <strong>讀取檔頭判斷 PNG／JPEG／GIF／WEBP／BMP／ICO／PDF／ZIP／GZ／RAR／7z／MP3／WAV／FLAC／MP4／WebM／WASM／PE 等</strong>
            </li>
            <li>
              <span className="muted">ZIP 家族</span>
              <strong>DOCX／XLSX／PPTX 等 OOXML 檔頭與 ZIP 相同，內容嗅探常顯示 application/zip</strong>
            </li>
            <li>
              <span className="muted">File.type</span>
              <strong>由瀏覽器依系統／副檔名提供，可能空白或與真實格式不符</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>只讀檔名與檔頭（最多 16 bytes），不上傳伺服器</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>伺服器應同時驗證副檔名與內容；API 回傳請帶正確 Content-Type</strong>
            </li>
            <li>
              <span className="muted">相關工具</span>
              <strong>檔名清理、檔案大小分析、檔案雜湊核對</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
