import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('packing-list')!

type PackItem = { id: string; name: string; packed: boolean; category: string }

const TEMPLATES: Record<string, { category: string; name: string }[]> = {
  週末旅遊: [
    { category: '電子', name: '充電器' },
    { category: '衣物', name: '換洗衣物' },
    { category: '盥洗', name: '盥洗用品' },
    { category: '證件', name: '錢包' },
    { category: '證件', name: '證件' },
    { category: '其他', name: '雨傘' },
  ],
  商務出差: [
    { category: '電子', name: '筆電' },
    { category: '電子', name: '充電器' },
    { category: '衣物', name: '西裝／正裝' },
    { category: '證件', name: '名片' },
    { category: '證件', name: '證件' },
    { category: '電子', name: '轉接頭' },
    { category: '其他', name: '筆記本' },
  ],
  海邊度假: [
    { category: '衣物', name: '泳裝' },
    { category: '盥洗', name: '防曬乳' },
    { category: '衣物', name: '拖鞋' },
    { category: '其他', name: '墨鏡' },
    { category: '盥洗', name: '毛巾' },
    { category: '衣物', name: '換洗衣物' },
    { category: '電子', name: '充電器' },
  ],
  登山健行: [
    { category: '衣物', name: '登山鞋' },
    { category: '其他', name: '水壺' },
    { category: '衣物', name: '帽子' },
    { category: '其他', name: '急救包' },
    { category: '衣物', name: '雨衣' },
    { category: '其他', name: '零食' },
    { category: '電子', name: '手電筒' },
  ],
  出國長途: [
    { category: '證件', name: '護照' },
    { category: '證件', name: '機票／訂房確認' },
    { category: '電子', name: '轉接頭／行動電源' },
    { category: '衣物', name: '足夠換洗衣物' },
    { category: '盥洗', name: '盥洗組' },
    { category: '其他', name: '藥物' },
    { category: '其他', name: '當地貨幣／信用卡' },
  ],
}

const CATS = ['證件', '衣物', '盥洗', '電子', '其他']

export default function Page() {
  const [items, setItems] = useLocalStorage<PackItem[]>('lab:packing-list', [])
  const [tripType, setTripType] = useLocalStorage<string>('lab:packing-list:trip', '')
  const [custom, setCustom] = useState('')
  const [customCat, setCustomCat] = useState(CATS[0]!)
  const [merge, setMerge] = useState(true)

  function applyTemplate(key: string) {
    const list = TEMPLATES[key] || []
    const mapped = list.map((x) => ({ id: uid('pk'), name: x.name, packed: false, category: x.category }))
    if (merge && items.length) {
      const existing = new Set(items.map((i) => i.name))
      const extras = mapped.filter((m) => !existing.has(m.name))
      setItems([...items, ...extras])
    } else {
      setItems(mapped)
    }
    setTripType(key)
  }

  function add() {
    if (!custom.trim()) return
    setItems([...items, { id: uid('pk'), name: custom.trim(), packed: false, category: customCat }])
    setCustom('')
  }

  function toggleAll(packed: boolean) {
    setItems(items.map((i) => ({ ...i, packed })))
  }

  const packed = items.filter((i) => i.packed).length
  const pct = items.length ? Math.round((packed / items.length) * 100) : 0

  const grouped = CATS.map((c) => [
    c,
    items.filter((i) => (i.category || '其他') === c),
  ] as const).filter(([, list]) => list.length)

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="label">旅程類型預設</div>
        <div className="row">
          {Object.keys(TEMPLATES).map((k) => (
            <button key={k} className={`btn sm ${tripType === k ? 'teal' : 'ghost'}`} onClick={() => applyTemplate(k)}>
              {k}
            </button>
          ))}
        </div>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
          <span className="muted">套用預設時合併既有項目（不重複）</span>
        </label>
        <div className="row">
          <input
            className="field"
            style={{ flex: 1, minWidth: 120 }}
            placeholder="自訂項目…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select className="field" style={{ maxWidth: 120 }} value={customCat} onChange={(e) => setCustomCat(e.target.value)}>
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn accent" onClick={add}>
            新增
          </button>
        </div>
        {items.length > 0 && (
          <>
            <div className="row">
              <span className="muted">
                已打包 {packed}/{items.length}（{pct}%）
              </span>
              <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => toggleAll(true)}>
                全部勾選
              </button>
              <button className="btn sm ghost" onClick={() => toggleAll(false)}>
                全部取消
              </button>
              <button className="btn sm ghost" onClick={() => setItems([])}>
                清空清單
              </button>
            </div>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="panel stack">
        {grouped.map(([cat, list]) => (
          <div key={cat} className="stack" style={{ gap: 6 }}>
            <strong>
              {cat}
              <span className="muted" style={{ fontWeight: 500, marginLeft: 8 }}>
                {list.filter((i) => i.packed).length}/{list.length}
              </span>
            </strong>
            <ul className="list">
              {list.map((i) => (
                <li key={i.id} className={`list-item ${i.packed ? 'done' : ''}`}>
                  <label className="row" style={{ flex: 1, gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={i.packed}
                      onChange={() => setItems(items.map((x) => (x.id === i.id ? { ...x, packed: !x.packed } : x)))}
                    />
                    <span>{i.name}</span>
                  </label>
                  <button className="btn sm ghost" onClick={() => setItems(items.filter((x) => x.id !== i.id))}>
                    刪
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!items.length && <p className="muted">選擇旅程類型或新增自訂項目開始打包</p>}
      </div>
    </ProjectShell>
  )
}
