import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, pick, randomInt } from '../../lib/utils'

const meta = getProject('random-name')!

type Gender = 'any' | 'f' | 'm'
type Lang = 'en' | 'zh' | 'both'
type Category = 'person' | 'company' | 'product' | 'username'

const EN_FIRST_F = [
  'Alice', 'Emma', 'Olivia', 'Sophia', 'Ava', 'Mia', 'Isabella', 'Charlotte',
  'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Grace', 'Chloe',
]
const EN_FIRST_M = [
  'James', 'Liam', 'Noah', 'Oliver', 'William', 'Henry', 'Lucas', 'Benjamin',
  'Theodore', 'Jack', 'Leo', 'Owen', 'Daniel', 'Samuel', 'David', 'Joseph',
]
const EN_FIRST_N = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
  'Jamie', 'Cameron', 'Drew', 'Reese', 'Skyler', 'Parker', 'Blake', 'River',
]
const EN_LAST = [
  'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Martinez', 'Davis', 'Wilson',
  'Anderson', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis',
  'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
]

const ZH_FIRST_F = [
  '雅婷', '怡君', '淑芬', '美玲', '佳蓉', '詩涵', '心怡', '佩珊', '婉婷', '郁萱',
  '思穎', '宜臻', '欣妤', '品萱', '雨萱', '芷若', '柔安', '語彤',
]
const ZH_FIRST_M = [
  '志明', '俊傑', '家豪', '建宏', '冠宇', '承翰', '柏諺', '宗憲', '宇軒', '子軒',
  '睿哲', '彥廷', '昊然', '奕辰', '庭瑋', '柏安', '哲緯', '鈞豪',
]
const ZH_FIRST_N = ['安安', '小雨', '晨曦', '沐陽', '青青', '若水', '星辰', '無雙', '清禾', '予安']
const ZH_LAST = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾',
  '廖', '賴', '徐', '周',
]

const COMPANY_PREFIX_ZH = ['青禾', '沐光', '山海', '雲端', '綠洲', '星河', '琢玉', '向日', '晴空', '拾光']
const COMPANY_SUFFIX_ZH = ['科技', '工作室', '設計', '顧問', '數位', '實驗室', '創意', '行銷', '軟體', '媒體']
const COMPANY_EN = [
  'Northwind Labs', 'Cedar & Co', 'Brightpath', 'Harbor Soft', 'Pixel Grove',
  'Summit Craft', 'Quiet Forge', 'Maple Systems', 'Orbit Studio', 'Tideworks',
]

const PRODUCT_ADJ = ['輕巧', '即時', '清晰', '安心', '流動', '精準', '溫暖', '俐落', '彈性', '沉靜']
const PRODUCT_NOUN = ['筆記', '儀表板', '助手', '清單', '日曆', '工具箱', '書籤', '白板', '翻譯', '摘要']
const PRODUCT_EN = [
  'NovaDesk', 'PulseBoard', 'Inkflow', 'ClearList', 'SoftShelf',
  'Dayframe', 'NestNote', 'Quickmark', 'Lumen Task', 'Harbor Pad',
]

const USER_ADJ = ['silent', 'brisk', 'calm', 'bright', 'swift', 'quiet', 'ember', 'lunar', 'coral', 'mint']
const USER_NOUN = ['fox', 'otter', 'kite', 'pine', 'wave', 'stone', 'byte', 'leaf', 'crane', 'spark']

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
  if (lang === 'both') {
    return makePerson(Math.random() < 0.5 ? 'zh' : 'en', gender)
  }
  const { first, last, style } = poolFirst(lang, gender)
  const f = pick(first)
  const l = pick(last)
  return style === 'zh' ? `${l}${f}` : `${f} ${l}`
}

function makeCompany(lang: Lang) {
  if (lang === 'en') return pick(COMPANY_EN)
  if (lang === 'zh') return `${pick(COMPANY_PREFIX_ZH)}${pick(COMPANY_SUFFIX_ZH)}`
  return Math.random() < 0.5
    ? `${pick(COMPANY_PREFIX_ZH)}${pick(COMPANY_SUFFIX_ZH)}`
    : pick(COMPANY_EN)
}

function makeProduct(lang: Lang) {
  if (lang === 'en') return pick(PRODUCT_EN)
  if (lang === 'zh') return `${pick(PRODUCT_ADJ)}${pick(PRODUCT_NOUN)}`
  return Math.random() < 0.5 ? `${pick(PRODUCT_ADJ)}${pick(PRODUCT_NOUN)}` : pick(PRODUCT_EN)
}

