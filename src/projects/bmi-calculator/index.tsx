import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { DeleteButton } from '../../components/DeleteButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber, uid } from '../../lib/utils'

const meta = getProject('bmi-calculator')!

const CM_MIN = 50
const CM_MAX = 250
const KG_MIN = 20
const KG_MAX = 300
const FT_MIN = 3
const FT_MAX = 8
const IN_MIN = 0
const IN_MAX = 11
const LB_MIN = 40
const LB_MAX = 660
const WAIST_CM_MIN = 40
const WAIST_CM_MAX = 200

/** 衛福部國民健康署台灣成人 BMI 切點 */
type Band = { upTo: number; label: string; color: string }

const TW_BANDS: Band[] = [
  { upTo: 18.5, label: '過輕', color: '#3b82f6' },
  { upTo: 24, label: '正常', color: '#2a9d8f' },
  { upTo: 27, label: '過重', color: '#e9a319' },
  { upTo: 30, label: '輕度肥胖', color: '#f0734a' },
  { upTo: 35, label: '中度肥胖', color: '#e85d4c' },
  { upTo: Infinity, label: '重度肥胖', color: '#d6406a' },
]

/** WHO 成人 BMI 切點 */
const WHO_BANDS: Band[] = [
  { upTo: 18.5, label: '過輕', color: '#3b82f6' },
  { upTo: 25, label: '正常', color: '#2a9d8f' },
  { upTo: 30, label: '過重', color: '#e9a319' },
  { upTo: 35, label: '肥胖 I 級', color: '#f0734a' },
  { upTo: 40, label: '肥胖 II 級', color: '#e85d4c' },
  { upTo: Infinity, label: '肥胖 III 級', color: '#d6406a' },
]

/** 台灣代謝症候群腹部肥胖切點（國健署）：男 ≥90、女 ≥80 cm */
const WAIST_CUTOFF = { male: 90, female: 80 } as const

type Sex = 'male' | 'female'
type Unit = 'metric' | 'imperial'
type Standard = 'tw' | 'who'
type Hist = {
  id: string
  cm: number
  kg: number
  bmi: number
  waistCm?: number
  sex?: Sex
  at: number
}

function classifyBmi(bmi: number, standard: Standard) {
  const bands = standard === 'tw' ? TW_BANDS : WHO_BANDS
  for (const b of bands) {
    if (bmi < b.upTo) return b
  }
  return bands[bands.length - 1]!
}

function bandRanges(standard: Standard) {
  const bands = standard === 'tw' ? TW_BANDS : WHO_BANDS
  let lo = 0
  return bands.map((b) => {
    const range = { lo, hi: b.upTo === Infinity ? 40 : b.upTo, ...b }
    lo = range.hi
    return range
  })
}

function setClamped(
  raw: string,
  min: number,
  max: number,
  set: (n: number) => void,
  setErr: (msg: string) => void,
) {
  const n = parseNumber(raw)
  if (!Number.isFinite(n)) {
    setErr('請輸入有效數字')
    return
  }
  setErr('')
  set(clamp(n, min, max))
}

