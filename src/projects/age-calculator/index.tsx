import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('age-calculator')!

const ZODIAC = [
  '鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬',
]

function westernZodiac(month: number, day: number) {
  const md = month * 100 + day
  if (md >= 321 && md <= 419) return '牡羊座'
  if (md >= 420 && md <= 520) return '金牛座'
  if (md >= 521 && md <= 620) return '雙子座'
  if (md >= 621 && md <= 722) return '巨蟹座'
  if (md >= 723 && md <= 822) return '獅子座'
  if (md >= 823 && md <= 922) return '處女座'
  if (md >= 923 && md <= 1022) return '天秤座'
  if (md >= 1023 && md <= 1121) return '天蠍座'
  if (md >= 1122 && md <= 1221) return '射手座'
  if (md >= 1222 || md <= 119) return '摩羯座'
  if (md <= 218) return '水瓶座'
  return '雙魚座'
}

export default function Page() {
  const [birth, setBirth] = useLocalStorage('lab:age:birth', '2000-01-01')
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10))

  const info = useMemo(() => {
    const b = new Date(birth + 'T00:00:00')
    const now = new Date(asOf + 'T00:00:00')
    if (Number.isNaN(b.getTime()) || Number.isNaN(now.getTime()) || now < b) return null
    let years = now.getFullYear() - b.getFullYear()
    let months = now.getMonth() - b.getMonth()
    let days = now.getDate() - b.getDate()
    if (days < 0) {
      months -= 1
      const prev = new Date(now.getFullYear(), now.getMonth(), 0)
      days += prev.getDate()
    }
    if (months < 0) {
      years -= 1
      months += 12
    }
    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate())
    if (next <= now) next.setFullYear(now.getFullYear() + 1)
    const until = Math.ceil((next.getTime() - now.getTime()) / 86400000)
    const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400000)
    const totalWeeks = Math.floor(totalDays / 7)
    const weekday = b.toLocaleDateString('zh-TW', { weekday: 'long' })
    const cnZodiac = ZODIAC[(b.getFullYear() - 4) % 12]!
    const west = westernZodiac(b.getMonth() + 1, b.getDate())
    return { years, months, days, until, totalDays, totalWeeks, next, weekday, cnZodiac, west }
  }, [birth, asOf])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span className="label">生日</span>
            <input
              className="field"
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="label">計算基準日</span>
            <input
              className="field"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
        </div>
        {info ? (
          <>
            <div className="grid-2">
              <div className="metric">
                <div className="muted">年齡</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {info.years} 歲 {info.months} 月 {info.days} 天
                </div>
              </div>
              <div className="metric">
                <div className="muted">已度過</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {info.totalDays.toLocaleString()} 天
                </div>
                <div className="muted">約 {info.totalWeeks.toLocaleString()} 週</div>
              </div>
              <div className="metric">
                <div className="muted">出生星期</div>
                <div>{info.weekday}</div>
              </div>
              <div className="metric">
                <div className="muted">生肖 / 星座</div>
                <div>
                  {info.cnZodiac} · {info.west}
                </div>
              </div>
              <div className="metric">
                <div className="muted">下一個生日</div>
                <div>{info.next.toLocaleDateString('zh-TW')}</div>
              </div>
              <div className="metric">
                <div className="muted">距離下次生日</div>
                <div>{info.until} 天</div>
              </div>
            </div>
            <div className="progress">
              <span style={{ width: `${Math.min(100, ((365 - info.until) / 365) * 100)}%` }} />
            </div>
            <p className="muted">本年度生日進度（距下次生日倒數）</p>
          </>
        ) : (
          <p className="muted">請確認日期有效，且基準日不早於生日。</p>
        )}
      </div>
    </ProjectShell>
  )
}
