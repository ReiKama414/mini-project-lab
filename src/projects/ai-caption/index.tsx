import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('ai-caption')!

type Style = 'ig' | 'product' | 'alt'

const STYLE_LABEL: Record<Style, string> = {
  ig: 'IG 貼文',
  product: '商品文案',
  alt: '無障礙 Alt',
}

function hashtags(keywords: string[], style: Style) {
  const base = keywords.slice(0, 4).map((k) => `#${k.replace(/\s+/g, '')}`)
  if (style === 'ig') return [...base, '#日常', '#分享', '#生活感'].slice(0, 8).join(' ')
  if (style === 'product') return [...base, '#熱銷', '#新品', '#限時'].slice(0, 8).join(' ')
  return ''
}

function buildVariants(keywords: string, style: Style) {
  const k = keywords
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const main = k[0] || '畫面'
  const rest = k.slice(1).join('、') || '細節'
  const tags = hashtags(k.length ? k : [main], style)

  const pool: Record<Style, string[]> = {
    ig: [
      `${main}的這個瞬間，${rest}剛剛好。\n\n今天想慢一點看光。\n\n${tags}`,
      `當${main}遇上${rest}——心情直接被點亮。\n\n你最近有什麼小確幸？\n\n${tags}`,
      `存進回憶夾：${main} × ${rest}\n\n願你也被溫柔的光線找到。\n\n${tags}`,
    ],
    product: [
      `【熱銷推薦】${main}\n重點賣點：${rest}\n立即提升點擊的主圖說明。\n\n${tags}`,
      `新品上架｜${main}\n為什麼值得入手：${rest}\n限量優惠進行中。\n\n${tags}`,
      `${main} — 為在意${rest}的你設計\n規格清晰、開箱即用。\n\n${tags}`,
    ],
    alt: [
      `一張顯示「${main}」的照片，畫面中可見${rest}，光線自然。`,
      `特寫：${main}置於中央，背景帶有${rest}，適合說明產品外觀。`,
      `場景照：${main}與${rest}同框，色彩真實、無文字浮水印。`,
    ],
  }

  return pool[style].map((text) => ({ id: uid('cap'), text, tags: style === 'alt' ? '' : tags }))
}

export default function Page() {
  const [kw, setKw] = useLocalStorage('lab:ai-caption:kw', '咖啡, 木桌, 晨光')
  const [style, setStyle] = useLocalStorage<Style>('lab:ai-caption:style', 'ig')
  const [list, setList] = useState<{ id: string; text: string; tags: string }[]>([])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="label">關鍵字</label>
        <input className="field" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="主題, 物件, 氛圍" />
        <label className="label">風格</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(Object.keys(STYLE_LABEL) as Style[]).map((s) => (
            <button key={s} type="button" className={`btn sm ${style === s ? 'accent' : 'ghost'}`} onClick={() => setStyle(s)}>
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>
        <button type="button" className="btn accent" onClick={() => setList(buildVariants(kw, style))}>
          產生多則變體
        </button>
        <ul className="list">
          {list.map((c, i) => (
            <li key={c.id} className="list-item stack">
              <div className="row">
                <span className="tag">變體 {i + 1}</span>
                {c.tags && <span className="muted">含 hashtags</span>}
              </div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {c.text}
              </pre>
              <button type="button" className="btn sm ghost" onClick={() => copyText(c.text)}>
                複製
              </button>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="muted">選擇 IG／商品／Alt-text 後產生變體</p>}
      </div>
    </ProjectShell>
  )
}
