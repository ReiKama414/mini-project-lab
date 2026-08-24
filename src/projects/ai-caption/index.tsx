import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, pick } from '../../lib/utils'

const meta = getProject('ai-caption')!

const styles = ['寫實', '詩意', '電商', '幽默', '極簡'] as const

function captions(keywords: string, style: (typeof styles)[number]) {
  const k = keywords
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const main = k[0] || '畫面'
  const rest = k.slice(1).join('、') || '細節'
  const pool: Record<(typeof styles)[number], string[]> = {
    寫實: [
      `${main}特寫，光線自然，可見${rest}，適合部落格配圖。`,
      `戶外場景中的${main}，色彩真實，背景帶有${rest}。`,
    ],
    詩意: [
      `光影落在${main}上，像一句未說完的話，${rest}輕輕回應。`,
      `${main}靜靜待著，空氣裡有${rest}的氣味。`,
    ],
    電商: [
      `【熱銷】${main} — 凸顯${rest}，立即提升點擊率的商品主圖文案。`,
      `新品上架：${main}，重點賣點 ${rest}，限時優惠中。`,
    ],
    幽默: [
      `${main}表示：沒有${rest}的人生不完整（大概）。`,
      `當${main}遇上${rest}，劇本直接變成日常喜劇。`,
    ],
    極簡: [`${main}。${rest}。`, `${main} × ${rest}`],
  }
  return pool[style]
}

export default function Page() {
  const [kw, setKw] = useLocalStorage('lab:ai-caption:kw', '咖啡, 木桌, 晨光')
  const [style, setStyle] = useLocalStorage<(typeof styles)[number]>('lab:ai-caption:style', '寫實')
  const [list, setList] = useState<string[]>([])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="label">關鍵字</label>
        <input className="field" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="主題, 物件, 氛圍" />
        <label className="label">風格</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {styles.map((s) => (
            <button key={s} type="button" className={`btn sm ${style === s ? 'accent' : 'ghost'}`} onClick={() => setStyle(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="row">
          <button type="button" className="btn accent" onClick={() => setList(captions(kw, style))}>
            產生說明
          </button>
          <button type="button" className="btn ghost" onClick={() => setList([pick(captions(kw, style))])}>
            再抽一則
          </button>
        </div>
        <ul className="list">
          {list.map((c) => (
            <li key={c} className="list-item row" style={{ justifyContent: 'space-between' }}>
              <span>{c}</span>
              <button type="button" className="btn sm ghost" onClick={() => copyText(c)}>
                複製
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ProjectShell>
  )
}
