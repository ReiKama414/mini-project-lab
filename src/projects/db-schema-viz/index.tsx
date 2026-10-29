import { PortfolioLayout } from '../../components/PortfolioLayout'
import { AddButton } from '../../components/AddButton'
import { FtSection } from '../../components/FeatureToolUI'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, copyText, downloadText, isNonEmpty, limitText, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const NAME_MAX = 64
const FK_MAX = 80
const POS_MIN = 0
const POS_MAX = 4000
const TABLE_W = 228
const DRAG_THRESHOLD = 4

type Col = { id: string; name: string; type: string; pk?: boolean; fk?: string }
type Table = { id: string; name: string; cols: Col[]; x: number; y: number }

const TYPES = ['uuid', 'text', 'int', 'numeric', 'bool', 'timestamptz']

const DEFAULT_TABLES: Table[] = [
  {
    id: 'users',
    name: 'users',
    x: 40,
    y: 40,
    cols: [
      { id: 'c1', name: 'id', type: 'uuid', pk: true },
      { id: 'c2', name: 'email', type: 'text' },
      { id: 'c3', name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    id: 'orders',
    name: 'orders',
    x: 320,
    y: 40,
    cols: [
      { id: 'c4', name: 'id', type: 'uuid', pk: true },
      { id: 'c5', name: 'user_id', type: 'uuid', fk: 'users.id' },
      { id: 'c6', name: 'total', type: 'numeric' },
      { id: 'c6b', name: 'status', type: 'text' },
    ],
  },
  {
    id: 'items',
    name: 'order_items',
    x: 600,
    y: 60,
    cols: [
      { id: 'c7', name: 'id', type: 'uuid', pk: true },
      { id: 'c8', name: 'order_id', type: 'uuid', fk: 'orders.id' },
      { id: 'c9', name: 'product_id', type: 'uuid', fk: 'products.id' },
      { id: 'c10', name: 'qty', type: 'int' },
    ],
  },
  {
    id: 'products',
    name: 'products',
    x: 600,
    y: 280,
    cols: [
      { id: 'c11', name: 'id', type: 'uuid', pk: true },
      { id: 'c12', name: 'sku', type: 'text' },
      { id: 'c13', name: 'price', type: 'numeric' },
      { id: 'c14', name: 'category_id', type: 'uuid', fk: 'categories.id' },
    ],
  },
  {
    id: 'categories',
    name: 'categories',
    x: 320,
    y: 300,
    cols: [
      { id: 'c15', name: 'id', type: 'uuid', pk: true },
      { id: 'c16', name: 'name', type: 'text' },
    ],
  },
  {
    id: 'payments',
    name: 'payments',
    x: 40,
    y: 280,
    cols: [
      { id: 'c17', name: 'id', type: 'uuid', pk: true },
      { id: 'c18', name: 'order_id', type: 'uuid', fk: 'orders.id' },
      { id: 'c19', name: 'amount', type: 'numeric' },
      { id: 'c20', name: 'paid_at', type: 'timestamptz' },
    ],
  },
]

function toMermaid(tables: Table[]) {
  const lines = ['erDiagram']
  for (const t of tables) {
    lines.push(`  ${t.name} {`)
    for (const c of t.cols) {
      const flags = [c.pk ? 'PK' : '', c.fk ? 'FK' : ''].filter(Boolean).join(',')
      lines.push(`    ${c.type} ${c.name}${flags ? ` ${flags}` : ''}`)
    }
    lines.push('  }')
  }
  for (const t of tables) {
    for (const c of t.cols) {
      if (!c.fk) continue
      const [refTable] = c.fk.split('.')
      if (refTable) lines.push(`  ${t.name} }o--|| ${refTable} : "${c.name}"`)
    }
  }
  return lines.join('\n')
}

function tableHeight(t: Table) {
  return 44 + t.cols.length * 58 + 36
}

function linkAnchors(from: Table, to: Table) {
  const fromCy = from.y + 22
  const toCy = to.y + 22
  const fromCx = from.x + TABLE_W / 2
  const toCx = to.x + TABLE_W / 2
  const fromRight = toCx >= fromCx
  return {
    x1: fromRight ? from.x + TABLE_W : from.x,
    y1: fromCy,
    x2: fromRight ? to.x : to.x + TABLE_W,
    y2: toCy,
  }
}

export default function Page() {
  const [tables, setTables] = useLocalStorage<Table[]>('lab:db-schema-viz:v2', DEFAULT_TABLES)
  const [relFrom, setRelFrom] = useState('')
  const [relTo, setRelTo] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const suppressClickRef = useRef(false)
  const dragRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)

  const colCount = useMemo(() => tables.reduce((n, t) => n + t.cols.length, 0), [tables])

  const pkOptions = useMemo(
    () =>
      tables.flatMap((t) =>
        t.cols.filter((c) => c.pk).map((c) => ({ value: `${t.name}.${c.name}`, label: `${t.name}.${c.name}` })),
      ),
    [tables],
  )

  const colOptions = useMemo(
    () => tables.flatMap((t) => t.cols.map((c) => ({ value: `${t.id}:${c.id}`, label: `${t.name}.${c.name}` }))),
    [tables],
  )

  const relations = useMemo(() => {
    const lines: { from: Table; to: Table; label: string; fromId: string; toId: string }[] = []
    for (const t of tables) {
      for (const c of t.cols) {
        if (!c.fk) continue
        const [refTable] = c.fk.split('.')
        const target = tables.find((x) => x.name === refTable || x.id === refTable)
        if (target) lines.push({ from: t, to: target, label: `${t.name}.${c.name} → ${c.fk}`, fromId: t.id, toId: target.id })
      }
    }
    return lines
  }, [tables])

  const mermaid = useMemo(() => toMermaid(tables), [tables])

  const canvasSize = useMemo(() => {
    let w = 960
    let h = 560
    for (const t of tables) {
      w = Math.max(w, t.x + TABLE_W + 80)
      h = Math.max(h, t.y + tableHeight(t) + 80)
    }
    return { w, h }
  }, [tables])

  const relatedIds = useMemo(() => {
    if (!selected) return new Set<string>()
    const ids = new Set<string>([selected])
    for (const r of relations) {
      if (r.fromId === selected) ids.add(r.toId)
      if (r.toId === selected) ids.add(r.fromId)
    }
    return ids
  }, [selected, relations])

  const finishDrag = useCallback((el: HTMLElement, pointerId: number) => {
    const d = dragRef.current
    if (d?.moved) suppressClickRef.current = true
    if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId)
    dragRef.current = null
    setDraggingId(null)
  }, [])

  const onTablePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const d = dragRef.current
      if (!d || d.pointerId !== e.pointerId) return
      e.preventDefault()
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (!d.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) d.moved = true
      if (!d.moved) return
      const nx = clamp(Math.round(d.origX + dx), POS_MIN, POS_MAX)
      const ny = clamp(Math.round(d.origY + dy), POS_MIN, POS_MAX)
      setTables((xs) => xs.map((x) => (x.id === d.id ? { ...x, x: nx, y: ny } : x)))
    },
    [setTables],
  )

  const onTablePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const d = dragRef.current
      if (!d || d.pointerId !== e.pointerId) return
      finishDrag(e.currentTarget, e.pointerId)
    },
    [finishDrag],
  )

  function startTableDrag(e: React.PointerEvent<HTMLElement>, t: Table) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      id: t.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      moved: false,
    }
    setDraggingId(t.id)
    setSelected(t.id)
  }

  function addTable() {
    const id = uid('t')
    setTables((xs) => [
      ...xs,
      {
        id,
        name: `table_${xs.length + 1}`,
        x: 60 + (xs.length % 4) * 40,
        y: 200 + xs.length * 12,
        cols: [{ id: uid('c'), name: 'id', type: 'int', pk: true }],
      },
    ])
    setSelected(id)
  }

  function autoLayout() {
    const cols = 3
    const gapX = 280
    const gapY = 300
    setTables((xs) =>
      xs.map((t, i) => ({
        ...t,
        x: 32 + (i % cols) * gapX,
        y: 32 + Math.floor(i / cols) * gapY,
      })),
    )
  }

  function resetDemo() {
    if (!window.confirm('還原內建範例？會覆寫目前畫布上的所有資料表。')) return
    setTables(DEFAULT_TABLES)
    setSelected(null)
  }

  function updateCol(tableId: string, colId: string, patch: Partial<Col>) {
    setTables((xs) =>
      xs.map((t) => (t.id === tableId ? { ...t, cols: t.cols.map((c) => (c.id === colId ? { ...c, ...patch } : c)) } : t)),
    )
  }

  function linkRelation() {
    if (!relFrom || !relTo) return
    const [tid, cid] = relFrom.split(':')
    setTables((xs) =>
      xs.map((t) => (t.id === tid ? { ...t, cols: t.cols.map((c) => (c.id === cid ? { ...c, fk: relTo } : c)) } : t)),
    )
    if (tid) setSelected(tid)
    setRelFrom('')
    setRelTo('')
  }

  async function copyMermaid() {
    await copyText(mermaid)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <PortfolioLayout
      slug="db-schema-viz"
      heroSubtitle="在畫布上編輯資料表與外鍵，即時產生 Mermaid ER 圖。拖曳表頭移動位置，不連線真實資料庫。"
      metrics={[
        { label: '資料表', value: `${tables.length} 張` },
        { label: '欄位', value: `${colCount} 個` },
        { label: 'FK 關聯', value: `${relations.length} 條` },
        { label: '儲存', value: '本機 localStorage', mono: true },
      ]}
      footerHint="拖曳表頭 ⋮⋮ 移動資料表；在空白畫布點一下可取消選取。Mermaid 僅供文件／簡報，請以實際 migration 為準。"
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" onClick={copyMermaid} icon="copy">
            {copied ? '已複製 Mermaid' : '複製 Mermaid'}
          </ActionButton>
          <ActionButton
            className="btn sm teal"
            onClick={() => downloadText('schema.mmd', mermaid, 'text/plain;charset=utf-8')}
            icon="download"
          >
            匯出 .mmd
          </ActionButton>
          <AddButton type="button" className="sm" onClick={addTable}>
            新增資料表
          </AddButton>
        </div>
      }
    >
      <FtSection title="關聯與版面" hint="選來源欄位與目標 PK 建立 FK；或使用自動排列整理重疊的表。">
        <div className="panel dsv-toolbar">
          <div className="panel-head">
            <span className="pw-panel-title">快速建立外鍵</span>
            <span className="muted dsv-toolbar-meta">
              {tables.length} 表 · {relations.length} 關聯
            </span>
          </div>
          <div className="panel-body row dsv-toolbar-body">
            <select className="field dsv-field-from" value={relFrom} onChange={(e) => setRelFrom(e.target.value)}>
              <option value="">來源欄位</option>
              {colOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="muted" aria-hidden>
              →
            </span>
            <select className="field dsv-field-to" value={relTo} onChange={(e) => setRelTo(e.target.value)}>
              <option value="">目標 PK</option>
              {pkOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn sm teal" onClick={linkRelation} disabled={!relFrom || !relTo}>
              建立 FK
            </button>
            <button type="button" className="btn sm ghost" onClick={autoLayout}>
              自動排列
            </button>
            <button type="button" className="btn sm ghost" onClick={resetDemo}>
              還原範例
            </button>
            {selected && (
              <button type="button" className="btn sm ghost" onClick={() => setSelected(null)}>
                取消選取
              </button>
            )}
          </div>
        </div>
      </FtSection>

      <FtSection title="ER 畫布" hint="按住表頭左側 ⋮⋮ 拖曳；編輯欄位時請在輸入框內操作，避免從文字區開始拖曳造成選取。">
        <div
          ref={canvasRef}
          className={`panel dsv-canvas${draggingId ? ' is-dragging' : ''}`}
          style={{ minHeight: 520 }}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            setSelected(null)
          }}
        >
          <div className="dsv-canvas-inner" style={{ width: canvasSize.w, height: canvasSize.h }}>
            <svg className="dsv-links" width={canvasSize.w} height={canvasSize.h} aria-hidden>
              {relations.map((r, i) => {
                const active = !selected || relatedIds.has(r.fromId) || relatedIds.has(r.toId)
                const focus = selected && (r.fromId === selected || r.toId === selected)
                const { x1, y1, x2, y2 } = linkAnchors(r.from, r.to)
                return (
                  <g key={i}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={focus ? 'var(--accent)' : 'var(--sky)'}
                      strokeWidth={focus ? 3 : 2}
                      strokeDasharray="6 4"
                      opacity={active ? 1 : 0.22}
                    />
                    <title>{r.label}</title>
                  </g>
                )
              })}
            </svg>

            {tables.map((t) => {
              const isSel = selected === t.id
              const isRel = relatedIds.has(t.id)
              const isDrag = draggingId === t.id
              return (
                <div
                  key={t.id}
                  className={`dsv-table panel${isSel ? ' is-selected' : ''}${isRel && selected ? ' is-related' : ''}${isDrag ? ' is-dragging' : ''}`}
                  style={{ left: t.x, top: t.y, width: TABLE_W }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    setSelected(t.id)
                  }}
                >
                  <div className="dsv-table__head">
                    <button
                      type="button"
                      className="dsv-table__grip"
                      aria-label="拖曳移動資料表"
                      onPointerDown={(e) => startTableDrag(e, t)}
                      onPointerMove={onTablePointerMove}
                      onPointerUp={onTablePointerUp}
                      onPointerCancel={onTablePointerUp}
                    >
                      ⋮⋮
                    </button>
                    <input
                      className="dsv-table__name"
                      value={t.name}
                      maxLength={NAME_MAX}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setTables((xs) =>
                          xs.map((x) => (x.id === t.id ? { ...x, name: limitText(e.target.value, NAME_MAX) } : x)),
                        )
                      }
                    />
                    <span className="dsv-table__pos mono" title="位置 (x, y)">
                      {t.x},{t.y}
                    </span>
                    <button
                      type="button"
                      className="btn sm ghost dsv-table__del"
                      aria-label={`刪除資料表 ${t.name}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTables((xs) => xs.filter((x) => x.id !== t.id))
                        if (selected === t.id) setSelected(null)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <ul className="list dsv-table__cols">
                    {t.cols.map((c) => (
                      <li key={c.id} className="list-item stack dsv-col">
                        <div className="row dsv-col-row">
                          <label className="row dsv-pk" title="Primary key">
                            <input type="checkbox" checked={!!c.pk} onChange={(e) => updateCol(t.id, c.id, { pk: e.target.checked })} />
                            PK
                          </label>
                          {c.fk && <span className="tag">FK</span>}
                          <input
                            className={`field${!isNonEmpty(c.name) ? ' is-invalid' : ''}`}
                            value={c.name}
                            maxLength={NAME_MAX}
                            onChange={(e) => updateCol(t.id, c.id, { name: limitText(e.target.value, NAME_MAX) })}
                          />
                          <span className="muted dsv-char-count">
                            {charCount(c.name)}/{NAME_MAX}
                          </span>
                          <button
                            type="button"
                            className="btn sm danger"
                            aria-label={`刪除欄位 ${c.name}`}
                            onClick={() =>
                              setTables((xs) =>
                                xs.map((x) => (x.id === t.id ? { ...x, cols: x.cols.filter((col) => col.id !== c.id) } : x)),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="row dsv-col-row">
                          <select className="field" value={c.type} onChange={(e) => updateCol(t.id, c.id, { type: e.target.value })}>
                            {TYPES.map((ty) => (
                              <option key={ty}>{ty}</option>
                            ))}
                          </select>
                          <input
                            className="field mono"
                            placeholder="fk table.col"
                            value={c.fk || ''}
                            maxLength={FK_MAX}
                            onChange={(e) => updateCol(t.id, c.id, { fk: limitText(e.target.value, FK_MAX) || undefined })}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn sm ghost dsv-add-col"
                    onClick={() =>
                      setTables((xs) =>
                        xs.map((x) => (x.id === t.id ? { ...x, cols: [...x.cols, { id: uid('c'), name: 'col', type: 'text' }] } : x)),
                      )
                    }
                  >
                    + 欄位
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </FtSection>

      <div className="grid-2 dsv-bottom">
        <div className="panel stack">
          <div className="panel-head">
            <span className="pw-panel-title">關聯清單</span>
            <span className="muted">點選可聚焦資料表</span>
          </div>
          <ul className="list panel-body dsv-rel-list">
            {relations.map((r, i) => (
              <li
                key={i}
                className={`list-item mono dsv-rel-item${selected && (r.fromId === selected || r.toId === selected) ? ' is-focus' : ''}`}
                onClick={() => setSelected(r.fromId)}
              >
                {r.label}
              </li>
            ))}
            {!relations.length && <li className="list-item muted">尚無關聯 — 在上方建立 FK 或於欄位填寫 fk table.col</li>}
          </ul>
        </div>
        <div className="panel stack">
          <div className="panel-head">
            <span className="pw-panel-title">Mermaid 預覽</span>
            <ActionButton className="btn sm ghost" icon="copy" onClick={copyMermaid}>
              {copied ? '已複製' : '複製'}
            </ActionButton>
          </div>
          <pre className="panel-body mono dsv-mermaid">{mermaid}</pre>
        </div>
      </div>
    </PortfolioLayout>
  )
}
