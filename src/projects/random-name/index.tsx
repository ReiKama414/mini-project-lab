import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, pick } from '../../lib/utils'

const meta = getProject('random-name')!

type Gender = 'any' | 'f' | 'm'
type Lang = 'en' | 'zh' | 'both'

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
  'Jamie', 'Cameron', 'Drew', 'Harper', 'Reese', 'Skyler', 'Parker', 'Blake',
]
const EN_LAST = [
  'Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Martinez', 'Davis', 'Wilson',
  'Anderson', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis',
  'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
]

const ZH_FIRST_F = ['雅婷', '怡君', '淑芬', '美玲', '佳蓉', '詩涵', '心怡', '佩珊', '婉婷', '郁萱', '思穎', '宜臻']
const ZH_FIRST_M = ['志明', '俊傑', '家豪', '建宏', '冠宇', '承翰', '柏諺', '宗憲', '宇軒', '子軒', '睿哲', '彥廷']
const ZH_FIRST_N = ['安安', '小雨', '晨曦', '沐陽', '青青', '若水', '星辰', '無雙']
const ZH_LAST = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '曾']

function poolFirst(lang: Lang, gender: Gender) {
  const en =
    gender === 'f' ? EN_FIRST_F : gender === 'm' ? EN_FIRST_M : [...EN_FIRST_F, ...EN_FIRST_M, ...EN_FIRST_N]
  const zh =
    gender === 'f' ? ZH_FIRST_F : gender === 'm' ? ZH_FIRST_M : [...ZH_FIRST_F, ...ZH_FIRST_M, ...ZH_FIRST_N]
  if (lang === 'en') return { first: en, last: EN_LAST, style: 'en' as const }
  if (lang === 'zh') return { first: zh, last: ZH_LAST, style: 'zh' as const }
  return { first: [...en, ...zh], last: [...EN_LAST, ...ZH_LAST], style: 'mixed' as const }
}

function makeName(lang: Lang, gender: Gender) {
  if (lang === 'both') {
    const useZh = Math.random() < 0.5
    return makeName(useZh ? 'zh' : 'en', gender)
  }
  const { first, last, style } = poolFirst(lang, gender)
  const f = pick(first)
  const l = pick(last)
  return style === 'zh' ? `${l}${f}` : `${f} ${l}`
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:random-name:count', 10)
  const [lang, setLang] = useLocalStorage<Lang>('lab:random-name:lang', 'both')
  const [gender, setGender] = useLocalStorage<Gender>('lab:random-name:gender', 'any')
  const [names, setNames] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  function generate() {
    const n = Math.min(100, Math.max(1, count))
    setNames(Array.from({ length: n }, () => makeName(lang, gender)))
    setCopied(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
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
            />
          </label>
          <label className="stack">
            <span className="label">語言</span>
            <select className="field" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="both">中英混合</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
            </select>
          </label>
          <label className="stack">
            <span className="label">風格篩選</span>
            <select className="field" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              <option value="any">不限</option>
              <option value="f">偏女性名</option>
              <option value="m">偏男性名</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn accent" onClick={generate}>
            產生姓名
          </button>
          <button
            className="btn ghost"
            disabled={!names.length}
            onClick={async () => {
              await copyText(names.join('\n'))
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '全部複製'}
          </button>
        </div>
        <ul className="list">
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className="list-item">
              <span>{n}</span>
              <button className="btn sm ghost" onClick={() => void copyText(n)}>
                複製
              </button>
            </li>
          ))}
          {!names.length && <p className="muted">從姓／名池隨機組合，適合測試假資料</p>}
        </ul>
      </div>
    </ProjectShell>
  )
}