function cmToFtIn(cm: number) {
  const totalInch = cm / 2.54
  let ft = Math.floor(totalInch / 12)
  let inch = Math.round(totalInch - ft * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return {
    ft: clamp(ft, FT_MIN, FT_MAX),
    inch: clamp(inch, IN_MIN, IN_MAX),
  }
}

function ScaleBar({
  value,
  max,
  markerAt,
  markerLabel,
  color,
  segments,
}: {
  value: number
  max: number
  markerAt?: number
  markerLabel?: string
  color: string
  segments: { pct: number; color: string; title: string }[]
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const markerPct = markerAt != null ? Math.min(100, Math.max(0, (markerAt / max) * 100)) : null
  return (
    <div className="bmi-scale">
      <div className="bmi-scale-track" role="img" aria-label="指標條">
        {segments.map((s, i) => (
          <span key={i} title={s.title} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
        <i className="bmi-scale-needle" style={{ left: `${pct}%`, background: color }} />
        {markerPct != null && (
          <i className="bmi-scale-cutoff" style={{ left: `${markerPct}%` }} title={markerLabel} />
        )}
      </div>
      {markerLabel && markerPct != null && (
        <div className="bmi-scale-cutoff-label" style={{ left: `${markerPct}%` }}>
          {markerLabel}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  const [unit, setUnit] = useLocalStorage<Unit>('lab:bmi:unit', 'metric')
  const [standard, setStandard] = useLocalStorage<Standard>('lab:bmi:standard', 'tw')
  const [sex, setSex] = useLocalStorage<Sex>('lab:bmi:sex', 'male')
  const [cm, setCm] = useLocalStorage('lab:bmi:cm', 170)
  const [kg, setKg] = useLocalStorage('lab:bmi:kg', 65)
  const [ft, setFt] = useLocalStorage('lab:bmi:ft', 5)
  const [inch, setInch] = useLocalStorage('lab:bmi:inch', 7)
  const [lb, setLb] = useLocalStorage('lab:bmi:lb', 143)
  const [waistCm, setWaistCm] = useLocalStorage('lab:bmi:waistCm', 80)
  const [waistIn, setWaistIn] = useLocalStorage('lab:bmi:waistIn', 31)
  const [history, setHistory] = useLocalStorage<Hist[]>('lab:bmi:history', [])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const metric = useMemo(() => {
    if (unit === 'metric') return { cm, kg, waistCm }
    const totalInch = ft * 12 + inch
    return {
      cm: totalInch * 2.54,
      kg: lb * 0.453592,
      waistCm: waistIn * 2.54,
    }
  }, [unit, cm, kg, ft, inch, lb, waistCm, waistIn])

  const bmi = useMemo(() => {
    const m = metric.cm / 100
    if (!m || !metric.kg) return 0
    return metric.kg / (m * m)
  }, [metric])

  const ideal = useMemo(() => {
    const m = metric.cm / 100
    if (!m) return null
    const lo = 18.5
    const hi = standard === 'tw' ? 23.9 : 24.9
    return { lo: lo * m * m, hi: hi * m * m }
  }, [metric.cm, standard])

  const cat = classifyBmi(bmi, standard)
  const waistCutoff = WAIST_CUTOFF[sex]
  const waistRisk = metric.waistCm >= waistCutoff
  const waistLabel = waistRisk ? '腹部肥胖風險偏高' : '腰圍在建議範圍內'
  const waistColor = waistRisk ? '#d6406a' : '#2a9d8f'

  const riskNote = useMemo(() => {
    if (!bmi) return null
    const grade = cat.label
    const severe =
      grade.includes('重度') ||
      grade.includes('III') ||
      grade.includes('II 級') ||
      bmi >= 35
    const obese =
      severe ||
      grade.includes('中度') ||
      grade.includes('輕度肥胖') ||
      grade.includes('肥胖') ||
      bmi >= 27
    const overweight = !obese && (grade.includes('過重') || bmi >= 24)
    const under = grade.includes('過輕') || bmi < 18.5

    const waistLine = waistRisk
      ? `腰圍 ${metric.waistCm.toFixed(1)} cm，已達${sex === 'male' ? '男性' : '女性'}腹部肥胖切點（≥${waistCutoff} cm）。`
      : `腰圍 ${metric.waistCm.toFixed(1)} cm，尚未達腹部肥胖切點（${sex === 'male' ? '男' : '女'} ≥${waistCutoff} cm）。`

    let advice = ''
    let diseases: string[] = []
    let diet: string[] = []
    let exercise: string[] = []
    let sleep: string[] = []

    if (under) {
      advice = '體重偏輕，需評估營養是否足夠，避免不健康減重或潛在疾病。'
      diseases = ['營養不良／肌少風險', '免疫力下降', '骨質疏鬆風險', '貧血、荷爾蒙失調（視個案）']
      diet = ['三餐定時，增加優質蛋白（蛋豆魚肉）', '健康脂肪：堅果、酪梨、橄欖油', '必要時營養師評估熱量與微量營養素', '避免以含糖飲料「硬增重」']
      exercise = ['阻力訓練 2～3 次／週，優先長肌肉', '避免過長有氧導致熱量赤字過大', '活動後補充蛋白質與碳水化合物']
      sleep = ['每晚 7～9 小時', '固定作息，睡前少咖啡因', '壓力大時優先恢復睡眠再增訓']
    } else if (!overweight && !obese) {
      advice = waistRisk
        ? 'BMI 雖正常，但腰圍偏高，仍有中心型肥胖與代謝風險。'
        : 'BMI 與腰圍目前較理想，重點是維持良好生活型態。'
      diseases = waistRisk
        ? ['代謝症候群風險（腰圍已超標）', '第二型糖尿病風險上升', '高血壓、血脂異常', '心血管疾病風險']
        : ['維持現況可降低代謝相關疾病風險', '仍建議定期健檢（血壓／血糖／血脂）']
      diet = [
        '均衡飲食：蔬菜、全穀、蛋白質各半／適量',
        '減少含糖飲料與超加工零食',
        '外食注意油炸與醬料份量',
        waistRisk ? '腰圍超標：晚餐減精緻澱粉、少酒' : '維持現有熱量平衡即可',
      ]
      exercise = [
        '有氧 150 分鐘／週（快走、騎車、游泳）',
        '肌力訓練 2 次／週',
        waistRisk ? '加強核心與日常步數（目標 ≥8000 步）' : '維持習慣比強度更重要',
      ]
      sleep = ['每晚 7～9 小時', '固定起床時間', '睡前 1 小時減少螢幕藍光']
    } else if (overweight && !obese) {
      advice = waistRisk
        ? '過重且腰圍超標，建議優先減少腹部脂肪並追蹤三高。'
        : '屬過重，建議透過飲食與運動讓 BMI 回到正常範圍。'
      diseases = ['高血壓', '血脂異常', '第二型糖尿病前期／糖尿病', '脂肪肝', '痛風、關節負擔', ...(waistRisk ? ['代謝症候群'] : [])]
      diet = [
        '每日熱量略低於維持量（約少 300～500 kcal，勿極端節食）',
        '半盤蔬菜、1/4 蛋白質、1/4 全穀',
        '少油炸、少含糖飲料、少宵夜',
        '多喝水，酒精每週限制',
      ]
      exercise = [
        '有氧≥150 分鐘／週，可漸進到 200～300 分鐘',
        '阻力訓練 2～3 次／週',
        '日常多走路、少久坐（每小時起身）',
      ]
      sleep = ['每晚 7～9 小時，睡不夠會影響食慾荷爾蒙', '固定就寢／起床', '打鼾嚴重者評估睡眠呼吸中止']
    } else if (severe) {
      advice = '已達重度肥胖等級，慢性病與手術風險明顯升高，建議儘速就醫或減重門診。'
      diseases = [
        '第二型糖尿病',
        '高血壓、冠心病、中風風險',
        '代謝症候群',
        '脂肪肝／肝硬化風險',
        '睡眠呼吸中止症',
        '退化性關節炎、痛風',
        '部分癌症風險上升',
        '手術／麻醉相關風險',
      ]
      diet = [
        '勿自行極端節食或來路不明減肥藥',
        '在醫師／營養師指導下調整熱量與營養素',
        '減少超加工食品、含糖飲料、酒精',
        '採高纖、足夠蛋白，避免營養缺乏',
      ]
      exercise = [
        '從低衝擊開始：散步、水中運動、腳踏車',
        '避免高衝擊跑跳造成關節傷害',
        '有共病時先經醫師評估再運動',
        '漸進增加活動量，每周可測量腰圍與體重',
      ]
      sleep = [
        '目標 7～9 小時；打鼾、白天嗜睡需就醫',
        '側睡可能改善部分呼吸中止症狀（仍需診斷）',
        '固定作息，睡前避免大餐與酒精',
      ]
    } else {
      advice = waistRisk
        ? '已屬肥胖且腰圍超標，代謝症候群風險較高，建議就醫擬定減重計畫。'
        : '已屬肥胖等級，建議專業評估體脂與共病，並開始可長期執行的減重計畫。'
      diseases = [
        '第二型糖尿病',
        '高血壓、血脂異常',
        '代謝症候群',
        '脂肪肝',
        '睡眠呼吸中止症',
        '膝／髖關節負擔、痛風',
        '心血管疾病風險',
      ]
      diet = [
        '熱量赤字溫和（約 300～500 kcal／日），重可持續',
        '蔬菜過半、精緻澱粉減量、蛋白質充足',
        '少油炸、少含糖飲料、少加工肉品',
        '記錄飲食 1～2 週找出超額來源',
      ]
      exercise = [
        '有氧 150～300 分鐘／週',
        '阻力訓練 2～3 次／週保肌肉',
        '低衝擊優先，保護關節',
        '搭配步數目標，減少久坐',
      ]
      sleep = [
        '每晚 7～9 小時',
        '睡眠不足易嘴饞、減重失敗',
        '打鼾或呼吸暫停症狀請就醫評估',
      ]
    }

    return {
      grade,
      color: cat.color,
      bmiText: `BMI ${bmi.toFixed(1)} → ${grade}`,
      waistLine,
      advice,
      diseases,
      diet,
      exercise,
      sleep,
    }
  }, [bmi, cat, waistRisk, metric.waistCm, sex, waistCutoff])


  const canSave = Number.isFinite(bmi) && bmi > 0 && !error

  const bmiSegments = useMemo(() => {
    const ranges = bandRanges(standard)
    const max = 40
    return ranges.map((r) => ({
      pct: ((Math.min(r.hi, max) - r.lo) / max) * 100,
      color: r.color,
      title: `${r.label}（${r.lo}–${r.hi === 40 && r.upTo === Infinity ? '≥35' : r.hi}）`,
    }))
  }, [standard])

  const waistSegments = useMemo(() => {
    const cut = waistCutoff
    const max = 140
    const okPct = (cut / max) * 100
    return [
      { pct: okPct, color: '#2a9d8f', title: `建議範圍 < ${cut} cm` },
      { pct: 100 - okPct, color: '#d6406a', title: `腹部肥胖 ≥ ${cut} cm` },
    ]
  }, [waistCutoff])

  function switchUnit(next: Unit) {
    if (next === unit) return
    if (next === 'imperial') {
      const converted = cmToFtIn(cm)
      setFt(converted.ft)
      setInch(converted.inch)
      setLb(clamp(Math.round(kg / 0.453592), LB_MIN, LB_MAX))
      setWaistIn(clamp(Math.round((waistCm / 2.54) * 10) / 10, 16, 80))
    } else {
      const totalInch = ft * 12 + inch
      setCm(clamp(Math.round(totalInch * 2.54), CM_MIN, CM_MAX))
      setKg(clamp(Math.round(lb * 0.453592 * 10) / 10, KG_MIN, KG_MAX))
      setWaistCm(clamp(Math.round(waistIn * 2.54 * 10) / 10, WAIST_CM_MIN, WAIST_CM_MAX))
    }
    setUnit(next)
    setError('')
  }

  function save() {
    if (!canSave) return
    setHistory(
      [
        {
          id: uid('b'),
          cm: metric.cm,
          kg: metric.kg,
          bmi,
          waistCm: metric.waistCm,
          sex,
          at: Date.now(),
        },
        ...history,
      ].slice(0, 20),
    )
  }

  async function copyResult() {
    if (!bmi) return
    const text = [
      `BMI ${bmi.toFixed(1)}（${cat.label}）`,
      sex === 'male' ? '男性' : '女性',
      `腰圍 ${metric.waistCm.toFixed(1)} cm（${waistLabel}）`,
      `${metric.cm.toFixed(0)} cm · ${metric.kg.toFixed(1)} kg`,
      standard === 'tw' ? '標準：衛福部台灣切點' : '標準：WHO',
    ].join(' · ')
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function formatHistoryLine(h: Hist) {
    const sexLabel = h.sex === 'male' ? '男' : h.sex === 'female' ? '女' : ''
    return [
      `BMI ${h.bmi.toFixed(1)}`,
      `${h.cm.toFixed(0)} cm`,
      `${h.kg.toFixed(1)} kg`,
      h.waistCm != null ? `腰圍 ${h.waistCm.toFixed(0)} cm` : null,
      sexLabel || null,
      new Date(h.at).toLocaleString(),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  function historyAsCsv() {
    const header = 'bmi,cm,kg,waistCm,sex,at'
    const rows = history.map(
      (h) =>
        `${h.bmi.toFixed(2)},${h.cm.toFixed(1)},${h.kg.toFixed(2)},${h.waistCm?.toFixed(1) ?? ''},${h.sex ?? ''},${new Date(h.at).toISOString()}`,
    )
    return `\uFEFF${[header, ...rows].join('\n')}`
  }

  function historyAsTxt() {
    return history.map(formatHistoryLine).join('\n')
  }

  function historyAsJson() {
    return JSON.stringify(
      history.map((h) => ({
        bmi: Number(h.bmi.toFixed(2)),
        cm: Number(h.cm.toFixed(1)),
        kg: Number(h.kg.toFixed(2)),
        waistCm: h.waistCm != null ? Number(h.waistCm.toFixed(1)) : null,
        sex: h.sex ?? null,
        at: new Date(h.at).toISOString(),
      })),
      null,
      2,
    )
  }

  async function exportHistory(kind: string) {
    if (!history.length || !kind) return
    if (kind === 'csv') {
      downloadText('bmi-history.csv', historyAsCsv(), 'text/csv;charset=utf-8')
      return
    }
    if (kind === 'txt') {
      downloadText('bmi-history.txt', historyAsTxt(), 'text/plain;charset=utf-8')
      return
    }
    if (kind === 'json') {
      downloadText('bmi-history.json', historyAsJson(), 'application/json;charset=utf-8')
      return
    }
    if (kind === 'copy') {
      await copyText(historyAsTxt())
    }
  }

  function clearHistory() {
    if (!history.length) return
    if (!confirm(`確定刪除全部 ${history.length} 筆歷史紀錄？此動作無法復原。`)) return
    setHistory([])
  }

  return (
    <ProjectShell meta={meta}>
      <div className="bmi-calc">
        <div className="bmi-main">
          <section className="panel stack bmi-panel">
            <div className="bmi-toolbar compact">
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className={`btn sm ${unit === 'metric' ? 'accent' : 'ghost'}`}
                  onClick={() => switchUnit('metric')}
                >
                  公制
                </button>
                <button
                  type="button"
                  className={`btn sm ${unit === 'imperial' ? 'accent' : 'ghost'}`}
                  onClick={() => switchUnit('imperial')}
                >
                  英制
                </button>
                <button
                  type="button"
                  className={`btn sm ${standard === 'tw' ? 'accent' : 'ghost'}`}
                  onClick={() => setStandard('tw')}
                >
                  台灣切點
                </button>
                <button
                  type="button"
                  className={`btn sm ${standard === 'who' ? 'accent' : 'ghost'}`}
                  onClick={() => setStandard('who')}
                >
                  WHO
                </button>
              </div>
            </div>

            <h3 className="bmi-panel-title">輸入數值</h3>
            {unit === 'metric' ? (
              <div className="bmi-fields">
                <label className="stack bmi-field">
                  <span className="label">身高 (cm)</span>
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={CM_MIN}
                    max={CM_MAX}
                    value={cm}
                    onChange={(e) => setClamped(e.target.value, CM_MIN, CM_MAX, setCm, setError)}
                  />
                </label>
                <label className="stack bmi-field">
                  <span className="label">體重 (kg)</span>
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={KG_MIN}
                    max={KG_MAX}
                    value={kg}
                    onChange={(e) => setClamped(e.target.value, KG_MIN, KG_MAX, setKg, setError)}
                  />
                </label>
              </div>
            ) : (
              <div className="bmi-fields bmi-fields-3">
                <label className="stack bmi-field">
                  <span className="label">呎</span>
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={FT_MIN}
                    max={FT_MAX}
                    value={ft}
                    onChange={(e) => setClamped(e.target.value, FT_MIN, FT_MAX, setFt, setError)}
                  />
                </label>
                <label className="stack bmi-field">
                  <span className="label">吋</span>
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={IN_MIN}
                    max={IN_MAX}
                    value={inch}
                    onChange={(e) => setClamped(e.target.value, IN_MIN, IN_MAX, setInch, setError)}
                  />
                </label>
                <label className="stack bmi-field">
                  <span className="label">磅</span>
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={LB_MIN}
                    max={LB_MAX}
                    value={lb}
                    onChange={(e) => setClamped(e.target.value, LB_MIN, LB_MAX, setLb, setError)}
                  />
                </label>
              </div>
            )}

            <div className="bmi-fields">
              <label className="stack bmi-field">
                <span className="label">生理性別</span>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className={`btn sm ${sex === 'male' ? 'accent' : 'ghost'}`}
                    onClick={() => setSex('male')}
                  >
                    成年男性
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${sex === 'female' ? 'accent' : 'ghost'}`}
                    onClick={() => setSex('female')}
                  >
                    成年女性
                  </button>
                </div>
              </label>
              <label className="stack bmi-field">
                <span className="label">腰圍 {unit === 'metric' ? '(cm)' : '(in)'}</span>
                {unit === 'metric' ? (
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={WAIST_CM_MIN}
                    max={WAIST_CM_MAX}
                    step={0.1}
                    value={waistCm}
                    onChange={(e) =>
                      setClamped(e.target.value, WAIST_CM_MIN, WAIST_CM_MAX, setWaistCm, setError)
                    }
                  />
                ) : (
                  <input
                    className={`field${error ? ' is-invalid' : ''}`}
                    type="number"
                    min={16}
                    max={80}
                    step={0.1}
                    value={waistIn}
                    onChange={(e) => setClamped(e.target.value, 16, 80, setWaistIn, setError)}
                  />
                )}
                <p className="field-hint">
                  切點：男 ≥{WAIST_CUTOFF.male}、女 ≥{WAIST_CUTOFF.female} cm
                </p>
              </label>
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn accent" onClick={save} disabled={!canSave}>
                儲存本次紀錄
              </button>
              <button type="button" className="btn ghost" onClick={() => void copyResult()} disabled={!bmi}>
                {copied ? '已複製' : '複製結果'}
              </button>
            </div>
          </section>

          <section className="panel stack bmi-panel bmi-panel-result">
            <div className="bmi-result">
              <div className="metric bmi-result-num">{bmi ? bmi.toFixed(1) : '—'}</div>
              <span className="tag" style={{ background: cat.color, color: '#fff' }} aria-live="polite">
                {bmi ? cat.label : '請輸入數值'}
              </span>
              {ideal && (
                <p className="muted bmi-ideal">
                  理想體重約 {ideal.lo.toFixed(1)} – {ideal.hi.toFixed(1)} kg
                  {unit === 'imperial' &&
                    `（${(ideal.lo / 0.453592).toFixed(0)} – ${(ideal.hi / 0.453592).toFixed(0)} lb）`}
                </p>
              )}
            </div>

            <div className="bmi-scale-block">
              <div className="bmi-indicator-head">
                <strong>BMI 指標</strong>
                <span className="muted">{standard === 'tw' ? '衛福部' : 'WHO'}</span>
              </div>
              <ScaleBar value={bmi || 0} max={40} color={cat.color} segments={bmiSegments} />
              <div className="bmi-legend">
                {bandRanges(standard).map((r) => (
                  <span key={r.label}>
                    <i style={{ background: r.color }} />
                    {r.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="bmi-scale-block">
              <div className="bmi-indicator-head">
                <strong>腰圍指標</strong>
                <span className="tag" style={{ background: waistColor, color: '#fff' }}>
                  {waistLabel}
                </span>
              </div>
              <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: 13 }}>
                {metric.waistCm.toFixed(1)} cm
                {unit === 'imperial' && `（${(metric.waistCm / 2.54).toFixed(1)} in）`}
                {' · '}
                {sex === 'male' ? '男' : '女'}切點 {waistCutoff} cm
              </p>
              <ScaleBar
                value={metric.waistCm}
                max={140}
                markerAt={waistCutoff}
                markerLabel={`切點 ${waistCutoff}`}
                color={waistColor}
                segments={waistSegments}
              />
            </div>
          </section>
        </div>

        <section className="panel stack bmi-panel">
          <h3 className="bmi-panel-title">綜合判讀與建議</h3>
          {!riskNote ? (
            <p className="muted">輸入數值後顯示疾病風險與生活建議</p>
          ) : (
            <>
              <div className="bmi-risk-summary">
                <span className="tag" style={{ background: riskNote.color, color: '#fff' }}>
                  {riskNote.grade}
                </span>
                <strong>{riskNote.bmiText}</strong>
                <p>{riskNote.waistLine}</p>
                <p>{riskNote.advice}</p>
              </div>
              <div className="bmi-guide-grid">
                <div className="bmi-guide-card">
                  <h4>相關疾病／風險</h4>
                  <ul>
                    {riskNote.diseases.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="bmi-guide-card">
                  <h4>建議飲食</h4>
                  <ul>
                    {riskNote.diet.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="bmi-guide-card">
                  <h4>建議運動</h4>
                  <ul>
                    {riskNote.exercise.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="bmi-guide-card">
                  <h4>建議睡眠／作息</h4>
                  <ul>
                    {riskNote.sleep.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="bmi-risk-disclaimer">
                以上為一般健康教育建議，非個人處方；有疾病或用藥請遵從醫師指示。
              </p>
            </>
          )}
        </section>

        <div className="bmi-bottom">
          <section className="panel bmi-panel">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h3 className="bmi-panel-title" style={{ margin: 0 }}>
                歷史紀錄
              </h3>
              {!!history.length && (
                <div className="bmi-history-actions">
                  <select
                    className="field"
                    defaultValue=""
                    aria-label="匯出歷史紀錄"
                    onChange={(e) => {
                      const kind = e.target.value
                      e.target.value = ''
                      void exportHistory(kind)
                    }}
                  >
                    <option value="" disabled>
                      匯出…
                    </option>
                    <option value="csv">下載 CSV</option>
                    <option value="txt">下載 TXT</option>
                    <option value="json">下載 JSON</option>
                    <option value="copy">複製文字</option>
                  </select>
                  <DeleteButton label="清空全部紀錄" title="一鍵刪除全部" onClick={clearHistory} />
                </div>
              )}
            </div>
            <ul className="list bmi-history-list">
              {history.map((h) => (
                <li key={h.id} className="list-item">
                  <div style={{ flex: 1 }}>
                    <strong>{h.bmi.toFixed(1)}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {h.cm.toFixed(0)} cm · {h.kg.toFixed(1)} kg
                      {h.waistCm != null ? ` · 腰圍 ${h.waistCm.toFixed(0)} cm` : ''}
                      {h.sex ? ` · ${h.sex === 'male' ? '男' : '女'}` : ''}
                      {' · '}
                      {new Date(h.at).toLocaleString()}
                    </div>
                  </div>
                  <DeleteButton
                    label="刪除此筆"
                    onClick={() => setHistory(history.filter((x) => x.id !== h.id))}
                  />
                </li>
              ))}
              {!history.length && <p className="muted">尚無紀錄</p>}
            </ul>
          </section>

          <aside className="panel bmi-panel bmi-refs">
            <h3 className="bmi-panel-title">參考來源</h3>
            <ul>
              <li>
                <a href="https://www.mohw.gov.tw/cp-3796-42429-1.html" target="_blank" rel="noreferrer">
                  衛生福利部：肥胖定義與 BMI 切點
                </a>
              </li>
              <li>
                <a href="https://data.gov.tw/dataset/8840" target="_blank" rel="noreferrer">
                  國健署：健康腰圍判定（男≥90、女≥80 cm）
                </a>
              </li>
              <li>
                <a
                  href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight"
                  target="_blank"
                  rel="noreferrer"
                >
                  WHO：Obesity and overweight
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </ProjectShell>
  )
}
