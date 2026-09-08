import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'
import { solarToLunar } from '../../lib/lunar'

const meta = getProject('age-calculator')!

const DATE_MIN = '1900-01-01'
const DATE_MAX = '2100-12-31'

type AgeParts = { years: number; months: number; days: number }

type DayMilestone = { kind: 'days'; days: number; label: string }
type AgeMilestone = { kind: 'age'; years: number; label: string }
type MilestoneDef = DayMilestone | AgeMilestone

const ZODIAC = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'] as const

const DAY_MILESTONES: DayMilestone[] = [
  { kind: 'days', days: 100, label: '滿 100 天' },
  { kind: 'days', days: 200, label: '滿 200 天' },
  { kind: 'days', days: 500, label: '滿 500 天' },
  { kind: 'days', days: 1000, label: '滿 1,000 天' },
  { kind: 'days', days: 2000, label: '滿 2,000 天' },
  { kind: 'days', days: 3000, label: '滿 3,000 天' },
  { kind: 'days', days: 5000, label: '滿 5,000 天' },
  { kind: 'days', days: 8000, label: '滿 8,000 天' },
  { kind: 'days', days: 10000, label: '滿 10,000 天' },
  { kind: 'days', days: 15000, label: '滿 15,000 天' },
  { kind: 'days', days: 20000, label: '滿 20,000 天' },
  { kind: 'days', days: 25000, label: '滿 25,000 天' },
  { kind: 'days', days: 30000, label: '滿 30,000 天' },
  { kind: 'days', days: 36500, label: '滿 36,500 天（約百年）' },
]

const AGE_MILESTONES: AgeMilestone[] = [
  { kind: 'age', years: 1, label: '滿 1 歲' },
  { kind: 'age', years: 3, label: '滿 3 歲' },
  { kind: 'age', years: 6, label: '滿 6 歲（入學）' },
  { kind: 'age', years: 12, label: '滿 12 歲' },
  { kind: 'age', years: 16, label: '滿 16 歲' },
  { kind: 'age', years: 18, label: '滿 18 歲（成年）' },
  { kind: 'age', years: 20, label: '滿 20 歲' },
  { kind: 'age', years: 25, label: '滿 25 歲' },
  { kind: 'age', years: 30, label: '滿 30 歲' },
  { kind: 'age', years: 40, label: '滿 40 歲' },
  { kind: 'age', years: 50, label: '滿 50 歲' },
  { kind: 'age', years: 60, label: '滿 60 歲' },
  { kind: 'age', years: 65, label: '滿 65 歲' },
  { kind: 'age', years: 70, label: '滿 70 歲' },
  { kind: 'age', years: 80, label: '滿 80 歲' },
  { kind: 'age', years: 90, label: '滿 90 歲' },
  { kind: 'age', years: 100, label: '滿 100 歲' },
  { kind: 'age', years: 110, label: '滿 110 歲' },
  { kind: 'age', years: 120, label: '滿 120 歲' },
]

const MILESTONES: MilestoneDef[] = [...DAY_MILESTONES, ...AGE_MILESTONES]

function isValidIsoDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(iso + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

function westernZodiac(month: number, day: number) {
  const md = month * 100 + day
  if (md >= 321 && md <= 419) return { name: '牡羊座', range: '3/21–4/19' }
  if (md >= 420 && md <= 520) return { name: '金牛座', range: '4/20–5/20' }
  if (md >= 521 && md <= 620) return { name: '雙子座', range: '5/21–6/20' }
  if (md >= 621 && md <= 722) return { name: '巨蟹座', range: '6/21–7/22' }
  if (md >= 723 && md <= 822) return { name: '獅子座', range: '7/23–8/22' }
  if (md >= 823 && md <= 922) return { name: '處女座', range: '8/23–9/22' }
  if (md >= 923 && md <= 1022) return { name: '天秤座', range: '9/23–10/22' }
  if (md >= 1023 && md <= 1121) return { name: '天蠍座', range: '10/23–11/21' }
  if (md >= 1122 && md <= 1221) return { name: '射手座', range: '11/22–12/21' }
  if (md >= 1222 || md <= 119) return { name: '摩羯座', range: '12/22–1/19' }
  if (md <= 218) return { name: '水瓶座', range: '1/20–2/18' }
  return { name: '雙魚座', range: '2/19–3/20' }
}

function generationOf(year: number) {
  if (year >= 2013) return '世代 Alpha'
  if (year >= 1997) return 'Z 世代'
  if (year >= 1981) return '千禧世代'
  if (year >= 1965) return 'X 世代'
  if (year >= 1946) return '嬰兒潮世代'
  if (year >= 1928) return '沉默世代'
  return '最大世代'
}

function lifeStageOf(years: number) {
  if (years < 1) return '嬰兒'
  if (years < 3) return '幼兒'
  if (years < 6) return '學齡前'
  if (years < 12) return '兒童'
  if (years < 18) return '青少年'
  if (years < 40) return '青年'
  if (years < 65) return '中年'
  return '高齡'
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function addYears(d: Date, n: number) {
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + n)
  return x
}

function preciseAge(birth: Date, asOf: Date): AgeParts {
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

function formatAge(a: AgeParts) {
  return `${a.years} 歲 ${a.months} 個月`
}

function formatAgeFull(a: AgeParts) {
  return `${a.years} 歲 ${a.months} 個月 ${a.days} 天`
}

function formatIso(d: Date) {
  return d.toLocaleDateString('zh-TW')
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export default function Page() {
  const todayIso = () => new Date().toISOString().slice(0, 10)
  const [birth, setBirth] = useLocalStorage('lab:age:birth', '2000-01-01')
  const [asOf, setAsOf] = useLocalStorage('lab:age:asOf', todayIso())
  const [showZodiac, setShowZodiac] = useLocalStorage('lab:age:showZodiac', true)
  const [milestoneFilter, setMilestoneFilter] = useLocalStorage<'all' | 'upcoming' | 'passed'>(
    'lab:age:msFilter',
    'all',
  )
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

    const age = preciseAge(b, now)
    const { years, months, days } = age

    const next = new Date(now.getFullYear(), b.getMonth(), b.getDate())
    if (next < now) next.setFullYear(now.getFullYear() + 1)
    const isBirthdayToday = next.getTime() === now.getTime()
    const untilDays = daysBetween(now, next)
    const untilWeeks = Math.floor(untilDays / 7)
    const untilRemainDays = untilDays % 7
    const untilMonths = (() => {
      let m = (next.getFullYear() - now.getFullYear()) * 12 + (next.getMonth() - now.getMonth())
      if (next.getDate() < now.getDate()) m -= 1
      return Math.max(0, m)
    })()
    const untilHours = untilDays * 24

    const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400000)
    const totalWeeks = Math.floor(totalDays / 7)
    const totalMonthsApprox = years * 12 + months
    const totalHours = totalDays * 24
    const totalMinutes = totalHours * 60
    const weekday = b.toLocaleDateString('zh-TW', { weekday: 'long' })
    const nextWeekday = next.toLocaleDateString('zh-TW', { weekday: 'long' })
    const cnZodiac = ZODIAC[(b.getFullYear() - 4 + 12) % 12]!
    const west = westernZodiac(b.getMonth() + 1, b.getDate())
    const lunarBirth = solarToLunar(b)
    const lunarAsOf = solarToLunar(now)
    const nominalAge = now.getFullYear() - b.getFullYear() + 1
    const generation = generationOf(b.getFullYear())
    const stage = lifeStageOf(years)

    const yearLength = (() => {
      const prev = new Date(next)
      prev.setFullYear(next.getFullYear() - 1)
      return Math.max(1, daysBetween(prev, next))
    })()
    const yearProgress = isBirthdayToday ? 100 : Math.min(100, ((yearLength - untilDays) / yearLength) * 100)

    const milestones = MILESTONES.map((m) => {
      const date = m.kind === 'days' ? addDays(b, m.days) : addYears(b, m.years)
      const targetDays = m.kind === 'days' ? m.days : daysBetween(b, date)
      const passed = totalDays >= targetDays
      const remain = targetDays - totalDays
      const ageAt = preciseAge(b, date)
      return {
        id: m.kind === 'days' ? `d-${m.days}` : `y-${m.years}`,
        label: m.label,
        kind: m.kind,
        date,
        passed,
        remain,
        ageAt,
        ageLabel: formatAge(ageAt),
      }
    }).sort((a, b) => a.date.getTime() - b.date.getTime())

    const nextMilestone = milestones.find((m) => !m.passed) ?? null
    const turningAge = years + (isBirthdayToday ? 0 : 1)

    return {
      years,
      months,
      days,
      age,
      untilDays,
      untilWeeks,
      untilRemainDays,
      untilMonths,
      untilHours,
      isBirthdayToday,
      totalDays,
      totalWeeks,
      totalMonthsApprox,
      totalHours,
      totalMinutes,
      next,
      weekday,
      nextWeekday,
      cnZodiac,
      west,
      lunarBirth,
      lunarAsOf,
      milestones,
      nextMilestone,
      yearProgress,
      turningAge,
      nominalAge,
      generation,
      stage,
    }
  }, [birth, asOf])

  const filteredMilestones = useMemo(() => {
    if (!info) return []
    if (milestoneFilter === 'upcoming') return info.milestones.filter((m) => !m.passed)
    if (milestoneFilter === 'passed') return info.milestones.filter((m) => m.passed)
    return info.milestones
  }, [info, milestoneFilter])

  const upcomingPreview = useMemo(
    () => (info ? info.milestones.filter((m) => !m.passed).slice(0, 3) : []),
    [info],
  )

  const shareText = info
    ? [
        `年齡計算結果`,
        `生日（國曆）：${birth}（${info.weekday}）`,
        info.lunarBirth ? `生日（農曆）：${info.lunarBirth.text}（${info.lunarBirth.animal}年）` : '',
        `基準日：${asOf}`,
        info.lunarAsOf ? `基準日（農曆）：${info.lunarAsOf.text}` : '',
        `精確年齡：${formatAgeFull(info.age)}`,
        `虛歲：${info.nominalAge} 歲`,
        `人生階段：${info.stage} · ${info.generation}`,
        `已度過：${info.totalDays.toLocaleString()} 天（約 ${info.totalWeeks.toLocaleString()} 週／約 ${info.totalMonthsApprox} 個月）`,
        `約 ${info.totalHours.toLocaleString()} 小時`,
        ...(showZodiac ? [`生肖／星座：${info.cnZodiac} · ${info.west.name}`] : []),
        info.isBirthdayToday
          ? `今天就是生日！滿 ${info.years} 歲`
          : `下次生日：${formatIso(info.next)}（${info.nextWeekday}，還有 ${info.untilDays} 天 → 滿 ${info.turningAge} 歲）`,
        info.nextMilestone
          ? `下一個里程碑：${info.nextMilestone.label}（${formatIso(info.nextMilestone.date)}，約 ${info.nextMilestone.ageLabel}）`
          : '',
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
        <ActionButton className="btn ghost sm" disabled={!info} onClick={() => void handleCopy()} icon="copy">
          {copied ? '已複製' : '複製結果'}
        </ActionButton>
      }
    >
      <div className="age-calc">
        <section className="panel age-input">
          <div className="age-fields">
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
            </label>
          </div>
          {dateError && <p className="field-error">{dateError}</p>}
          <div className="age-toolbar">
            <label className="check">
              <input type="checkbox" checked={showZodiac} onChange={() => setShowZodiac(!showZodiac)} />
              顯示生肖／星座
            </label>
            <div className="age-toolbar-actions">
              <ActionButton className="btn ghost sm" onClick={() => setAsOf(todayIso())} icon="reset">
                基準日設為今天
              </ActionButton>
              <ActionButton
                className="btn accent sm"
                disabled={!info}
                onClick={() => void handleCopy()}
                icon="copy"
              >
                {copied ? '已複製' : '複製結果'}
              </ActionButton>
            </div>
          </div>
        </section>

        {!info && (
          <section className="panel">
            <p className="muted" style={{ margin: 0 }}>
              請確認日期有效，且基準日不早於生日
            </p>
          </section>
        )}

        {info && (
          <>
            <div className="age-dual">
              <section className="panel age-overview">
                <div className="age-overview-head">
                  <p className="muted age-hero-label">精確年齡</p>
                  <div className="age-hero-num">
                    <span className="age-hero-part">
                      <strong>{info.years}</strong>
                      <span>歲</span>
                    </span>
                    <span className="age-hero-part">
                      <strong>{info.months}</strong>
                      <span>個月</span>
                    </span>
                    <span className="age-hero-part">
                      <strong>{info.days}</strong>
                      <span>天</span>
                    </span>
                  </div>
                  <div className="age-tags">
                    <span className="tag">虛歲 {info.nominalAge}</span>
                    <span className="tag">{info.stage}</span>
                    <span className="tag">{info.generation}</span>
                    <span className="tag">{info.weekday}</span>
                    {showZodiac && (
                      <>
                        <span className="tag">{info.cnZodiac}</span>
                        <span className="tag">
                          {info.west.name}
                          <span className="muted"> {info.west.range}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="age-chip-grid" aria-label="已度過時間">
                  <div className="age-chip">
                    <strong className="mono">{info.totalDays.toLocaleString()}</strong>
                    <span>天</span>
                  </div>
                  <div className="age-chip">
                    <strong className="mono">{info.totalWeeks.toLocaleString()}</strong>
                    <span>週</span>
                  </div>
                  <div className="age-chip">
                    <strong className="mono">{info.totalMonthsApprox}</strong>
                    <span>個月</span>
                  </div>
                  <div className="age-chip">
                    <strong className="mono">{info.totalHours.toLocaleString()}</strong>
                    <span>小時</span>
                  </div>
                </div>

                <div className="age-lunar-block">
                  <h3 className="age-panel-title">農曆對照</h3>
                  {info.lunarBirth ? (
                    <div className="age-lunar-grid">
                      <div>
                        <div className="muted age-fact-label">出生農曆</div>
                        <div className="age-lunar-text">{info.lunarBirth.text}</div>
                        <div className="muted">
                          {info.lunarBirth.yearGanZhi} · {info.lunarBirth.animal}年
                          {info.lunarBirth.isLeap ? ' · 閏月' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="muted age-fact-label">基準日農曆</div>
                        {info.lunarAsOf ? (
                          <>
                            <div className="age-lunar-text">{info.lunarAsOf.text}</div>
                            <div className="muted">
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
                      此日期超出農曆對照範圍（請使用 1900–2100）
                    </p>
                  )}
                </div>
              </section>

              <section className="panel age-countdown">
                <div className="age-panel-head">
                  <h3 className="age-panel-title">下次生日倒數</h3>
                  <span className="muted">
                    {info.isBirthdayToday
                      ? `今天滿 ${info.years} 歲`
                      : `${formatIso(info.next)} · ${info.nextWeekday} · 將滿 ${info.turningAge} 歲`}
                  </span>
                </div>
                {info.isBirthdayToday ? (
                  <div className="age-bday-today">今天就是生日！</div>
                ) : (
                  <div className="age-count-grid">
                    <div className="age-count-card">
                      <strong className="mono">{info.untilDays}</strong>
                      <span>天</span>
                    </div>
                    <div className="age-count-card">
                      <strong className="mono">{info.untilWeeks}</strong>
                      <span>週 + {info.untilRemainDays} 天</span>
                    </div>
                    <div className="age-count-card">
                      <strong className="mono">{info.untilMonths}</strong>
                      <span>個月（約）</span>
                    </div>
                    <div className="age-count-card">
                      <strong className="mono">{info.untilHours.toLocaleString()}</strong>
                      <span>小時（約）</span>
                    </div>
                  </div>
                )}
                <div className="progress age-progress" aria-label="本年度生日進度">
                  <span style={{ width: `${info.yearProgress}%` }} />
                </div>
                <p className="muted age-progress-label">本年度生日進度 {info.yearProgress.toFixed(0)}%</p>

                <div className="age-next-ms">
                  <h4 className="age-next-ms-title">接下來的里程碑</h4>
                  {upcomingPreview.length ? (
                    <ul className="age-next-ms-list">
                      {upcomingPreview.map((m) => (
                        <li key={m.id} className="age-next-ms-item">
                          <div className="age-next-ms-body">
                            <strong>{m.label}</strong>
                            <span className="muted">約 {m.ageLabel}</span>
                          </div>
                          <div className="age-next-ms-meta">
                            <span className="mono">{formatIso(m.date)}</span>
                            <span className="muted">還有 {m.remain.toLocaleString()} 天</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      已完成目前列表中的全部里程碑
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section className="panel age-milestones">
              <div className="age-panel-head">
                <h3 className="age-panel-title">人生里程碑</h3>
                <div className="age-ms-filters" role="tablist" aria-label="里程碑篩選">
                  {(
                    [
                      ['all', '全部'],
                      ['upcoming', '未達成'],
                      ['passed', '已達成'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={milestoneFilter === id}
                      className={`btn sm ${milestoneFilter === id ? 'accent' : 'ghost'}`}
                      onClick={() => setMilestoneFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="muted age-ms-hint">年齡對照以該日的足歲計算（幾歲幾個月）</p>
              <ul className="age-ms-list">
                {filteredMilestones.map((m) => (
                  <li key={m.id} className={`age-ms-item${m.passed ? ' is-passed' : ''}`}>
                    <span className={`tag age-ms-tag${m.passed ? ' is-passed' : ''}`}>
                      {m.passed ? '已達成' : '尚未'}
                    </span>
                    <div className="age-ms-body">
                      <strong>{m.label}</strong>
                      <span className="muted">到達時約 {m.ageLabel}</span>
                    </div>
                    <div className="age-ms-meta">
                      <span className="mono">{formatIso(m.date)}</span>
                      {!m.passed && (
                        <span className="muted">還有 {m.remain.toLocaleString()} 天</span>
                      )}
                    </div>
                  </li>
                ))}
                {!filteredMilestones.length && <li className="muted">此篩選沒有項目</li>}
              </ul>
            </section>
          </>
        )}
      </div>
    </ProjectShell>
  )
}
