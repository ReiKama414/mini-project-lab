import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, clamp, downloadText, isNonEmpty, limitText, parseNumber, uid } from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'

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

const RECIPE_SAMPLES = [
  {
    label: '蛋炒飯',
    title: '蛋炒飯',
    category: '主食',
    ingredients: '白飯 2 碗\n雞蛋 2 顆\n蔥 1 根\n醬油 1 大匙',
    steps: '1. 蛋打散快炒\n2. 加入白飯拌炒\n3. 加醬油與蔥花',
    time: 15,
    baseServings: 2,
  },
  {
    label: '味噌湯',
    title: '味噌湯',
    category: '湯品',
    ingredients: '味噌 2 大匙\n豆腐 1 盒\n海帶 適量\n水 600ml',
    steps: '1. 煮開水\n2. 下豆腐與海帶\n3. 關火溶味噌',
    time: 10,
    baseServings: 2,
  },
]
const MAX_ITEMS = 200
const MAX_TITLE = 80
const MAX_INGREDIENTS = 2000
const MAX_STEPS = 5000
const MAX_SEARCH = 80
const MAX_TIME = 24 * 60
const MAX_SERVINGS = 100

function parseIngredients(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100)
}

function normalizeIngredients(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === 'string')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 100)
  }
  if (typeof raw === 'string') return parseIngredients(raw)
  return []
}

function parseRecipe(row: unknown): Recipe | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const title = typeof r.title === 'string' ? limitText(r.title.trim(), MAX_TITLE) : ''
  if (!title) return null
  const category = typeof r.category === 'string' && CATEGORIES.includes(r.category) ? r.category : '其他'
  const time = typeof r.time === 'number' && Number.isFinite(r.time) ? clamp(Math.round(r.time), 1, MAX_TIME) : 30
  const baseServings =
    typeof r.baseServings === 'number' && Number.isFinite(r.baseServings)
      ? clamp(Math.round(r.baseServings), 1, MAX_SERVINGS)
      : 2
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid('rcp'),
    title,
    category,
    ingredients: normalizeIngredients(r.ingredients),
    steps: typeof r.steps === 'string' ? limitText(r.steps, MAX_STEPS) : '',
    time,
    baseServings,
  }
}

function parseRecipesJson(raw: unknown): Recipe[] | null {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { recipes?: unknown }).recipes)
      ? (raw as { recipes: unknown[] }).recipes
      : null
  if (!list) return null
  const out: Recipe[] = []
  for (const row of list) {
    const r = parseRecipe(row)
    if (r) out.push(r)
  }
  return out.slice(0, MAX_ITEMS)
}

function mergeRecipes(existing: Recipe[], incoming: Recipe[]): Recipe[] {
  const byId = new Map(existing.map((r) => [r.id, r]))
  for (const r of incoming) {
    if (byId.has(r.id)) byId.set(r.id, { ...byId.get(r.id)!, ...r })
    else byId.set(r.id, r)
  }
  return [...byId.values()].slice(0, MAX_ITEMS)
}

