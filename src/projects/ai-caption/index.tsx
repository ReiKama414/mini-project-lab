import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('ai-caption')!

type Style = 'ig' | 'product' | 'alt' | 'linkedin'
type Variant = { id: string; text: string; style: Style; at: number }

const STYLE_LABEL: Record<Style, string> = {
  ig: 'IG 貼文',
  product: '商品文案',
  alt: '無障礙 Alt',
  linkedin: 'LinkedIn',
}

function hashtags(keywords: string[], style: Style) {
  const base = keywords.slice(0, 4).map((k) => `#${k.replace(/\s+/g, '')}`)
  if (style === 'ig') return [...base, '#日常', '#分享', '#生活感'].slice(0, 8).join(' ')
  if (style === 'product') return [...base, '#熱銷', '#新品', '#限時'].slice(0, 8).join(' ')
  if (style === 'linkedin') return [...base, '#Learning', '#Career'].slice(0, 6).join(' ')
  return ''
}

function buildVariants(keywords: string, scene: string, style: Style): Variant[] {
  const k = keywords
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const main = k[0] || '畫面'
  const rest = k.slice(1).join('、') || '細節'
  const sceneBit = scene.trim() ? `（場景：${scene.trim()}）` : ''
  const tags = hashtags(k.length ? k : [main], style)
  const at = Date.now()

  const pool: Record<Style, string[]> = {
    ig: [
      `${main}的這個瞬間，${rest}剛剛好。${sceneBit}\n\n今天想慢一點看光。\n\n${tags}`,
      `當${main}遇上${rest}——心情直接被點亮。${sceneBit}\n\n你最近有什麼小確幸？\n\n${tags}`,
      `存進回憶夾：${main} × ${rest}${sceneBit}\n\n願你也被溫柔的光線找到。\n\n${tags}`,
    ],
    product: [
      `【熱銷推薦】${main}\n重點賣點：${rest}\n${sceneBit}\n立即提升點擊的主圖說明。\n\n${tags}`,
      `新品上架｜${main}\n為什麼值得入手：${rest}\n${sceneBit}\n限量優惠進行中。\n\n${tags}`,
      `${main} — 為在意${rest}的你設計\n規格清晰、開箱即用。${sceneBit}\n\n${tags}`,
    ],
    alt: [
      `一張顯示「${main}」的照片，畫面中可見${rest}${sceneBit}，光線自然。`,
      `特寫：${main}置於中央，背景帶有${rest}${sceneBit}，適合說明產品外觀。`,
      `場景照：${main}與${rest}同框${sceneBit}，色彩真實、無文字浮水印。`,
    ],
    linkedin: [
      `今天從「${main}」學到一件事：${rest}。${sceneBit}\n\n分享給正在迭代產品的你。\n\n${tags}`,
      `觀察筆記｜${main}\n關鍵洞察：${rest}${sceneBit}\n\n歡迎交流你的做法。\n\n${tags}`,
      `${main} 不是終點，而是驗證假設的過程。重點在 ${rest}。${sceneBit}\n\n${tags}`,
    ],
  }

  return pool[style].map((text) => ({ id: uid('cap'), text, style, at }))
}

export default function Page() {
  const [kw, setKw] = useLocalStorage('lab:ai-caption:kw', '咖啡, 木桌, 晨光')
  const [scene, setScene] = useLocalStorage('lab:ai-caption:scene', '窗邊咖啡廳')
  const [style, setStyle] = useLocalStorage<Style>('lab:ai-caption:style', 'ig')
  const [list, setList] = useState<Variant[]>([])
  const [favs, setFavs] = useLocalStorage<Variant[]>('lab:ai-caption:favs', [])

  const charStats = useMemo(
    () => list.map((c) => ({ id: c.id, n: c.text.length })),
    [list],
  )

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">關鍵字</label>
          <input
            className="field"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="主題, 物件, 氛圍"
          />
          <label className="label">場景描述（可選）</label>
          <input
            className="field"
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="例如：窗邊咖啡廳、產品棚拍"
          />
          <label className="label">風格</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(STYLE_LABEL) as Style[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn sm ${style === s ? 'accent' : 'ghost'}`}
                onClick={() => setStyle(s)}
              >
                {STYLE_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn accent"
            onClick={() => setList(buildVariants(kw, scene, style))}
          >
            產生多則變體
          </button>
          <p className="muted">本機模板產生，可當靈感起點再微調。</p>
        </div>

        <div className="panel stack">
          <h3>結果</h3>
          <ul className="list">
            {list.map((c, i) => (
              <li key={c.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
                <div className="row">
                  <span className="tag">
                    變體 {i + 1} · {STYLE_LABEL[c.style]}
                  </span>
                  <span className="muted mono">{charStats[i]?.n} 字</span>
                </div>
                <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {c.text}
                </pre>
                <div className="row">
                  <button type="button" className="btn sm ghost" onClick={() => void copyText(c.text)}>
                    複製
                  </button>
                  <button
                    type="button"
                    className="btn sm teal"
                    onClick={() =>
                      setFavs((xs) => [c, ...xs.filter((x) => x.text !== c.text)].slice(0, 20))
                    }
                  >
                    收藏
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!list.length && <p className="muted">選擇風格後產生變體</p>}
        </div>
      </div>

      {!!favs.length && (
        <div className="panel stack" style={{ marginTop: 12 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>收藏</h3>
            <button type="button" className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setFavs([])}>
              清空收藏
            </button>
          </div>
          <ul className="list">
            {favs.map((f) => (
              <li key={f.id} className="list-item">
                <span className="tag">{STYLE_LABEL[f.style]}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.text.split('\n')[0]}
                </span>
                <button type="button" className="btn ghost sm" onClick={() => void copyText(f.text)}>
                  複製
                </button>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => setFavs((xs) => xs.filter((x) => x.id !== f.id))}
                >
                  刪
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ProjectShell>
  )
}
