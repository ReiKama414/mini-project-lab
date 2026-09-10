import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('random-name')!

const COUNT_MIN = 1
const COUNT_MAX = 100
const HISTORY_CAP = 24
const FAV_CAP = 40
const COUNT_PRESETS = [1, 5, 10, 20, 50]

type Gender = 'any' | 'f' | 'm'
type Lang = 'en' | 'zh' | 'both'
type Category = 'person' | 'company' | 'product' | 'username'
type OutFmt = 'nl' | 'comma' | 'json' | 'csv'

type HistoryItem = {
  id: string
  at: number
  category: Category
  lang: Lang
  gender: Gender
  names: string[]
}

const EN_FIRST_F = [
  'Alice', 'Emma', 'Olivia', 'Sophia', 'Ava', 'Mia', 'Isabella', 'Charlotte',
  'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Grace', 'Chloe',
  'Lily', 'Zoe', 'Nora', 'Hannah', 'Layla', 'Scarlett', 'Victoria', 'Penelope',
]
const EN_FIRST_M = [
  'James', 'Liam', 'Noah', 'Oliver', 'William', 'Henry', 'Lucas', 'Benjamin',
  'Theodore', 'Jack', 'Leo', 'Owen', 'Daniel', 'Samuel', 'David', 'Joseph',
  'Matthew', 'Sebastian', 'Wyatt', 'Julian', 'Isaac', 'Caleb', 'Nathan', 'Adrian',
]
const EN_FIRST_N = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Jamie', 'Cameron', 'Drew', 'Reese', 'Skyler', 'Parker', 'Blake', 'River',
  'Rowan', 'Sage', 'Finley', 'Hayden', 'Emerson', 'Phoenix', 'Kai', 'Remy',
]
const EN_LAST = [
  'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Martinez', 'Davis', 'Wilson',
  'Anderson', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis',
  'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
  'Hill', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell',
  'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers',
]

const ZH_FIRST_F = [
  '雅婷', '怡君', '淑芬', '美玲', '佳蓉', '詩涵', '心怡', '佩珊', '婉婷', '郁萱',
  '思穎', '宜臻', '欣妤', '品萱', '雨萱', '芷若', '柔安', '語彤', '靜宜', '惠如',
  '巧薇', '嘉玲', '宜芳', '姿穎', '芸瑄', '筱婷', '佳燕', '怡安',
]
const ZH_FIRST_M = [
  '志明', '俊傑', '家豪', '建宏', '冠宇', '承翰', '柏諺', '宗憲', '宇軒', '子軒',
  '睿哲', '彥廷', '昊然', '奕辰', '庭瑋', '柏安', '哲緯', '鈞豪', '偉傑', '信宏',
  '嘉宏', '明德', '俊宏', '立偉', '文傑', '彥佑', '柏宇', '宥辰',
]
const ZH_FIRST_N = [
  '安安', '小雨', '晨曦', '沐陽', '青青', '若水', '星辰', '無雙', '清禾', '予安',
  '微光', '澄心', '知秋', '拾壹', '南風', '初晴',
]
const ZH_LAST = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾',
  '廖', '賴', '徐', '周', '葉', '蘇', '莊', '江', '呂', '何', '羅', '高', '潘', '簡',
]

const COMPANY_PREFIX_ZH = [
  '青禾', '沐光', '山海', '雲端', '綠洲', '星河', '琢玉', '向日', '晴空', '拾光',
  '北辰', '南島', '溪石', '嶼見', '禾風', '澄宇', '映月', '溯源', '原點', '方寸',
]
const COMPANY_SUFFIX_ZH = [
  '科技', '工作室', '設計', '顧問', '數位', '實驗室', '創意', '行銷', '軟體', '媒體',
  '網絡', '智庫', '工坊', '創新', '應用', '服務', '系統', '內容',
]
const COMPANY_EN_A = [
  'North', 'Cedar', 'Bright', 'Harbor', 'Pixel', 'Summit', 'Quiet', 'Maple', 'Orbit', 'Tide',
  'Silver', 'Amber', 'Copper', 'Nova', 'Echo', 'Field', 'River', 'Cloud', 'Forge', 'Prism',
]
const COMPANY_EN_B = [
  'Labs', 'Studio', 'Systems', 'Works', 'Craft', 'Soft', 'Digital', 'Collective', 'Group', 'Co',
  'Foundry', 'Partners', 'Ventures', 'Agency', 'Office', 'Base',
]

