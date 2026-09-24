import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, limitText, charCount, isNonEmpty, formatBytes, copyText, downloadText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'

const fallback: ProjectMeta = {
  slug: 'text-to-pdf',
  title: 'TXT → PDF',
  description: '純文字轉 PDF，支援中文、紙張與頁碼',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['pdf'],
}
const meta = getProject('text-to-pdf') ?? fallback

const TEXT_MAX = 40_000
const FILE_MAX = 200_000
const MAX_PAGES = 60
const FONT_STACK = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",sans-serif'

type PaperId = 'a4' | 'letter' | 'a5'
type Align = 'left' | 'center'
type ViewMode = 'split' | 'edit' | 'preview'

const PAPERS: Record<PaperId, { label: string; w: number; h: number }> = {
  a4: { label: 'A4', w: 595.28, h: 841.89 },
  letter: { label: 'Letter', w: 612, h: 792 },
  a5: { label: 'A5', w: 419.53, h: 595.28 },
}

const PRESETS: { id: string; label: string; body: string }[] = [
  {
    id: 'note',
    label: '筆記',
    body: `會議筆記
日期：2026-09-22

一、今日重點
1. 確認需求範圍
2. 排程下週交付

二、待辦
- [ ] 補規格
- [ ] 回覆客戶

備註：本機產生，不上傳伺服器。`,
  },
  {
    id: 'letter',
    label: '信件',
    body: `親愛的夥伴你好：

感謝你撥空閱讀這封信。以下整理本次合作重點，方便雙方對齊：

1. 交付內容與時程
2. 聯絡窗口與回覆期限
3. 後續追蹤方式

若有任何問題，歡迎隨時來信。

此致
敬祝順心`,
  },
  {
    id: 'readme',
    label: '說明',
    body: `TXT → PDF 使用說明

• 左側輸入純文字，右側即時預覽版面
• 可調整紙張、直橫向、字級、行距與邊界
• 支援中文（系統字型點陣後嵌入 PDF）
• 可選頁碼與檔名，全部在瀏覽器本機完成

提示：過長內容請留意頁數上限。`,
  },
  {
    id: 'poem',
    label: '短文',
    body: `晨光穿過窗欞，
桌上的紙筆還留著昨夜的字跡。

把一段話寫下來，
再匯成一份安靜的 PDF。`,
  },
]

const SNIPPETS: { label: string; insert: string; cursor?: number }[] = [
  { label: '今日日期', insert: '' }, // filled at runtime
  { label: '現在時間', insert: '' },
  { label: '標題列', insert: '【標題】\n', cursor: 1 },
  { label: '分隔線', insert: '\n————————————\n' },
  { label: '項目符號', insert: '• ' },
  { label: '編號 1.', insert: '1. ' },
  { label: '待辦', insert: '- [ ] ' },
  { label: '空行', insert: '\n\n' },
  { label: '簽名', insert: '\n此致\n敬祝順心\n' },
]

const FONT_PRESETS = [10, 12, 14, 16, 18, 20] as const
const MARGIN_PRESETS = [32, 48, 64, 80] as const
const LH_PRESETS = [1.35, 1.55, 1.75, 2] as const

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para) {
      lines.push('')
      continue
    }
    let line = ''
    for (const ch of [...para]) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else line = test
    }
    if (line) lines.push(line)
  }
  return lines
}

function countWords(text: string) {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const latin = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length
  return cjk + latin
}

function pageSize(paper: PaperId, landscape: boolean) {
  const p = PAPERS[paper]
  return landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h }
}

