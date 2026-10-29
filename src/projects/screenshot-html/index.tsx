import { PortfolioLayout } from '../../components/PortfolioLayout'
import { FtSection } from '../../components/FeatureToolUI'
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useLocalStorage } from '../../lib/storage'
import {
  KIND_META,
  PRESETS,
  SECTION_KINDS,
  SECTION_MAX,
  TITLE_MAX,
  layoutForPreset,
  toHtml,
  truncate,
  type Preset,
  type PresetId,
  type Section,
  type SectionKind,
} from '../../lib/screenshotHtml'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

type Workspace = 'build' | 'code'
type UndoSnap = { title: string; sections: Section[] }

const DRAG_THRESHOLD = 5
const UNDO_MAX = 28

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:screenshot-html:title', PRESETS[0]!.title)
  const [preset, setPreset] = useLocalStorage<PresetId>('lab:screenshot-html:preset', 'landing')
  const [sections, setSections] = useLocalStorage<Section[]>(
    'lab:screenshot-html:sections',
    PRESETS[0]!.sections.map((s) => ({ ...s, id: uid('s') })),
  )
  const [manualHtml, setManualHtml] = useLocalStorage('lab:screenshot-html:manual', '')
  const [codeMode, setCodeMode] = useLocalStorage('lab:screenshot-html:code-mode', false)

  const [workspace, setWorkspace] = useState<Workspace>('build')
  const [openId, setOpenId] = useState<string | null>(null)
  const [addKind, setAddKind] = useState<SectionKind>('section')
  const [copied, setCopied] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; kind: string; text: string } | null>(null)
  const [undoStack, setUndoStack] = useState<UndoSnap[]>([])

  const listRef = useRef<HTMLUListElement>(null)
  const dropIndexRef = useRef<number | null>(null)
  const dragRef = useRef<{
    id: string
    pointerId: number
    moved: boolean
    kind: SectionKind
    text: string
  } | null>(null)

  const activePreset = PRESETS.find((p) => p.id === preset) ?? PRESETS[0]!
  const layout = layoutForPreset(preset)

  const html = useMemo(() => toHtml(title, sections, layout), [title, sections, layout])
  const out = codeMode && manualHtml ? manualHtml : html

  const sectionChars = useMemo(() => sections.reduce((n, s) => n + s.text.length, 0), [sections])

  const pushUndo = useCallback(() => {
    setUndoStack((stack) => [
      ...stack.slice(-UNDO_MAX),
      { title, sections: sections.map((s) => ({ ...s })) },
    ])
  }, [title, sections])

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack
      const prev = stack[stack.length - 1]!
      setTitle(prev.title)
      setSections(prev.sections.map((s) => ({ ...s })))
      return stack.slice(0, -1)
    })
  }, [setTitle, setSections])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest('textarea, input, select, [contenteditable="true"]')) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const titleUndoArmed = useRef(false)

  const setDrop = useCallback((i: number | null) => {
    dropIndexRef.current = i
    setDropIndex(i)
  }, [])

  const applyPreset = useCallback(
    (p: Preset) => {
      if (p.id === preset) return
      if (
        sections.length > 0 &&
        !window.confirm(`套用「${p.label}」範本？目前的區塊會被取代。`)
      ) {
        return
      }
      pushUndo()
      setPreset(p.id)
      setTitle(p.title)
      setSections(p.sections.map((s) => ({ ...s, id: uid('s') })))
      setManualHtml('')
      setCodeMode(false)
      setWorkspace('build')
      setOpenId(null)
    },
    [preset, sections.length, pushUndo, setPreset, setTitle, setSections, setManualHtml, setCodeMode],
  )

  const updateSection = useCallback(
    (id: string, patch: Partial<Section>, recordUndo = true) => {
      if (recordUndo) pushUndo()
      setSections((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    },
    [pushUndo, setSections],
  )

  const sectionEditUndo = useRef(new Set<string>())

  const removeSection = useCallback(
    (id: string) => {
      pushUndo()
      setSections((xs) => xs.filter((x) => x.id !== id))
      setOpenId((cur) => (cur === id ? null : cur))
    },
    [pushUndo, setSections],
  )

  const addSection = useCallback(
    (kind: SectionKind, afterId?: string) => {
      pushUndo()
      const block: Section = { id: uid('s'), kind, text: KIND_META[kind].hint }
      setSections((xs) => {
        if (!afterId) return [...xs, block]
        const i = xs.findIndex((x) => x.id === afterId)
        if (i < 0) return [...xs, block]
        const next = xs.slice()
        next.splice(i + 1, 0, block)
        return next
      })
      setOpenId(block.id)
    },
    [pushUndo, setSections],
  )

  const reorder = useCallback(
    (fromId: string, toIndex: number) => {
      setSections((xs) => {
        const from = xs.findIndex((x) => x.id === fromId)
        if (from < 0) return xs
        const next = xs.slice()
        const [item] = next.splice(from, 1)
        let to = Math.min(toIndex, next.length)
        if (from < to) to -= 1
        to = Math.max(0, Math.min(to, next.length))
        if (from === to || !item) return xs
        next.splice(to, 0, item)
        return next
      })
    },
    [setSections],
  )

  const indexAtPointer = useCallback((clientY: number) => {
    const list = listRef.current
    if (!list) return null
    const items = list.querySelectorAll<HTMLElement>('[data-block-id]')
    for (let i = 0; i < items.length; i++) {
      const el = items[i]!
      const r = el.getBoundingClientRect()
      const mid = r.top + r.height / 2
      if (clientY < mid) return i
    }
    return items.length
  }, [])

  const finishDrag = useCallback(
    (el: HTMLElement, pointerId: number) => {
      const d = dragRef.current
      const idx = dropIndexRef.current
      if (d?.moved && idx != null) {
        pushUndo()
        reorder(d.id, idx)
      }
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
      dragRef.current = null
      setDraggingId(null)
      setDrop(null)
      setGhost(null)
    },
    [pushUndo, reorder, setDrop],
  )

  const onGripMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const d = dragRef.current
      if (!d || d.pointerId !== e.pointerId) return
      e.preventDefault()
      if (!d.moved && Math.abs(e.movementY) + Math.abs(e.movementX) >= DRAG_THRESHOLD) d.moved = true
      if (!d.moved) return
      setGhost({
        x: e.clientX + 14,
        y: e.clientY + 10,
        kind: KIND_META[d.kind].label,
        text: truncate(d.text, 42),
      })
      const idx = indexAtPointer(e.clientY)
      if (idx != null) setDrop(idx)
    },
    [indexAtPointer, setDrop],
  )

  const onGripUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      finishDrag(e.currentTarget, e.pointerId)
    },
    [finishDrag],
  )

  function startGrip(e: React.PointerEvent<HTMLElement>, s: Section) {
    if (codeMode) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      id: s.id,
      pointerId: e.pointerId,
      moved: false,
      kind: s.kind,
      text: s.text,
    }
    setDraggingId(s.id)
  }

  async function copyOut() {
    await copyText(out)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function openPreviewTab() {
    const blob = new Blob([out], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  }

  function enterCodeMode() {
    setManualHtml(html)
    setCodeMode(true)
    setWorkspace('code')
  }

  function exitCodeMode(resync: boolean) {
    if (resync) {
      setManualHtml('')
      setCodeMode(false)
    } else {
      setCodeMode(true)
    }
    setWorkspace('build')
  }

  return (
    <PortfolioLayout
      slug="screenshot-html"
      heroSubtitle="描述頁面有哪些區塊（不是 AI 辨識截圖）→ 即時預覽 → 匯出單檔 HTML。適合 wireframe、作業起稿。"
      metrics={[
        { label: '範本', value: activePreset.label },
        { label: '區塊', value: `${sections.length} 個` },
        { label: '字數', value: `${sectionChars}` },
        { label: '工作區', value: workspace === 'build' ? '結構' : '原始碼' },
      ]}
      footerHint="預覽為示意樣式；上線前請依設計系統調整 CSS。Docs 範本會將 sidebar 與內文並排。"
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" onClick={() => void copyOut()} icon="copy">
            {copied ? '已複製' : '複製 HTML'}
          </ActionButton>
          <button type="button" className="btn sm ghost" onClick={openPreviewTab}>
            新分頁預覽
          </button>
          <button
            type="button"
            className="btn sm teal"
            onClick={() => downloadText(`${title || 'page'}.html`, out, 'text/html;charset=utf-8')}
          >
            下載 .html
          </button>
        </div>
      }
    >
      <FtSection title="版面範本" hint="由左至右選一種起點；套用後仍可調整區塊與順序。">
        <div className="sh-tmpl-grid" role="list">
          {PRESETS.map((p) => {
            const active = preset === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="listitem"
                className={cn('sh-tmpl-card panel', active && 'is-active')}
                onClick={() => applyPreset(p)}
              >
                <span className="sh-tmpl-emoji" aria-hidden>
                  {p.emoji}
                </span>
                <span className="sh-tmpl-label">{p.label}</span>
                <span className="muted sh-tmpl-hint">{p.hint}</span>
                <span className="muted sh-tmpl-meta">{p.sections.length} 區塊</span>
              </button>
            )
          })}
        </div>
      </FtSection>

      <div className="panel sh-workspace-bar">
        <div className="panel-body row sh-workspace-tabs">
          <button
            type="button"
            className={cn('btn sm', workspace === 'build' && !codeMode ? 'teal' : 'ghost')}
            onClick={() => {
              setCodeMode(false)
              setWorkspace('build')
            }}
          >
            結構編輯
          </button>
          <button type="button" className={cn('btn sm', workspace === 'code' || codeMode ? 'teal' : 'ghost')} onClick={enterCodeMode}>
            HTML 原始碼
          </button>
          {codeMode && workspace === 'build' && (
            <span className="muted sh-code-badge">原始碼已鎖定結構 · 返回原始碼分頁可繼續改</span>
          )}
        </div>
      </div>

      {workspace === 'code' ? (
        <div className="panel stack sh-code-panel">
          <div className="panel-head">
            <span className="pw-panel-title">編輯 HTML</span>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => exitCodeMode(false)}>
                返回結構（保留 HTML）
              </button>
              <button type="button" className="btn sm accent" onClick={() => exitCodeMode(true)}>
                放棄 HTML、同步區塊
              </button>
            </div>
          </div>
          <div className="panel-body sh-code-body">
            <textarea
              className="field mono sh-code-textarea"
              value={manualHtml || html}
              onChange={(e) => setManualHtml(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="panel stack sh-build-panel">
            <div className="panel-head">
              <span className="pw-panel-title">頁面大綱</span>
              <div className="row sh-add-row">
                <button type="button" className="btn sm ghost" disabled={!undoStack.length || codeMode} onClick={undo}>
                  還原上一步
                </button>
                <select
                  className="field sh-add-kind"
                  value={addKind}
                  disabled={codeMode}
                  onChange={(e) => setAddKind(e.target.value as SectionKind)}
                >
                  {SECTION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_META[k].label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn sm teal" disabled={codeMode} onClick={() => addSection(addKind)}>
                  新增區塊
                </button>
              </div>
            </div>
            <div className="panel-body stack sh-build-body">
              <label className="sh-title-field">
                <span className="label">頁面標題</span>
                <input
                  className={cn('field', !isNonEmpty(title) && 'is-invalid')}
                  maxLength={TITLE_MAX}
                  value={title}
                  disabled={codeMode}
                  onFocus={() => {
                    titleUndoArmed.current = false
                  }}
                  onChange={(e) => {
                    if (!titleUndoArmed.current) {
                      pushUndo()
                      titleUndoArmed.current = true
                    }
                    setTitle(limitText(e.target.value, TITLE_MAX))
                  }}
                  placeholder="寫入 &lt;title&gt; 與 hero 主標"
                />
                <div className="field-meta">
                  <span className={!isNonEmpty(title) ? 'warn' : undefined}>
                    {isNonEmpty(title) ? 'OK' : '請填標題'}
                  </span>
                  <span>
                    {charCount(title)}/{TITLE_MAX}
                  </span>
                </div>
              </label>

              <ul ref={listRef} className={cn('sh-outline', draggingId && 'is-dnd-active')}>
                {sections.map((s, i) => {
                  const open = openId === s.id
                  const dragging = draggingId === s.id
                  const showSlot = draggingId && dropIndex === i && draggingId !== s.id
                  return (
                    <Fragment key={s.id}>
                      {showSlot && <li className="sh-drop-slot" aria-hidden />}
                      <li
                        data-block-id={s.id}
                        className={cn('sh-block', open && 'is-open', dragging && 'is-dragging')}
                      >
                      <div className="sh-block-summary">
                        <button
                          type="button"
                          className="sh-grip"
                          aria-label="拖曳排序"
                          disabled={codeMode}
                          onPointerDown={(e) => startGrip(e, s)}
                          onPointerMove={onGripMove}
                          onPointerUp={onGripUp}
                          onPointerCancel={onGripUp}
                        >
                          ⋮⋮
                        </button>
                        <button
                          type="button"
                          className="sh-block-toggle"
                          disabled={codeMode}
                          onClick={() => setOpenId(open ? null : s.id)}
                        >
                          <span className={cn('tag sh-kind-tag', `sh-kind-${s.kind}`)}>{KIND_META[s.kind].label}</span>
                          <span className="sh-block-preview">{truncate(s.text)}</span>
                        </button>
                        <span className="mono muted sh-block-idx">{i + 1}</span>
                        <button
                          type="button"
                          className="btn sm ghost"
                          disabled={codeMode}
                          aria-label="刪除區塊"
                          onClick={() => removeSection(s.id)}
                        >
                          刪
                        </button>
                      </div>
                      {open && !codeMode && (
                        <div className="sh-block-edit stack">
                          <div className="sh-kind-pills" role="group" aria-label="區塊類型">
                            {SECTION_KINDS.map((k) => (
                              <button
                                key={k}
                                type="button"
                                className={cn('btn sm', s.kind === k ? 'teal' : 'ghost')}
                                onClick={() => {
                                  if (s.kind === k) return
                                  updateSection(s.id, { kind: k })
                                }}
                              >
                                {KIND_META[k].label}
                              </button>
                            ))}
                          </div>
                          <p className="muted sh-kind-hint">{KIND_META[s.kind].hint}</p>
                          <textarea
                            className="field sh-block-text"
                            rows={3}
                            maxLength={SECTION_MAX}
                            value={s.text}
                            onFocus={() => {
                              if (!sectionEditUndo.current.has(s.id)) {
                                pushUndo()
                                sectionEditUndo.current.add(s.id)
                              }
                            }}
                            onBlur={() => sectionEditUndo.current.delete(s.id)}
                            onChange={(e) =>
                              updateSection(s.id, { text: limitText(e.target.value, SECTION_MAX) }, false)
                            }
                          />
                          <div className="field-meta">
                            <button type="button" className="btn sm ghost" onClick={() => addSection(s.kind, s.id)}>
                              下方插入區塊
                            </button>
                            <span>
                              {charCount(s.text)}/{SECTION_MAX}
                            </span>
                          </div>
                        </div>
                      )}
                    </li>
                    </Fragment>
                  )
                })}
                {draggingId && dropIndex === sections.length && (
                  <li className="sh-drop-slot" aria-hidden />
                )}
                {!sections.length && (
                  <li className="sh-outline-empty muted">尚無區塊 — 選範本或按「新增區塊」</li>
                )}
              </ul>
            </div>
          </div>

          <div className="panel stack sh-stage">
            <div className="panel-head">
              <span className="pw-panel-title">即時預覽</span>
              <span className="muted">全寬 · 由大綱由上而下組版</span>
            </div>
            <div className="panel-body sh-stage-body">
              <iframe title="頁面預覽" className="sh-preview" srcDoc={out} sandbox="allow-same-origin" />
            </div>
          </div>

          <details className="panel sh-source-details">
            <summary className="sh-source-summary panel-head">
              <span className="pw-panel-title">HTML 原始碼（唯讀）</span>
              <ActionButton
                className="btn sm ghost"
                icon="copy"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void copyOut()
                }}
              >
                {copied ? '已複製' : '複製'}
              </ActionButton>
            </summary>
            <pre className="panel-body mono sh-source-read">{html}</pre>
          </details>
        </>
      )}

      {workspace === 'code' && (
        <div className="panel stack sh-stage">
          <div className="panel-head">
            <span className="pw-panel-title">預覽（依目前 HTML）</span>
          </div>
          <div className="panel-body sh-stage-body">
            <iframe title="頁面預覽" className="sh-preview" srcDoc={out} sandbox="allow-same-origin" />
          </div>
        </div>
      )}
      {ghost && (
        <div
          className="sh-drag-ghost"
          style={{ transform: `translate(${ghost.x}px, ${ghost.y}px)` }}
          aria-hidden
        >
          <span className="tag sh-kind-tag">{ghost.kind}</span>
          <span className="sh-drag-ghost-text">{ghost.text}</span>
        </div>
      )}
    </PortfolioLayout>
  )
}