const PRODUCT_ADJ = [
  '輕巧', '即時', '清晰', '安心', '流動', '精準', '溫暖', '俐落', '彈性', '沉靜',
  '迅捷', '明亮', '簡約', '靈活', '穩固', '直覺', '高效', '柔和',
]
const PRODUCT_NOUN = [
  '筆記', '儀表板', '助手', '清單', '日曆', '工具箱', '書籤', '白板', '翻譯', '摘要',
  '看板', '收件匣', '地圖', '時鐘', '書庫', '畫布', '提醒', '報表',
]
const PRODUCT_EN_A = [
  'Nova', 'Pulse', 'Ink', 'Clear', 'Soft', 'Day', 'Nest', 'Quick', 'Lumen', 'Harbor',
  'Pixel', 'Snap', 'Flow', 'Bright', 'Calm', 'Swift', 'Tiny', 'Open',
]
const PRODUCT_EN_B = [
  'Desk', 'Board', 'Flow', 'List', 'Shelf', 'Frame', 'Note', 'Mark', 'Task', 'Pad',
  'Kit', 'Box', 'Hub', 'Base', 'Deck', 'Space', 'Lab', 'Dock',
]

const USER_ADJ = [
  'silent', 'brisk', 'calm', 'bright', 'swift', 'quiet', 'ember', 'lunar', 'coral', 'mint',
  'amber', 'cedar', 'frost', 'noble', 'rapid', 'sunny', 'vivid', 'zesty', 'cosmic', 'gentle',
]
const USER_NOUN = [
  'fox', 'otter', 'kite', 'pine', 'wave', 'stone', 'byte', 'leaf', 'crane', 'spark',
  'wolf', 'hawk', 'moss', 'reef', 'quill', 'orbit', 'comet', 'maple', 'ridge', 'drift',
]

const CATEGORY_LABEL: Record<Category, string> = {
  person: '人名',
  company: '公司／工作室',
  product: '產品名',
  username: '使用者名稱',
}

const CATEGORY_HINT: Record<Category, string> = {
  person: '台灣常見姓／名與英文名組合，僅供假資料',
  company: '中文前後綴或英文工作室名',
  product: '形容詞＋名詞，或英文產品代號',
  username: '暱稱＋數字，適合示範帳號',
}

const LANG_LABEL: Record<Lang, string> = {
  both: '中英混合',
  zh: '中文',
  en: '英文',
}