function measureLayout(
  text: string,
  opts: {
    pageW: number
    pageH: number
    margin: number
    fontSize: number
    lineHeight: number
    pageNumbers: boolean
  },
) {
  const footerH = opts.pageNumbers ? opts.fontSize * 1.8 : 0
  const contentH = opts.pageH - opts.margin * 2 - footerH
  const maxWidth = Math.max(40, opts.pageW - opts.margin * 2)
  const linePx = opts.fontSize * opts.lineHeight
  const measure = document.createElement('canvas')
  const mctx = measure.getContext('2d')!
  mctx.font = `${opts.fontSize}px ${FONT_STACK}`
  const lines = wrapLines(mctx, text, maxWidth)
  const linesPerPage = Math.max(1, Math.floor(contentH / linePx))
  const pageCount = Math.max(1, Math.ceil(Math.max(lines.length, 1) / linesPerPage))
  return { lines, linesPerPage, pageCount, maxWidth, linePx, contentH, footerH }
}

function drawPage(
  canvas: HTMLCanvasElement,
  lines: string[],
  pageIndex: number,
  linesPerPage: number,
  opts: {
    pageW: number
    pageH: number
    margin: number
    fontSize: number
    linePx: number
    maxWidth: number
    align: Align
    ink: string
    paper: string
    pageNumbers: boolean
    pageCount: number
  },
) {
  canvas.width = Math.round(opts.pageW)
  canvas.height = Math.round(opts.pageH)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = opts.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = opts.ink
  ctx.font = `${opts.fontSize}px ${FONT_STACK}`
  ctx.textBaseline = 'top'
  const slice = lines.slice(pageIndex * linesPerPage, (pageIndex + 1) * linesPerPage)
  slice.forEach((line, i) => {
    const y = opts.margin + i * opts.linePx
    if (opts.align === 'center') {
      ctx.textAlign = 'center'
      ctx.fillText(line, opts.pageW / 2, y, opts.maxWidth)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(line, opts.margin, y, opts.maxWidth)
    }
  })
  if (opts.pageNumbers) {
    ctx.textAlign = 'center'
    ctx.font = `${Math.max(8, opts.fontSize * 0.85)}px ${FONT_STACK}`
    ctx.fillStyle = opts.ink
    ctx.fillText(`${pageIndex + 1} / ${opts.pageCount}`, opts.pageW / 2, opts.pageH - opts.margin * 0.7)
  }
}

function safeFilename(name: string) {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
  return base.toLowerCase().endsWith('.pdf') ? base : `${base || 'text'}.pdf`
}

