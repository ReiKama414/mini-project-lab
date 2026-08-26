import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, formatBytes, parseNumber, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'

const meta: ProjectMeta = getProject('batch-rename') ?? {
  slug: 'batch-rename',
  title: '批次重新命名',
  description: '選檔套用命名規則，打包 ZIP 下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['file'],
}

const PATTERN_MAX = 120
const MAX_FILES = 80
const MAX_TOTAL = 80 * 1024 * 1024

function applyName(
  name: string,
  i: number,
  opts: { prefix: string; suffix: string; find: string; replace: string; start: number; pad: number; lowerExt: boolean },
) {
  let base = name
  let ext = ''
  const dot = name.lastIndexOf('.')
  if (dot > 0) {
    base = name.slice(0, dot)
    ext = name.slice(dot)
  }
  if (opts.find) base = base.split(opts.find).join(opts.replace)
  base = `${opts.prefix}${base}${opts.suffix}`
  const num = String(opts.start + i).padStart(opts.pad, '0')
  let out = `${base}_${num}${opts.lowerExt ? ext.toLowerCase() : ext}`
  return out.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
}

function uniqueName(name: string, used: Set<string>) {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 1
  let candidate = `${stem} (${n})${ext}`
  while (used.has(candidate)) {
    n++
    candidate = `${stem} (${n})${ext}`
  }
  used.add(candidate)
  return candidate
}

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [prefix, setPrefix] = useLocalStorage('lab:batch-rename:prefix', 'img_')
  const [suffix, setSuffix] = useLocalStorage('lab:batch-rename:suffix', '')
  const [find, setFind] = useLocalStorage('lab:batch-rename:find', '')
  const [replace, setReplace] = useLocalStorage('lab:batch-rename:replace', '')
  const [start, setStart] = useLocalStorage('lab:batch-rename:start', 1)
  const [pad, setPad] = useLocalStorage('lab:batch-rename:pad', 3)
  const [lowerExt, setLowerExt] = useLocalStorage('lab:batch-rename:lowerExt', true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const opts = useMemo(
    () => ({
      prefix,
      suffix,
      find,
      replace,
      start: clamp(Number.isFinite(start) ? start : 1, 0, 999999),
      pad: clamp(Number.isFinite(pad) ? pad : 1, 1, 8),
      lowerExt,
    }),
    [prefix, suffix, find, replace, start, pad, lowerExt],
  )

  const rows = useMemo(() => {
    const used = new Set<string>()
    return files.map((f, i) => ({
      from: f.name,
      to: uniqueName(applyName(f.name, i, opts), used),
      size: f.size,
      file: f,
    }))
  }, [files, opts])

  function onFiles(list: File[] | FileList | null) {
    if (!list?.length) return
    const arr = Array.from(list)
    if (arr.length > MAX_FILES) {
      setError(`一次最多 ${MAX_FILES} 個檔案`)
      return
    }
    const total = arr.reduce((s, f) => s + f.size, 0)
    if (total > MAX_TOTAL) {
      setError(`總容量過大（上限 ${formatBytes(MAX_TOTAL)}）`)
      return
    }
    setFiles(arr)
    setError('')
    setCopied(false)
  }

  async function downloadZip() {
    if (!rows.length) return
    setBusy(true)
    setError('')
    try {
      const zip = new JSZip()
      for (const r of rows) zip.file(r.to, r.file)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'renamed-files.zip')
    } catch (e) {
      setError(e instanceof Error ? e.message : '打包失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!rows.length || busy} onClick={() => void downloadZip()}>
          {busy ? '打包中…' : 'ZIP 下載'}
        </button>
      }
    >
      <div className="grid-2">
        <div className="panel stack">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            瀏覽器無法直接改寫磁碟檔名。選取檔案後依規則重新命名，再以 ZIP 下載。
          </p>
          <FileDrop
            multiple
            maxFiles={MAX_FILES}
            label="拖放檔案到此，或點擊選擇（可多選）"
            hint={`最多 ${MAX_FILES} 檔 · 合計 ${formatBytes(MAX_TOTAL)}`}
            onFiles={(files) => onFiles(files)}
          />
          <div className="grid-2">
            <label className="stack">
              <span className="label">前綴</span>
              <input className="field" value={prefix} maxLength={PATTERN_MAX} onChange={(e) => setPrefix(limitText(e.target.value, PATTERN_MAX))} />
            </label>
            <label className="stack">
              <span className="label">後綴</span>
              <input className="field" value={suffix} maxLength={PATTERN_MAX} onChange={(e) => setSuffix(limitText(e.target.value, PATTERN_MAX))} />
            </label>
            <label className="stack">
              <span className="label">尋找</span>
              <input className="field" value={find} maxLength={PATTERN_MAX} onChange={(e) => setFind(limitText(e.target.value, PATTERN_MAX))} />
            </label>
            <label className="stack">
              <span className="label">取代</span>
              <input className="field" value={replace} maxLength={PATTERN_MAX} onChange={(e) => setReplace(limitText(e.target.value, PATTERN_MAX))} />
            </label>
            <label className="stack">
              <span className="label">起始編號</span>
              <input className="field" type="number" value={start} onChange={(e) => setStart(parseNumber(e.target.value, 1))} />
            </label>
            <label className="stack">
              <span className="label">補零位數</span>
              <input
                className="field"
                type="number"
                min={1}
                max={8}
                value={pad}
                onChange={(e) => setPad(clamp(parseNumber(e.target.value, 3), 1, 8))}
              />
            </label>
          </div>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={lowerExt} onChange={(e) => setLowerExt(e.target.checked)} />
            副檔名小寫
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" disabled={!rows.length || busy} onClick={() => void downloadZip()}>
              {busy ? '打包中…' : '以新檔名打包 ZIP'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!rows.length}
              onClick={async () => {
                await copyText(rows.map((r) => r.to).join('\n'))
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '複製新檔名'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!rows.length}
              onClick={() => downloadText('rename-map.txt', rows.map((r) => `${r.from}\t${r.to}`).join('\n'))}
            >
              下載對照表
            </button>
          </div>
        </div>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>預覽（{rows.length}）</h3>
          <ul className="list">
            {rows.map((r) => (
              <li key={r.from + r.to} className="list-item stack">
                <span className="mono muted" style={{ fontSize: 12 }}>
                  {r.from} · {formatBytes(r.size)}
                </span>
                <span className="mono">→ {r.to}</span>
              </li>
            ))}
            {!rows.length && <p className="muted">請選取檔案</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
