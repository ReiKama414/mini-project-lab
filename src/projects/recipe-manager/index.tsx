import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('recipe-manager')!

type Recipe = {
  id: string
  title: string
  category: string
  ingredients: string[] | string
  steps: string
  time: number
  baseServings: number
}

const CATEGORIES = ['家常', '湯品', '主食', '甜點', '飲品', '素食', '其他']

function parseIngredients(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export default function Page() {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('lab:recipe-manager', [])
  const [active, setActive] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0]!)
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [time, setTime] = useState(30)
  const [baseServings, setBaseServings] = useState(2)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [servings, setServings] = useState(2)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (catFilter !== 'all' && (r.category || '其他') !== catFilter) return false
      const ings = Array.isArray(r.ingredients) ? r.ingredients : parseIngredients(String(r.ingredients ?? ''))
      const q = search.trim().toLowerCase()
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !ings.some((i) => i.toLowerCase().includes(q)) &&
        !r.steps.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [recipes, catFilter, search])

  const current = recipes.find((r) => r.id === active)
  const currentIngredients = current
    ? Array.isArray(current.ingredients)
      ? current.ingredients
      : parseIngredients(String(current.ingredients ?? ''))
    : []

  function scaleLine(line: string, factor: number) {
    return line.replace(/(\d+(?:\.\d+)?)/, (m) => {
      const n = Number(m) * factor
      return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
    })
  }

  function add() {
    if (!title.trim()) return
    const r: Recipe = {
      id: uid('rcp'),
      title: title.trim(),
      category,
      ingredients: parseIngredients(ingredients),
      steps,
      time,
      baseServings: Math.max(1, baseServings),
    }
    setRecipes([r, ...recipes])
    setActive(r.id)
    setServings(r.baseServings)
    setChecked({})
    setTitle('')
    setIngredients('')
    setSteps('')
  }

  function openRecipe(id: string) {
    const r = recipes.find((x) => x.id === id)
    if (!r) return
    // 舊資料 ingredients 可能是字串
    const ingredients = Array.isArray(r.ingredients)
      ? r.ingredients
      : parseIngredients(String(r.ingredients ?? ''))
    if (!Array.isArray(r.ingredients)) {
      setRecipes(recipes.map((x) => (x.id === id ? { ...x, ingredients, baseServings: x.baseServings || 2 } : x)))
    }
    setActive(id)
    setServings(r.baseServings || 2)
    setChecked({})
  }

  const factor = current ? servings / Math.max(1, current.baseServings || 2) : 1
  const scaled = currentIngredients.map((line) => scaleLine(line, factor))

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" placeholder="食譜名稱" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid-2">
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              className="field"
              type="number"
              min={1}
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              placeholder="分鐘"
            />
            <input
              className="field"
              type="number"
              min={1}
              value={baseServings}
              onChange={(e) => setBaseServings(Number(e.target.value))}
              placeholder="基準份量"
            />
          </div>
          <textarea
            className="field"
            rows={4}
            style={{ fontFamily: 'inherit' }}
            placeholder="食材（一行一項，可含數字如「雞蛋 2 顆」）"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
          <textarea
            className="field"
            rows={4}
            style={{ fontFamily: 'inherit' }}
            placeholder="步驟"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
          <button className="btn accent" onClick={add}>
            收藏食譜
          </button>

          <input
            className="field"
            placeholder="搜尋食譜或食材…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="row">
            <button className={`btn sm ${catFilter === 'all' ? 'accent' : 'ghost'}`} onClick={() => setCatFilter('all')}>
              全部
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} className={`btn sm ${catFilter === c ? 'accent' : 'ghost'}`} onClick={() => setCatFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <ul className="list">
            {filtered.map((r) => (
              <li
                key={r.id}
                className="list-item"
                style={{ cursor: 'pointer', outline: active === r.id ? '2px solid var(--accent)' : undefined }}
                onClick={() => openRecipe(r.id)}
              >
                <div className="stack" style={{ flex: 1, gap: 2 }}>
                  <strong>{r.title}</strong>
                  <span className="muted">
                    {r.category || '其他'} · {r.baseServings || 2} 人份
                  </span>
                </div>
                <span className="tag">{r.time} 分</span>
              </li>
            ))}
            {!filtered.length && <p className="muted">尚無符合的食譜</p>}
          </ul>
        </div>

        <div className="panel stack">
          {current ? (
            <>
              <div className="row">
                <h2 style={{ margin: 0, flex: 1 }}>{current.title}</h2>
                <span className="tag">{current.category}</span>
              </div>
              <p className="muted">
                約 {current.time} 分鐘 · 基準 {current.baseServings} 人份
              </p>
              <div className="row">
                <span className="label" style={{ margin: 0 }}>
                  份量縮放
                </span>
                <button className="btn sm ghost" onClick={() => setServings(Math.max(1, servings - 1))}>
                  −
                </button>
                <strong>{servings} 人份</strong>
                <button className="btn sm ghost" onClick={() => setServings(servings + 1)}>
                  ＋
                </button>
                <button className="btn sm ghost" onClick={() => setServings(current.baseServings)}>
                  重置
                </button>
              </div>
              <div>
                <div className="label">食材清單（可勾選）</div>
                <ul className="list">
                  {scaled.map((line, i) => (
                    <li key={i} className={`list-item ${checked[i] ? 'done' : ''}`}>
                      <label className="row" style={{ flex: 1, gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!checked[i]}
                          onChange={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                        />
                        <span>{line}</span>
                      </label>
                    </li>
                  ))}
                  {!scaled.length && <p className="muted">尚無食材</p>}
                </ul>
              </div>
              <div>
                <div className="label">步驟</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{current.steps || '—'}</pre>
              </div>
              <button
                className="btn ghost"
                onClick={() => {
                  setRecipes(recipes.filter((x) => x.id !== current.id))
                  setActive(null)
                }}
              >
                刪除食譜
              </button>
            </>
          ) : (
            <p className="muted">選擇一則食譜查看，並調整份量與勾選食材</p>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