export default function Page() {
  const [text, setText] = useLocalStorage(
    'lab:text-to-pdf:text',
    'Hello PDF\n\n這是本機文字轉 PDF 示範（支援中文）\n\n可調整紙張、字級、行距與頁碼。',
  )
  const [paper, setPaper] = useLocalStorage<PaperId>('lab:text-to-pdf:paper', 'a4')
  const [landscape, setLandscape] = useLocalStorage('lab:text-to-pdf:landscape', false)
  const [size, setSize] = useLocalStorage('lab:text-to-pdf:size', 12)
  const [lineHeight, setLineHeight] = useLocalStorage('lab:text-to-pdf:lh', 1.55)
  const [margin, setMargin] = useLocalStorage('lab:text-to-pdf:margin', 48)
  const [align, setAlign] = useLocalStorage<Align>('lab:text-to-pdf:align', 'left')
  const [pageNumbers, setPageNumbers] = useLocalStorage('lab:text-to-pdf:pageno', true)
  const [filename, setFilename] = useLocalStorage('lab:text-to-pdf:filename', 'text.pdf')
  const [docTitle, setDocTitle] = useLocalStorage('lab:text-to-pdf:title', '')
  const [view, setView] = useLocalStorage<ViewMode>('lab:text-to-pdf:view', 'split')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [hint, setHint] = useState('')
  const [copied, setCopied] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const [lastBytes, setLastBytes] = useState(0)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const body = limitText(text, TEXT_MAX)
  const fontSize = clamp(size, 8, 28)
  const lh = clamp(lineHeight, 1.2, 2.2)
  const mg = clamp(margin, 24, 96)
  const { w: pageW, h: pageH } = pageSize(paper, landscape)

  const layout = useMemo(() => {
    if (typeof document === 'undefined') {
      return { lines: [] as string[], linesPerPage: 1, pageCount: 1, maxWidth: 100, linePx: fontSize * lh, contentH: 1, footerH: 0 }
    }
    return measureLayout(body || ' ', {
      pageW,
      pageH,
      margin: mg,
      fontSize,
      lineHeight: lh,
      pageNumbers,
    })
  }, [body, pageW, pageH, mg, fontSize, lh, pageNumbers])

  const overLimit = layout.pageCount > MAX_PAGES
  const stats = useMemo(() => {
    const lines = body ? body.replace(/\r\n/g, '\n').split('\n').length : 0
    return {
      chars: charCount(body),
      lines,
      words: countWords(body),
      pages: layout.pageCount,
      linesPerPage: layout.linesPerPage,
    }
  }, [body, layout.pageCount, layout.linesPerPage])

  useEffect(() => {
    setPreviewPage((p) => clamp(p, 0, Math.max(0, Math.min(layout.pageCount, MAX_PAGES) - 1)))
  }, [layout.pageCount])

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    const pages = Math.min(layout.pageCount, MAX_PAGES)
    const idx = clamp(previewPage, 0, Math.max(0, pages - 1))
    drawPage(canvas, layout.lines, idx, layout.linesPerPage, {
      pageW,
      pageH,
      margin: mg,
      fontSize,
      linePx: layout.linePx,
      maxWidth: layout.maxWidth,
      align,
      ink: '#111111',
      paper: '#ffffff',
      pageNumbers,
      pageCount: pages,
    })
  }, [layout, previewPage, pageW, pageH, mg, fontSize, align, pageNumbers])

  async function loadTxt(files: File[]) {
    const f = files[0]
    if (!f) return
    try {
      const raw = await f.text()
      setText(limitText(raw, TEXT_MAX))
      const stem = f.name.replace(/\.[^.]+$/, '')
      if (stem) setFilename(safeFilename(stem))
      setError('')
      setHint(`已載入「${f.name}」`)
    } catch {
      setError('讀取文字檔失敗')
    }
  }

  async function copyAll() {
    await copyText(body)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  function insertSnippet(label: string, rawInsert: string, cursorOffset?: number) {
    let snippet = rawInsert
    if (label === '今日日期') {
      snippet = new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } else if (label === '現在時間') {
      snippet = new Date().toLocaleString('zh-TW', { hour12: false })
    }
    const el = editorRef.current
    if (!el) {
      setText(limitText(text + snippet, TEXT_MAX))
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = snippet
    const caret = start + (cursorOffset ?? next.length)
    const merged = limitText(text.slice(0, start) + next + text.slice(end), TEXT_MAX)
    setText(merged)
    setError('')
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  function resetDefaults() {
    setPaper('a4')
    setLandscape(false)
    setSize(12)
    setLineHeight(1.55)
    setMargin(48)
    setAlign('left')
    setPageNumbers(true)
    setFilename('text.pdf')
    setDocTitle('')
    setError('')
    setHint('已還原預設版面')
  }

  async function run() {
    if (!isNonEmpty(body)) {
      setError('請輸入文字')
      return
    }
    if (overLimit) {
      setError(`內容過長（上限 ${MAX_PAGES} 頁，目前約 ${layout.pageCount} 頁），請縮短文字或調小字級`)
      return
    }
    setBusy(true)
    setError('')
    setProgress('排版中…')
    setHint('')
    try {
      const { lines, linesPerPage, pageCount, maxWidth, linePx } = measureLayout(body, {
        pageW,
        pageH,
        margin: mg,
        fontSize,
        lineHeight: lh,
        pageNumbers,
      })
      const pdf = await PDFDocument.create()
      const title = docTitle.trim() || filename.replace(/\.pdf$/i, '') || 'Text PDF'
      pdf.setTitle(title)
      pdf.setCreator('Mini Project Lab · TXT → PDF')
      pdf.setProducer('pdf-lib (browser)')
      pdf.setCreationDate(new Date())

      for (let p = 0; p < pageCount; p++) {
        setProgress(`產生第 ${p + 1}/${pageCount} 頁`)
        const canvas = document.createElement('canvas')
        drawPage(canvas, lines, p, linesPerPage, {
          pageW,
          pageH,
          margin: mg,
          fontSize,
          linePx,
          maxWidth,
          align,
          ink: '#111111',
          paper: '#ffffff',
          pageNumbers,
          pageCount,
        })
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
        if (!blob) continue
        const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()))
        const page = pdf.addPage([pageW, pageH])
        page.drawImage(jpg, { x: 0, y: 0, width: pageW, height: pageH })
      }
      if (pdf.getPageCount() < 1) {
        setError('產生失敗')
        return
      }
      const bytes = await pdf.save()
      const out = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
      setLastBytes(out.size)
      setHint(`已匯出 ${pdf.getPageCount()} 頁 · ${formatBytes(out.size)}`)
      downloadBlob(out, safeFilename(filename))
    } catch {
      setError('產生失敗，請縮短內容後再試')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const canRun = isNonEmpty(body) && !busy && !overLimit

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row ttp-shell-actions">
          <ActionButton className="btn sm ghost" onClick={resetDefaults} icon="reset" disabled={busy}>
            預設
          </ActionButton>
          <ActionButton className="btn sm accent" disabled={!canRun} onClick={() => void run()} icon="download">
            {busy ? progress || '產生中…' : '下載 PDF'}
          </ActionButton>
        </div>
      }
    >
      <div className="ttp-calc">
        <div className="panel ttp-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="row ttp-view-toggle">
              {(
                [
                  ['split', '並排'],
                  ['edit', '編輯'],
                  ['preview', '預覽'],
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
            <span className="tag">{stats.chars.toLocaleString()} 字</span>
            <span className="tag">{stats.words.toLocaleString()} 詞</span>
            <span className="tag">{stats.lines.toLocaleString()} 行</span>
            <span className={`tag${overLimit ? ' ttp-tag-warn' : ''}`}>
              約 {stats.pages} 頁{overLimit ? ` / 上限 ${MAX_PAGES}` : ''}
            </span>
            <span className="tag">
              {PAPERS[paper].label}
              {landscape ? ' 橫向' : ' 直向'}
            </span>
            {lastBytes > 0 && <span className="tag muted">上次 {formatBytes(lastBytes)}</span>}
          </div>
          <div className="pw-block">
            <div className="label">範本</div>
            <div className="pw-chips">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn sm ghost"
                  disabled={busy}
                  onClick={() => {
                    setText(p.body)
                    setHint(`已套用「${p.label}」範本`)
                    setError('')
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`ttp-main ttp-view-${view}`}>
          {(view === 'split' || view === 'edit') && (
            <section className="panel ttp-editor">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">編輯與設定</h3>
                <div className="row" style={{ gap: 6 }}>
                  <ActionButton className="btn sm ghost" onClick={() => void copyAll()} icon="copy" disabled={!body}>
                    {copied ? '已複製' : '複製'}
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => downloadText(safeFilename(filename).replace(/\.pdf$/i, '.txt'), body, 'text/plain;charset=utf-8')}
                    icon="download"
                    disabled={!body || busy}
                  >
                    下載 TXT
                  </ActionButton>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => {
                      setText('')
                      setHint('')
                      setError('')
                    }}
                    icon="trash"
                    disabled={!body || busy}
                  >
                    清除
                  </ActionButton>
                </div>
              </div>

              {error && <p className="field-error">{error}</p>}
              {hint && !error && <p className="field-hint">{hint}</p>}
              {busy && progress && <p className="field-hint">{progress}</p>}

              <FileDrop
                accept=".txt,text/plain"
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放 .txt，或點擊選擇"
                hint={`上限 ${formatBytes(FILE_MAX)}`}
                onFiles={(files) => void loadTxt(files)}
              />

              <div className="ttp-insert">
                <div className="label">插入</div>
                <div className="pw-chips">
                  {SNIPPETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="btn sm ghost"
                      disabled={busy}
                      onClick={() => insertSnippet(s.label, s.insert, s.cursor)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="stack">
                <span className="label">文字內容</span>
                <textarea
                  ref={editorRef}
                  className={`field ttp-textarea${!isNonEmpty(body) ? ' is-invalid' : ''}`}
                  value={text}
                  maxLength={TEXT_MAX}
                  disabled={busy}
                  spellCheck={false}
                  onChange={(e) => {
                    setText(limitText(e.target.value, TEXT_MAX))
                    setError('')
                  }}
                  aria-label="文字內容"
                />
                <div className="field-meta">
                  <span>每頁約 {stats.linesPerPage} 行</span>
                  <span>
                    {stats.chars.toLocaleString()} / {TEXT_MAX.toLocaleString()}
                  </span>
                </div>
              </label>

              <div className="ttp-controls">
                <div className="pw-block">
                  <div className="label">紙張快捷</div>
                  <div className="pw-chips">
                    {(Object.keys(PAPERS) as PaperId[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn sm ${paper === id ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setPaper(id)}
                      >
                        {PAPERS[id].label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`btn sm ${!landscape ? 'accent' : 'ghost'}`}
                      disabled={busy}
                      onClick={() => setLandscape(false)}
                    >
                      直向
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${landscape ? 'accent' : 'ghost'}`}
                      disabled={busy}
                      onClick={() => setLandscape(true)}
                    >
                      橫向
                    </button>
                  </div>
                </div>

                <div className="pw-block">
                  <div className="label">字級快捷</div>
                  <div className="pw-chips">
                    {FONT_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`btn sm ${fontSize === n ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setSize(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pw-block">
                  <div className="label">行距／邊界快捷</div>
                  <div className="pw-chips">
                    {LH_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`btn sm ${Math.abs(lh - n) < 0.01 ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setLineHeight(n)}
                      >
                        行距 {n}
                      </button>
                    ))}
                    {MARGIN_PRESETS.map((n) => (
                      <button
                        key={`m-${n}`}
                        type="button"
                        className={`btn sm ${mg === n ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setMargin(n)}
                      >
                        邊 {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ttp-fields-2">
                  <label className="stack">
                    <span className="label">紙張</span>
                    <select
                      className="field"
                      value={paper}
                      disabled={busy}
                      onChange={(e) => setPaper(e.target.value as PaperId)}
                    >
                      {(Object.keys(PAPERS) as PaperId[]).map((id) => (
                        <option key={id} value={id}>
                          {PAPERS[id].label}（{Math.round(PAPERS[id].w)}×{Math.round(PAPERS[id].h)} pt）
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span className="label">方向</span>
                    <div className="row ttp-seg">
                      <button
                        type="button"
                        className={`btn sm ${!landscape ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setLandscape(false)}
                      >
                        直向
                      </button>
                      <button
                        type="button"
                        className={`btn sm ${landscape ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setLandscape(true)}
                      >
                        橫向
                      </button>
                    </div>
                  </label>
                </div>

                <label className="stack">
                  <span className="label">
                    字級 {fontSize}px · 行距 {lh.toFixed(2)}
                  </span>
                  <div className="ttp-fields-2">
                    <input
                      type="range"
                      min={8}
                      max={28}
                      step={1}
                      disabled={busy}
                      value={fontSize}
                      onChange={(e) => setSize(clamp(Number(e.target.value), 8, 28))}
                    />
                    <input
                      type="range"
                      min={1.2}
                      max={2.2}
                      step={0.05}
                      disabled={busy}
                      value={lh}
                      onChange={(e) => setLineHeight(clamp(Number(e.target.value), 1.2, 2.2))}
                    />
                  </div>
                </label>

                <label className="stack">
                  <span className="label">邊界 {mg} pt</span>
                  <input
                    type="range"
                    min={24}
                    max={96}
                    step={2}
                    disabled={busy}
                    value={mg}
                    onChange={(e) => setMargin(clamp(Number(e.target.value), 24, 96))}
                  />
                </label>

                <div className="ttp-fields-2">
                  <label className="stack">
                    <span className="label">對齊</span>
                    <div className="row ttp-seg">
                      <button
                        type="button"
                        className={`btn sm ${align === 'left' ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setAlign('left')}
                      >
                        靠左
                      </button>
                      <button
                        type="button"
                        className={`btn sm ${align === 'center' ? 'accent' : 'ghost'}`}
                        disabled={busy}
                        onClick={() => setAlign('center')}
                      >
                        置中
                      </button>
                    </div>
                  </label>
                  <label className="ttp-check">
                    <input
                      type="checkbox"
                      checked={pageNumbers}
                      disabled={busy}
                      onChange={(e) => setPageNumbers(e.target.checked)}
                    />
                    顯示頁碼
                  </label>
                </div>

                <div className="ttp-fields-2">
                  <label className="stack">
                    <span className="label">檔名</span>
                    <input
                      className="field"
                      value={filename}
                      disabled={busy}
                      maxLength={90}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="text.pdf"
                    />
                  </label>
                  <label className="stack">
                    <span className="label">PDF 標題（中繼資料）</span>
                    <input
                      className="field"
                      value={docTitle}
                      disabled={busy}
                      maxLength={120}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="可選"
                    />
                  </label>
                </div>
              </div>

              <ActionButton className="btn accent ttp-run" disabled={!canRun} onClick={() => void run()} icon="download">
                {busy ? progress || '產生中…' : overLimit ? `超過 ${MAX_PAGES} 頁上限` : '產生並下載 PDF'}
              </ActionButton>
            </section>
          )}

          {(view === 'split' || view === 'preview') && (
            <section className="panel ttp-preview">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">預覽</h3>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={previewPage <= 0}
                    onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  >
                    上一頁
                  </button>
                  <span className="tag">
                    {Math.min(layout.pageCount, MAX_PAGES) === 0
                      ? '0 / 0'
                      : `${previewPage + 1} / ${Math.min(layout.pageCount, MAX_PAGES)}`}
                  </span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={previewPage >= Math.min(layout.pageCount, MAX_PAGES) - 1}
                    onClick={() =>
                      setPreviewPage((p) => Math.min(Math.min(layout.pageCount, MAX_PAGES) - 1, p + 1))
                    }
                  >
                    下一頁
                  </button>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                即時版面預覽（與下載結果一致）。點陣嵌入，可搜尋性有限。
              </p>
              <div className="ttp-preview-stage">
                <canvas ref={previewRef} className="ttp-canvas" aria-label="PDF 頁面預覽" />
              </div>
            </section>
          )}
        </div>

        <section className="panel ttp-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">運作方式</span>
              <strong>以 Canvas 繪製文字後轉 JPEG，再以 pdf-lib 嵌入各頁（本機完成）</strong>
            </li>
            <li>
              <span className="muted">中文支援</span>
              <strong>使用系統／網頁字型點陣，避免標準 PDF 字型缺字</strong>
            </li>
            <li>
              <span className="muted">紙張尺寸</span>
              <strong>
                {PAPERS[paper].label} · {Math.round(pageW)} × {Math.round(pageH)} pt（
                {landscape ? '橫向' : '直向'}）
              </strong>
            </li>
            <li>
              <span className="muted">預估頁數</span>
              <strong>
                {stats.pages} 頁（每頁約 {stats.linesPerPage} 行，上限 {MAX_PAGES}）
              </strong>
            </li>
            <li>
              <span className="muted">字數統計</span>
              <strong>
                {stats.chars.toLocaleString()} 字 · {stats.words.toLocaleString()} 詞 · {stats.lines} 行
              </strong>
            </li>
            <li>
              <span className="muted">可搜尋性</span>
              <strong>匯出為影像頁，多數閱讀器無法全文搜尋或複製文字</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>不上傳伺服器；內容只存在瀏覽器本機</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>長文可先調小字級／邊界；需要可搜尋 PDF 請改用系統列印→另存 PDF</strong>
            </li>
            <li>
              <span className="muted">相關工具</span>
              <strong>Markdown／HTML 轉 PDF、PDF 合併與浮水印</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