function secureIndex(max: number) {
  if (max <= 0) return 0
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function securePick<T>(arr: T[]): T {
  return arr[secureIndex(arr.length)]!
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1)
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function pairCombos(a: string[], b: string[], join: (x: string, y: string) => string) {
  const out: string[] = []
  for (const x of a) for (const y of b) out.push(join(x, y))
  return out
}

function poolFirst(lang: Lang, gender: Gender) {
  const en =
    gender === 'f' ? EN_FIRST_F : gender === 'm' ? EN_FIRST_M : [...EN_FIRST_F, ...EN_FIRST_M, ...EN_FIRST_N]
  const zh =
    gender === 'f' ? ZH_FIRST_F : gender === 'm' ? ZH_FIRST_M : [...ZH_FIRST_F, ...ZH_FIRST_M, ...ZH_FIRST_N]
  if (lang === 'en') return { first: en, last: EN_LAST, style: 'en' as const }
  if (lang === 'zh') return { first: zh, last: ZH_LAST, style: 'zh' as const }
  return { first: [...en, ...zh], last: [...EN_LAST, ...ZH_LAST], style: 'mixed' as const }
}

function makePerson(lang: Lang, gender: Gender) {
  const use = lang === 'both' ? (secureIndex(2) === 0 ? 'zh' : 'en') : lang
  const { first, last, style } = poolFirst(use, gender)
  const f = securePick(first)
  const l = securePick(last)
  return style === 'zh' ? `${l}${f}` : `${f} ${l}`
}

function makeCompany(lang: Lang) {
  const use = lang === 'both' ? (secureIndex(2) === 0 ? 'zh' : 'en') : lang
  if (use === 'zh') return `${securePick(COMPANY_PREFIX_ZH)}${securePick(COMPANY_SUFFIX_ZH)}`
  return `${securePick(COMPANY_EN_A)} ${securePick(COMPANY_EN_B)}`
}

function makeProduct(lang: Lang) {
  const use = lang === 'both' ? (secureIndex(2) === 0 ? 'zh' : 'en') : lang
  if (use === 'zh') return `${securePick(PRODUCT_ADJ)}${securePick(PRODUCT_NOUN)}`
  return `${securePick(PRODUCT_EN_A)}${securePick(PRODUCT_EN_B)}`
}

function makeUsername(lang: Lang) {
  const n = 10 + secureIndex(90)
  const use = lang === 'both' ? (secureIndex(2) === 0 ? 'zh' : 'en') : lang
  if (use === 'zh') return `${securePick([...ZH_FIRST_F, ...ZH_FIRST_M, ...ZH_FIRST_N])}${n}`
  return `${securePick(USER_ADJ)}_${securePick(USER_NOUN)}${n}`
}

function makeName(category: Category, lang: Lang, gender: Gender) {
  switch (category) {
    case 'company':
      return makeCompany(lang)
    case 'product':
      return makeProduct(lang)
    case 'username':
      return makeUsername(lang)
    default:
      return makePerson(lang, gender)
  }
}

function buildCandidates(category: Category, lang: Lang, gender: Gender): string[] | null {
  if (category === 'company') {
    const zh = pairCombos(COMPANY_PREFIX_ZH, COMPANY_SUFFIX_ZH, (a, b) => `${a}${b}`)
    const en = pairCombos(COMPANY_EN_A, COMPANY_EN_B, (a, b) => `${a} ${b}`)
    if (lang === 'zh') return zh
    if (lang === 'en') return en
    return [...zh, ...en]
  }
  if (category === 'product') {
    const zh = pairCombos(PRODUCT_ADJ, PRODUCT_NOUN, (a, b) => `${a}${b}`)
    const en = pairCombos(PRODUCT_EN_A, PRODUCT_EN_B, (a, b) => `${a}${b}`)
    if (lang === 'zh') return zh
    if (lang === 'en') return en
    return [...zh, ...en]
  }
  if (category === 'person') {
    if (lang === 'both') {
      const zh = poolFirst('zh', gender)
      const en = poolFirst('en', gender)
      return [
        ...pairCombos(zh.first, zh.last, (f, l) => `${l}${f}`),
        ...pairCombos(en.first, en.last, (f, l) => `${f} ${l}`),
      ]
    }
    const { first, last, style } = poolFirst(lang, gender)
    return pairCombos(first, last, (f, l) => (style === 'zh' ? `${l}${f}` : `${f} ${l}`))
  }
  return null
}

function estimatePool(category: Category, lang: Lang, gender: Gender) {
  if (category === 'company') {
    const zh = COMPANY_PREFIX_ZH.length * COMPANY_SUFFIX_ZH.length
    const en = COMPANY_EN_A.length * COMPANY_EN_B.length
    if (lang === 'en') return en
    if (lang === 'zh') return zh
    return zh + en
  }
  if (category === 'product') {
    const zh = PRODUCT_ADJ.length * PRODUCT_NOUN.length
    const en = PRODUCT_EN_A.length * PRODUCT_EN_B.length
    if (lang === 'en') return en
    if (lang === 'zh') return zh
    return zh + en
  }
  if (category === 'username') {
    const zh = ZH_FIRST_F.length + ZH_FIRST_M.length + ZH_FIRST_N.length
    const en = USER_ADJ.length * USER_NOUN.length
    if (lang === 'zh') return zh * 90
    if (lang === 'en') return en * 90
    return (zh + en) * 90
  }
  if (lang === 'both') {
    const zh = poolFirst('zh', gender)
    const en = poolFirst('en', gender)
    return zh.first.length * zh.last.length + en.first.length * en.last.length
  }
  const { first, last } = poolFirst(lang, gender)
  return first.length * last.length
}

function generateUniqueBatch(category: Category, lang: Lang, gender: Gender, n: number) {
  const pool = estimatePool(category, lang, gender)
  const want = Math.min(n, pool)
  const candidates = buildCandidates(category, lang, gender)
  if (candidates) {
    shuffleInPlace(candidates)
    return { names: candidates.slice(0, want), capped: want < n, pool }
  }
  const seen = new Set<string>()
  const out: string[] = []
  const maxAttempts = Math.max(want * 200, 2000)
  for (let i = 0; i < maxAttempts && out.length < want; i++) {
    const name = makeName(category, lang, gender)
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return { names: out, capped: out.length < n, pool }
}

function nameStats(list: string[]) {
  if (!list.length) {
    return { unique: 0, avgLen: 0, minLen: 0, maxLen: 0, dupRate: 0 }
  }
  const lengths = list.map((n) => [...n].length)
  const unique = new Set(list).size
  const avgLen = Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10
  return {
    unique,
    avgLen,
    minLen: Math.min(...lengths),
    maxLen: Math.max(...lengths),
    dupRate: Math.round(((list.length - unique) / list.length) * 1000) / 10,
  }
}

function joinNames(list: string[], fmt: OutFmt) {
  if (fmt === 'comma') return list.join(', ')
  if (fmt === 'json') return JSON.stringify(list, null, 2)
  if (fmt === 'csv') return ['name', ...list.map((n) => `"${n.replace(/"/g, '""')}"`)].join('\n')
  return list.join('\n')
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:random-name:count', 10)
  const [lang, setLang] = useLocalStorage<Lang>('lab:random-name:lang', 'both')
  const [gender, setGender] = useLocalStorage<Gender>('lab:random-name:gender', 'any')
  const [category, setCategory] = useLocalStorage<Category>('lab:random-name:category', 'person')
  const [favorites, setFavorites] = useLocalStorage<string[]>('lab:random-name:favorites', [])
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('lab:random-name:history', [])
  const [unique, setUnique] = useLocalStorage('lab:random-name:unique', true)
  const [fmt, setFmt] = useLocalStorage<OutFmt>('lab:random-name:fmt', 'nl')
  const [names, setNames] = useState<string[]>([])
  const [copied, setCopied] = useState<'all' | 'fav' | null>(null)
  const [countError, setCountError] = useState('')
  const [note, setNote] = useState('')

  const favSet = useMemo(() => new Set(favorites), [favorites])
  const safeCount = clamp(Number.isFinite(count) ? count : COUNT_MIN, COUNT_MIN, COUNT_MAX)
  const countOk = !countError && safeCount >= COUNT_MIN && safeCount <= COUNT_MAX
  const poolSize = useMemo(() => estimatePool(category, lang, gender), [category, lang, gender])
  const stats = useMemo(() => nameStats(names), [names])
  const joined = useMemo(() => joinNames(names, fmt), [names, fmt])

  function generate(save = true) {
    if (!countOk) return
    const n = safeCount
    let out: string[]
    if (unique) {
      const batch = generateUniqueBatch(category, lang, gender, n)
      out = batch.names
      setNote(
        batch.capped
          ? `組合上限約 ${batch.pool.toLocaleString()}，已產出 ${out.length} 個不重複名稱`
          : '',
      )
    } else {
      out = Array.from({ length: n }, () => makeName(category, lang, gender))
      const uniq = new Set(out).size
      setNote(uniq < out.length ? `未勾選不重複：本批有 ${out.length - uniq} 筆重複` : '')
    }
    setNames(out)
    setCopied(null)
    if (!save || !out.length) return
    setHistory((h) =>
      [
        {
          id: uid('rn'),
          at: Date.now(),
          category,
          lang,
          gender,
          names: out,
        },
        ...h,
      ].slice(0, HISTORY_CAP),
    )
  }

  function regenerateOne(index: number) {
    setNames((xs) => {
      const next = [...xs]
      if (unique) {
        const seen = new Set(xs.filter((_, i) => i !== index))
        let candidate = makeName(category, lang, gender)
        for (let i = 0; i < 120 && seen.has(candidate); i++) {
          candidate = makeName(category, lang, gender)
        }
        next[index] = candidate
      } else {
        next[index] = makeName(category, lang, gender)
      }
      return next
    })
  }

  function toggleFav(name: string) {
    setFavorites((xs) => (xs.includes(name) ? xs.filter((x) => x !== name) : [name, ...xs].slice(0, FAV_CAP)))
  }

  async function copyAll() {
    if (!joined) return
    await copyText(joined)
    setCopied('all')
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row rn-shell-actions">
          <ActionButton className="btn sm accent" disabled={!countOk} onClick={() => generate(true)}>
            產生
          </ActionButton>
          <ActionButton className="btn sm ghost" disabled={!names.length} onClick={() => void copyAll()}>
            {copied === 'all' ? '已複製' : '複製'}
          </ActionButton>
        </div>
      }
    >
      <div className="rn-calc">
        <div className="pw-stats">
          <span className="metric">{CATEGORY_LABEL[category]}</span>
          <span className="tag">{LANG_LABEL[lang]}</span>
          <span className="tag">結果 {names.length}</span>
          <span className="tag">收藏 {favorites.length}</span>
          <span className="tag">約 {poolSize.toLocaleString()} 組合</span>
        </div>

        <div className="rn-main">
          <section className="panel rn-settings">
            <h3 className="pw-panel-title">產生設定</h3>

            <div className="pw-block">
              <div className="label">類別</div>
              <div className="pw-chips">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`btn sm ${category === c ? 'accent' : 'ghost'}`}
                    onClick={() => setCategory(c)}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
              <p className="field-hint">{CATEGORY_HINT[category]}</p>
            </div>

            <div className="pw-block">
              <div className="label">語言</div>
              <div className="pw-chips">
                {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`btn sm ${lang === l ? 'accent' : 'ghost'}`}
                    onClick={() => setLang(l)}
                  >
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>

            {category === 'person' && (
              <div className="pw-block">
                <div className="label">人名風格</div>
                <div className="pw-chips">
                  {(
                    [
                      ['any', '不限'],
                      ['f', '偏女性'],
                      ['m', '偏男性'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`btn sm ${gender === k ? 'accent' : 'ghost'}`}
                      onClick={() => setGender(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="stack">
              <span className="label">
                數量：{safeCount}（{COUNT_MIN}–{COUNT_MAX}）
              </span>
              <input
                className="field"
                type="range"
                min={COUNT_MIN}
                max={COUNT_MAX}
                value={safeCount}
                onChange={(e) => {
                  setCountError('')
                  setCount(clamp(parseNumber(e.target.value, COUNT_MIN), COUNT_MIN, COUNT_MAX))
                }}
              />
              <input
                className={`field${countError ? ' is-invalid' : ''}`}
                type="number"
                min={COUNT_MIN}
                max={COUNT_MAX}
                value={safeCount}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (!Number.isFinite(n)) {
                    setCountError('請輸入有效數字')
                    return
                  }
                  setCountError('')
                  setCount(clamp(n, COUNT_MIN, COUNT_MAX))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && countOk) generate(true)
                }}
              />
              {countError && <p className="field-error">{countError}</p>}
            </label>

            <div className="pw-chips">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn sm ${safeCount === n ? 'accent' : 'ghost'}`}
                  onClick={() => {
                    setCountError('')
                    setCount(n)
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="pw-block">
              <div className="label">輸出格式</div>
              <div className="pw-chips">
                {(
                  [
                    ['nl', '換行'],
                    ['comma', '逗號'],
                    ['json', 'JSON'],
                    ['csv', 'CSV'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`btn sm ${fmt === k ? 'accent' : 'ghost'}`}
                    onClick={() => setFmt(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="pw-check">
              <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
              <span>本批不重複（建議開啟）</span>
            </label>
            {note && <p className="field-hint">{note}</p>}

            <div className="pw-actions">
              <ActionButton className="btn accent" disabled={!countOk} onClick={() => generate(true)}>
                產生
              </ActionButton>
              <ActionButton className="btn teal" disabled={!names.length || !countOk} onClick={() => generate(false)}>
                全部重產
              </ActionButton>
              <ActionButton className="btn ghost" disabled={!names.length} onClick={() => void copyAll()} icon="copy">
                {copied === 'all' ? '已複製' : '複製'}
              </ActionButton>
              <ActionButton
                className="btn ghost"
                disabled={!names.length}
                onClick={() =>
                  downloadText(
                    fmt === 'csv' ? 'names.csv' : fmt === 'json' ? 'names.json' : 'names.txt',
                    joined,
                    fmt === 'csv' ? 'text/csv;charset=utf-8' : undefined,
                  )
                }
              >
                下載
              </ActionButton>
            </div>
          </section>

          <aside className="rn-side">
            <section className="panel rn-result">
              <div className="pw-panel-head">
                <h3 className="pw-panel-title">產生結果</h3>
                <span className="tag">{names.length} 筆</span>
              </div>
              {!names.length && (
                <p className="muted" style={{ margin: 0 }}>
                  調整左側設定後按「產生」
                </p>
              )}
              <ul className="rn-result-list">
                {names.map((n, i) => (
                  <li key={`${n}-${i}`} className="rn-result-item">
                    <span className="rn-name">{n}</span>
                    <ActionButton className="btn sm ghost" onClick={() => regenerateOne(i)}>
                      換一個
                    </ActionButton>
                    <ActionButton
                      className={`btn sm ${favSet.has(n) ? 'teal' : 'ghost'}`}
                      onClick={() => toggleFav(n)}
                    >
                      {favSet.has(n) ? '已收藏' : '收藏'}
                    </ActionButton>
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => void copyText(n)}
                      icon="copy"
                      iconOnly
                      tooltip="複製"
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel rn-info">
              <h3 className="pw-panel-title">更多資訊</h3>
              <ul className="pw-info-list">
                <li>
                  <span className="muted">估計組合數</span>
                  <strong>{poolSize.toLocaleString()}</strong>
                </li>
                <li>
                  <span className="muted">本批不重複</span>
                  <strong>
                    {stats.unique}/{names.length || 0}
                  </strong>
                </li>
                <li>
                  <span className="muted">重複率</span>
                  <strong>{names.length ? `${stats.dupRate}%` : '—'}</strong>
                </li>
                <li>
                  <span className="muted">平均長度</span>
                  <strong>{names.length ? stats.avgLen : '—'}</strong>
                </li>
                <li>
                  <span className="muted">最短／最長</span>
                  <strong>{names.length ? `${stats.minLen} / ${stats.maxLen}` : '—'}</strong>
                </li>
                <li>
                  <span className="muted">收藏上限</span>
                  <strong>
                    {favorites.length}/{FAV_CAP}
                  </strong>
                </li>
              </ul>
              <p className="muted pw-hint">
                名稱來自本機詞庫隨機組合，僅供測試／佔位，不是真實身分資料。
              </p>
            </section>
          </aside>
        </div>

        <div className="rn-bottom">
          <section className="panel rn-fav">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">收藏</h3>
              <div className="pw-chips">
                <ActionButton
                  className="btn sm ghost"
                  disabled={!favorites.length}
                  onClick={async () => {
                    await copyText(favorites.join('\n'))
                    setCopied('fav')
                    window.setTimeout(() => setCopied(null), 1500)
                  }}
                >
                  {copied === 'fav' ? '已複製' : '複製'}
                </ActionButton>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!favorites.length}
                  onClick={() => {
                    if (confirm('確定清空全部收藏？')) setFavorites([])
                  }}
                >
                  清空
                </ActionButton>
              </div>
            </div>
            {!favorites.length && (
              <p className="muted" style={{ margin: 0 }}>
                點「收藏」把喜歡的名字留在本機
              </p>
            )}
            <ul className="rn-fav-list">
              {favorites.map((n) => (
                <li key={n} className="rn-fav-item">
                  <span>{n}</span>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => void copyText(n)}
                    icon="copy"
                    iconOnly
                    tooltip="複製"
                  />
                  <DeleteButton onClick={() => toggleFav(n)} label="移除收藏" />
                </li>
              ))}
            </ul>
          </section>

          <section className="panel rn-history">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">產生歷史</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!history.length}
                onClick={() => {
                  if (confirm('確定清空全部歷史？')) setHistory([])
                }}
              >
                清空
              </ActionButton>
            </div>
            {!history.length && (
              <p className="muted" style={{ margin: 0 }}>
                產生後會自動保存本批結果
              </p>
            )}
            <ul className="rn-history-list">
              {history.map((h) => (
                <li key={h.id} className="rn-history-card">
                  <div className="pw-history-meta">
                    <span className="tag">{CATEGORY_LABEL[h.category]}</span>
                    <span className="tag">{LANG_LABEL[h.lang]}</span>
                    <span className="tag">{h.names.length} 筆</span>
                  </div>
                  <p className="rn-history-preview">{h.names.slice(0, 3).join('、')}{h.names.length > 3 ? '…' : ''}</p>
                  <div className="muted pw-history-time">{new Date(h.at).toLocaleString('zh-TW')}</div>
                  <div className="pw-history-actions">
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => {
                        setCategory(h.category)
                        setLang(h.lang)
                        setGender(h.gender)
                        setNames(h.names)
                      }}
                      icon="check"
                    >
                      還原
                    </ActionButton>
                    <ActionButton
                      className="btn sm ghost"
                      onClick={() => void copyText(h.names.join('\n'))}
                      icon="copy"
                      iconOnly
                      tooltip="複製"
                    />
                    <DeleteButton
                      onClick={() => setHistory((xs) => xs.filter((x) => x.id !== h.id))}
                      label="刪除"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </ProjectShell>
  )
}