export default function Page() {
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('lab:recipe-manager', [])
  const [active, setActive] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0]!)
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [timeStr, setTimeStr] = useState('30')
  const [baseServingsStr, setBaseServingsStr] = useState('2')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [servings, setServings] = useState(2)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const time = parseNumber(timeStr)
  const baseServings = parseNumber(baseServingsStr)
  const titleOk = isNonEmpty(title)
  const timeOk = Number.isFinite(time) && time >= 1
  const servingsOk = Number.isFinite(baseServings) && baseServings >= 1
  const atLimit = recipes.length >= MAX_ITEMS
  const canAdd = titleOk && timeOk && servingsOk && !atLimit
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

  const avgTime = useMemo(() => {
    if (!recipes.length) return 0
    return Math.round(recipes.reduce((s, r) => s + r.time, 0) / recipes.length)
  }, [recipes])

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
    if (!canAdd || !Number.isFinite(time) || !Number.isFinite(baseServings)) return
    const r: Recipe = {
      id: uid('rcp'),
      title: title.trim(),
      category,
      ingredients: parseIngredients(ingredients),
      steps: limitText(steps, MAX_STEPS),
      time: clamp(Math.round(time), 1, MAX_TIME),
      baseServings: clamp(Math.round(baseServings), 1, MAX_SERVINGS),
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
    const ings = Array.isArray(r.ingredients)
      ? r.ingredients
      : parseIngredients(String(r.ingredients ?? ''))
    if (!Array.isArray(r.ingredients)) {
      setRecipes(recipes.map((x) => (x.id === id ? { ...x, ingredients: ings, baseServings: x.baseServings || 2 } : x)))
    }
    setActive(id)
    setServings(r.baseServings || 2)
    setChecked({})
  }

  const factor = current ? servings / Math.max(1, current.baseServings || 2) : 1
  const scaled = currentIngredients.map((line) => scaleLine(line, factor))

  function exportJson() {
    downloadText(
      'recipes.json',
      JSON.stringify({ version: 1, recipes }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  async function importJson(file: File | null) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const list = parseRecipesJson(parsed)
      if (!list?.length) {
        setImportMsg('JSON 無效或無有效食譜，資料未變更')
        return
      }
      setRecipes(mergeRecipes(recipes, list))
      setImportMsg(`已合併匯入 ${list.length} 則食譜`)
    } catch {
      setImportMsg('讀取或解析失敗，資料未變更')
    }
  }

  function downloadScaledIngredients() {
    if (!current || !scaled.length) return
    const body = [
      `${current.title} · ${servings} 人份`,
      `基準 ${current.baseServings || 2} 人份 · 約 ${current.time} 分鐘`,
      '',
      '【食材】',
      ...scaled.map((l, i) => `${i + 1}. ${l}`),
      '',
      '【步驟】',
      current.steps || '—',
    ].join('\n')
    const safe = current.title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40) || 'recipe'
    downloadText(`${safe}-scaled.txt`, body)
  }

  function applyRecipeSample(s: (typeof RECIPE_SAMPLES)[0]) {
    setTitle(s.title)
    setCategory(s.category)
    setIngredients(s.ingredients)
    setSteps(s.steps)
    setTimeStr(String(s.time))
    setBaseServingsStr(String(s.baseServings))
  }

  return (
    <FeatureLayout
      variant="unified"
      meta={meta}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" disabled={!recipes.length} onClick={exportJson} icon="download">
            匯出 JSON
          </ActionButton>
          <ActionButton className="btn sm ghost" onClick={() => importRef.current?.click()}>
            匯入 JSON
          </ActionButton>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importJson(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </div>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h2 className="pw-panel-title">食譜範例</h2>
          </div>
          <div className="ft-samples">
            <span className="muted">範例：</span>
            {RECIPE_SAMPLES.map((s) => (
              <button key={s.label} type="button" className="btn sm ghost" onClick={() => applyRecipeSample(s)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ft-stats-row">
            <span className="tag">顯示 {filtered.length} 則</span>
            <span className="tag">共 {recipes.length} / {MAX_ITEMS}</span>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '食譜上限', value: `${MAX_ITEMS} 則` },
        { label: '份量縮放', value: '右側可調整倍率並勾選採買食材' },
      ]}
      faq={[ftPrivacyLocal, { title: '食材格式', body: '每行一項；匯入 JSON 可合併既有食譜。' }]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🍳"
          title={recipes.length}
          subtitle="收藏食譜"
          meta={
            <>
              平均約 {avgTime || '—'} 分鐘 · 分類篩選：{catFilter === 'all' ? '全部' : catFilter}
              {current ? (
                <>
                  <br />
                  檢視中：{current.title}
                </>
              ) : null}
            </>
          }
        />
        <FtMetricGrid>
          <FtMetric label="食譜數" value={`${recipes.length} / ${MAX_ITEMS}`} />
          <FtMetric label="符合篩選" value={filtered.length} />
          <FtMetric label="平均時間" value={avgTime ? `${avgTime} 分` : '—'} />
          <FtMetric label="目前份量" value={current ? `${servings} 人份` : '—'} />
        </FtMetricGrid>

      <div className="grid-2">
        <div className="stack">
          <FtSection title="新增食譜">
          {importMsg && <p className="muted" style={{ fontSize: 13 }}>{importMsg}</p>}
          <div className="stack" style={{ gap: 0 }}>
            <input
              className={`field${title.length > 0 && !titleOk ? ' is-invalid' : ''}`}
              placeholder="食譜名稱"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))}
            />
            <div className="field-meta">
              <span className={!titleOk && title.length > 0 ? 'warn' : undefined}>
                {!titleOk && title.length > 0 ? '請輸入食譜名稱' : '\u00a0'}
              </span>
              <span>
                {charCount(title)} / {MAX_TITLE}
              </span>
            </div>
          </div>
          <div className="grid-2">
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="stack" style={{ gap: 0 }}>
              <input
                className={`field${!timeOk ? ' is-invalid' : ''}`}
                type="number"
                min={1}
                max={MAX_TIME}
                value={timeStr}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) setTimeStr(e.target.value)
                  else setTimeStr(String(clamp(Math.round(n), 1, MAX_TIME)))
                }}
                placeholder="分鐘"
              />
              {!timeOk && <p className="field-error">時間須為 1–{MAX_TIME} 分鐘</p>}
            </div>
            <div className="stack" style={{ gap: 0 }}>
              <input
                className={`field${!servingsOk ? ' is-invalid' : ''}`}
                type="number"
                min={1}
                max={MAX_SERVINGS}
                value={baseServingsStr}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) setBaseServingsStr(e.target.value)
                  else setBaseServingsStr(String(clamp(Math.round(n), 1, MAX_SERVINGS)))
                }}
                placeholder="基準份量"
              />
              {!servingsOk && <p className="field-error">份量須為 1–{MAX_SERVINGS}</p>}
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <textarea
              className="field"
              rows={4}
              style={{ fontFamily: 'inherit' }}
              placeholder="食材（一行一項，可含數字如「雞蛋 2 顆」）"
              value={ingredients}
              maxLength={MAX_INGREDIENTS}
              onChange={(e) => setIngredients(limitText(e.target.value, MAX_INGREDIENTS))}
            />
            <div className="field-meta">
              <span className="field-hint">最多 100 行</span>
              <span>
                {charCount(ingredients)} / {MAX_INGREDIENTS}
              </span>
            </div>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            <textarea
              className="field"
              rows={4}
              style={{ fontFamily: 'inherit' }}
              placeholder="步驟"
              value={steps}
              maxLength={MAX_STEPS}
              onChange={(e) => setSteps(limitText(e.target.value, MAX_STEPS))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(steps)} / {MAX_STEPS}
              </span>
            </div>
          </div>
          <ActionButton className="btn accent" onClick={add} disabled={!canAdd}>收藏食譜</ActionButton>
          {atLimit && <p className="field-error">已達上限 {MAX_ITEMS} 則食譜</p>}
          </FtSection>

          <FtSection title="瀏覽食譜">
          <div className="stack" style={{ gap: 0 }}>
            <input
              className="field"
              placeholder="搜尋食譜或食材…"
              value={search}
              maxLength={MAX_SEARCH}
              onChange={(e) => setSearch(limitText(e.target.value, MAX_SEARCH))}
            />
            <div className="field-meta">
              <span />
              <span>
                {charCount(search)} / {MAX_SEARCH}
              </span>
            </div>
          </div>
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
          </FtSection>
        </div>

        <div className="stack">
          <FtSection title="食譜詳情">
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
                <button className="btn sm ghost" onClick={() => setServings(Math.min(MAX_SERVINGS, servings + 1))}>
                  ＋
                </button>
                <ActionButton className="btn sm ghost" onClick={() => setServings(current.baseServings)}>
                  重置
                </ActionButton>
                <ActionButton
                  className="btn sm teal"
                  disabled={!scaled.length}
                  onClick={downloadScaledIngredients}
                >下載縮放食材</ActionButton>
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
              <DeleteButton
                onClick={() => {
                  setRecipes(recipes.filter((x) => x.id !== current.id))
                  setActive(null)
                }}
                label="刪除食譜"
              />
            </>
          ) : (
            <p className="muted">選擇一則食譜查看，並調整份量與勾選食材</p>
          )}
          </FtSection>
        </div>
      </div>
      </FtToolRoot>
    </FeatureLayout>
  )
}