function makeUsername(lang: Lang) {
  const n = randomInt(10, 99)
  if (lang === 'zh') {
    const base = pick([...ZH_FIRST_F, ...ZH_FIRST_M, ...ZH_FIRST_N])
    return `${base}${n}`
  }
  if (lang === 'en') return `${pick(USER_ADJ)}_${pick(USER_NOUN)}${n}`
  return Math.random() < 0.5
    ? `${pick([...ZH_FIRST_F, ...ZH_FIRST_M])}${n}`
    : `${pick(USER_ADJ)}_${pick(USER_NOUN)}${n}`
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

const CATEGORY_LABEL: Record<Category, string> = {
  person: '人名',
  company: '公司／工作室',
  product: '產品名',
  username: '使用者名稱',
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:random-name:count', 10)
  const [lang, setLang] = useLocalStorage<Lang>('lab:random-name:lang', 'both')
  const [gender, setGender] = useLocalStorage<Gender>('lab:random-name:gender', 'any')
  const [category, setCategory] = useLocalStorage<Category>('lab:random-name:category', 'person')
  const [favorites, setFavorites] = useLocalStorage<string[]>('lab:random-name:favorites', [])
  const [names, setNames] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const favSet = useMemo(() => new Set(favorites), [favorites])

  function generate() {
    const n = Math.min(100, Math.max(1, Number.isFinite(count) ? count : 1))
    setNames(Array.from({ length: n }, () => makeName(category, lang, gender)))
    setCopied(false)
  }

  function regenerateOne(index: number) {
    setNames((xs) => xs.map((n, i) => (i === index ? makeName(category, lang, gender) : n)))
  }

  function toggleFav(name: string) {
    setFavorites((xs) => (xs.includes(name) ? xs.filter((x) => x !== name) : [name, ...xs].slice(0, 40)))
  }

  async function copyAll() {
    if (!names.length) return
    await copyText(names.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
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
          <div className="grid-3">
            <label className="stack">
              <span className="label">數量（1–100）</span>
              <input
                className="field"
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generate()
                }}
              />
            </label>
            <label className="stack">
              <span className="label">語言</span>
              <select className="field" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                <option value="both">中英混合</option>
                <option value="zh">中文（台灣常用）</option>
                <option value="en">英文</option>
              </select>
            </label>
            <label className="stack">
              <span className="label">人名風格</span>
              <select
                className="field"
                value={gender}
                disabled={category !== 'person'}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                <option value="any">不限</option>
                <option value="f">偏女性名</option>
                <option value="m">偏男性名</option>
              </select>
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={generate}>
              產生
            </button>
            <button type="button" className="btn teal" disabled={!names.length} onClick={generate}>
              全部重新產生
            </button>
            <button type="button" className="btn ghost" disabled={!names.length} onClick={() => void copyAll()}>
              {copied ? '已複製' : '全部複製'}
            </button>
          </div>
          <ul className="list">
            {names.map((n, i) => (
              <li key={`${n}-${i}`} className="list-item">
                <span style={{ flex: 1 }}>{n}</span>
                <button type="button" className="btn sm ghost" onClick={() => regenerateOne(i)} title="只換這一筆">
                  換一個
                </button>
                <button
                  type="button"
                  className={`btn sm ${favSet.has(n) ? 'teal' : 'ghost'}`}
                  onClick={() => toggleFav(n)}
                >
                  {favSet.has(n) ? '已收藏' : '收藏'}
                </button>
                <button type="button" className="btn sm ghost" onClick={() => void copyText(n)}>
                  複製
                </button>
              </li>
            ))}
            {!names.length && (
              <p className="muted">
                選擇類別後產生假資料。人名池偏台灣常見姓／名；也可產生公司、產品與使用者名稱。
              </p>
            )}
          </ul>
        </div>
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>收藏（{favorites.length}）</h3>
            <button
              type="button"
              className="btn sm ghost"
              disabled={!favorites.length}
              onClick={() => setFavorites([])}
            >
              清空
            </button>
          </div>
          <ul className="list">
            {favorites.map((n) => (
              <li key={n} className="list-item">
                <span style={{ flex: 1 }}>{n}</span>
                <button type="button" className="btn sm ghost" onClick={() => void copyText(n)}>
                  複製
                </button>
                <button type="button" className="btn sm ghost" onClick={() => toggleFav(n)}>
                  移除
                </button>
              </li>
            ))}
            {!favorites.length && <p className="muted">點「收藏」把喜歡的名字留在本機。</p>}
          </ul>
          {favorites.length > 0 && (
            <button type="button" className="btn ghost" onClick={() => void copyText(favorites.join('\n'))}>
              複製全部收藏
            </button>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
