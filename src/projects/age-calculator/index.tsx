import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'
import { solarToLunar } from '../../lib/lunar'
import { IconCalendar, IconCopy } from '../../components/icons'

const meta = getProject('age-calculator')!

const DATE_MIN = '1900-01-01'
const DATE_MAX = '2100-12-31'

function isValidIsoDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

const ZODIAC = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬']

const MILESTONES = [
  { days: 100, label: '滿 100 天' },
  { days: 365, label: '滿 1 年（約）' },
  { days: 1000, label: '滿 1,000 天' },
  { days: 3650, label: '滿 10 年（約）' },
  { days: 5000, label: '滿 5,000 天' },
  { days: 10000, label: '滿 10,000 天' },
  { days: 20000, label: '滿 20,000 天' },
  { days: 30000, label: '滿 30,000 天' },
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

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function preciseAge(birth: Date, asOf: Date) {
  let years = asOf.getFullYear() - birth.getFullYear()
  let months = asOf.getMonth() - birth.getMonth()
  let days = asOf.getDate() - birth.getDate()
  if (days < 0) {
    months -= 1
    const prev = new Date(asOf.getFullYear(), asOf.getMonth(), 0)
    days += prev.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

export default function Page() {
  const [birth, setBirth] = useLocalStorage('lab:age:birth', '2000-01-01')
  const [asOf, setAsOf] = useLocalStorage('lab:age:asOf', new Date().toISOString().slice(0, 10))
  const [showZodiac, setShowZodiac] = useLocalStorage('lab:age:showZodiac', true)
  const [copied, setCopied] = useState(false)

  const birthOk = isValidIsoDate(birth) && birth >= DATE_MIN && birth <= DATE_MAX
  const asOfOk = isValidIsoDate(asOf) && asOf >= DATE_MIN && asOf <= DATE_MAX
  const orderOk = birthOk && asOfOk && asOf >= birth
  const dateError = !birthOk
    ? '請輸入有效生日'
    : !asOfOk
      ? '請輸入有效基準日'
      : !orderOk
        ? '基準日不可早於生日'
        : ''

  const info = useMemo(() => {
    const b = new Date(birth + 'T00:00:00')
    const now = new Date(asOf + 'T00:00:00')
    if (Number.isNaN(b.getTime()) || Number.isNaN(now.getTime()) || now < b) return null

    const { years, months, days } = preciseAge(b, now)

    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate())
    if (next < now) next.setFullYear(now.getFullYear() + 1)
    const isBirthdayToday = next.getTime() === now.getTime()
    const untilDays = Math.round((next.getTime() - now.getTime()) / 86400000)
    const untilWeeks = Math.floor(untilDays / 7)
    const untilRemainDays = untilDays % 7

    const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400000)
    const totalWeeks = Math.floor(totalDays / 7)
    const totalMonthsApprox = years * 12 + months
    const weekday = b.toLocaleDateString('zh-TW', { weekday: 'long' })
    const cnZodiac = ZODIAC[(b.getFullYear() - 4) % 12]!
    const west = westernZodiac(b.getMonth() + 1, b.getDate())
    const lunarBirth = solarToLunar(b)
    const lunarAsOf = solarToLunar(now)
    const milestones = MILESTONES.map((m) => {
      const date = addDays(b, m.days)
      const passed = totalDays >= m.days
      const remain = m.days - totalDays
      return { ...m, date, passed, remain }
    })

    const yearProgress = isBirthdayToday ? 100 : Math.min(100, ((365 - untilDays) / 365) * 100)
    const turningAge = years + (isBirthdayToday ? 0 : 1)

    return {
      years,
      months,
      days,
      untilDays,
      untilWeeks,
      untilRemainDays,
      isBirthdayToday,
      totalDays,
      totalWeeks,
      totalMonthsApprox,
      next,
      weekday,
      cnZodiac,
      west,
      lunarBirth,
      lunarAsOf,
      milestones,
      yearProgress,
      turningAge,
    }
  }, [birth, asOf])

  const shareText = info
    ? [
        `年齡計算結果`,
        `生日（國曆）：${birth}`,
        info.lunarBirth ? `生日（農曆）：${info.lunarBirth.text}（${info.lunarBirth.animal}年）` : '',
        `基準日：${asOf}`,
        info.lunarAsOf ? `基準日（農曆）：${info.lunarAsOf.text}` : '',
        `精確年齡：${info.years} 年 ${info.months} 個月 ${info.days} 天`,
        `已度過：${info.totalDays.toLocaleString()} 天（約 ${info.totalWeeks.toLocaleString()} 週／約 ${info.totalMonthsApprox} 個月）`,
        `出生星期：${info.weekday}`,
        ...(showZodiac ? [`生肖／星座：${info.cnZodiac} · ${info.west}`] : []),
        info.isBirthdayToday
          ? `今天就是生日！滿 ${info.years} 歲`
          : `下次生日：${info.next.toLocaleDateString('zh-TW')}（還有 ${info.untilDays} 天 → 滿 ${info.turningAge} 歲）`,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  async function handleCopy() {
    if (!shareText) return
    await copyText(shareText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn ghost sm" disabled={!info} onClick={() => void handleCopy()}>
          <IconCopy size={15} />
          {copied ? '已複製' : '複製結果'}
        </button>
      }
    >
      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span className="label">生日（國曆）</span>
            <input
              className={`field${!birthOk || (!orderOk && birthOk && asOfOk) ? ' is-invalid' : ''}`}
              type="date"
              min={DATE_MIN}
              max={DATE_MAX}
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
            />
            <p className="field-hint">{DATE_MIN}–{DATE_MAX}</p>
          </label>
          <label className="stack">
            <span className="label">計算基準日</span>
            <input
              className={`field${!asOfOk || (!orderOk && birthOk && asOfOk) ? ' is-invalid' : ''}`}
              type="date"
              min={DATE_MIN}
              max={DATE_MAX}
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
            <p className="field-hint">{DATE_MIN}–{DATE_MAX}</p>
          </label>
        </div>
        {dateError && <p className="field-error">{dateError}</p>}
        <label className="check">
          <input type="checkbox" checked={showZodiac} onChange={() => setShowZodiac(!showZodiac)} />
          顯示生肖／星座（可選）
        </label>

        {info ? (
          <>
            <div className="metric-block" style={{ textAlign: 'center' }}>
              <div className="metric-label">精確年齡</div>
              <div className="metric-value">
                {info.years} <span className="metric-unit">年</span> {info.months}{' '}
                <span className="metric-unit">個月</span> {info.days} <span className="metric-unit">天</span>
              </div>
            </div>

            <div className="grid-2">
              <div className="metric-block">
                <div className="metric-label">已度過</div>
                <div className="metric-value">{info.totalDays.toLocaleString()} 天</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  約 {info.totalWeeks.toLocaleString()} 週 · 約 {info.totalMonthsApprox} 個月
                </div>
              </div>
              <div className="metric-block">
                <div className="metric-label">出生星期</div>
                <div className="metric-value" style={{ fontSize: '1.35rem' }}>
                  {info.weekday}
                </div>
              </div>
              {showZodiac && (
                <div className="metric-block">
                  <div className="metric-label">生肖 / 星座</div>
                  <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                    {info.cnZodiac} · {info.west}
                  </div>
                </div>
              )}
              <div className="metric-block">
                <div className="metric-label">下次生日</div>
                <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                  {info.next.toLocaleDateString('zh-TW')}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  將滿 {info.turningAge} 歲
                </div>
              </div>
            </div>

            <div className="panel stack" style={{ background: 'var(--bg-muted)', boxShadow: 'none' }}>
              <div className="row">
                <IconCalendar size={16} strokeWidth={2.25} />
                <div className="label" style={{ margin: 0 }}>
                  農曆對照（約 1900–2100）
                </div>
              </div>
              {info.lunarBirth ? (
                <div className="grid-2">
                  <div>
                    <div className="metric-label">出生農曆</div>
                    <div style={{ fontWeight: 700, lineHeight: 1.5 }}>{info.lunarBirth.text}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {info.lunarBirth.yearGanZhi} · {info.lunarBirth.animal}年
                      {info.lunarBirth.isLeap ? ' · 閏月' : ''}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">基準日農曆</div>
                    {info.lunarAsOf ? (
                      <>
                        <div style={{ fontWeight: 700, lineHeight: 1.5 }}>{info.lunarAsOf.text}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          {info.lunarAsOf.yearGanZhi} · {info.lunarAsOf.animal}年
                        </div>
                      </>
                    ) : (
                      <div className="muted">超出對照範圍</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  此日期超出農曆對照範圍（請使用 1900–2100）。
                </p>
              )}
            </div>

            <div className="panel stack" style={{ background: 'var(--bg-muted)', boxShadow: 'none' }}>
              <div className="label" style={{ margin: 0 }}>
                下次生日倒數
              </div>
              {info.isBirthdayToday ? (
                <div className="metric-value">今天就是生日！</div>
              ) : (
                <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
                  <div className="metric-block" style={{ minWidth: 96, background: '#fff' }}>
                    <div className="metric-value">{info.untilDays}</div>
                    <div className="muted">天</div>
                  </div>
                  <div className="metric-block" style={{ minWidth: 96, background: '#fff' }}>
                    <div className="metric-value">{info.untilWeeks}</div>
                    <div className="muted">週 + {info.untilRemainDays} 天</div>
                  </div>
                </div>
              )}
              <div className="progress">
                <span style={{ width: `${info.yearProgress}%` }} />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                本年度生日進度 {info.yearProgress.toFixed(0)}%
              </p>
            </div>

            <div className="row">
              <button type="button" className="btn accent" onClick={() => void handleCopy()} disabled={!info || !!dateError}>
                <IconCopy size={15} />
                {copied ? '已複製到剪貼簿' : '複製完整結果'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setAsOf(new Date().toISOString().slice(0, 10))}>
                <IconCalendar size={15} />
                基準日設為今天
              </button>
            </div>

            <h3 style={{ margin: '8px 0 0' }}>人生里程碑</h3>
            <ul className="list">
              {info.milestones.map((m) => (
                <li key={m.days} className="list-item">
                  <span className="tag" style={{ background: m.passed ? 'var(--teal-soft)' : 'var(--bg-muted)' }}>
                    {m.passed ? '已達成' : '尚未'}
                  </span>
                  <strong style={{ flex: 1 }}>{m.label}</strong>
                  <span className="mono muted">{m.date.toLocaleDateString('zh-TW')}</span>
                  {!m.passed && <span className="muted">還有 {m.remain.toLocaleString()} 天</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">請確認日期有效，且基準日不早於生日。</p>
        )}
      </div>
    </ProjectShell>
  )
}
