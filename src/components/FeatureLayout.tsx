import type { ReactNode } from 'react'
import type { ProjectMeta } from '../projects/registry'
import { PDF_MAX_BYTES, PDF_MAX_PAGES } from '../lib/pdf'
import { formatBytes } from '../lib/utils'
import { ProjectShell } from './ProjectShell'

export type FeatureInfoItem = { label: string; value: ReactNode }

type FaqBlock = { title: string; body: ReactNode }

type Props = {
  meta: ProjectMeta
  actions?: ReactNode
  toolbar?: ReactNode
  aside?: ReactNode
  /** unified：工具列與主內容同一 panel，減少「三層盒子」 */
  variant?: 'stacked' | 'unified'
  infoItems?: FeatureInfoItem[]
  faq?: FaqBlock[]
  /** 預設 true：自動附上「保存多久／安全界線」通用 FAQ 與摘要 */
  labFaq?: boolean
  footerHint?: string
  children: ReactNode
}

export function FeatureLayout({
  meta,
  actions,
  toolbar,
  aside,
  infoItems,
  faq,
  labFaq = true,
  footerHint,
  children,
  variant = 'unified',
}: Props) {
  const hasAside = Boolean(aside)
  const unified = variant === 'unified'
  const mergedInfo = mergeLabInfoItems(infoItems, labFaq)
  const mergedFaq = mergeLabFaqs(faq, labFaq)
  return (
    <ProjectShell meta={meta} actions={actions}>
      <div className="ft-calc">
        {!unified && toolbar ? <section className="panel ft-toolbar">{toolbar}</section> : null}
        <div className={hasAside ? 'ft-main ft-main-split' : 'ft-main ft-main-single'}>
          <section className="panel ft-content">
            {unified && toolbar ? <div className="ft-ui-toolbar">{toolbar}</div> : null}
            {children}
          </section>
          {aside ? <section className="panel ft-aside">{aside}</section> : null}
        </div>
        <section className="panel ft-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          {mergedInfo.length > 0 ? (
            <ul className="pw-info-list">
              {mergedInfo.map((item) => (
                <li key={item.label}>
                  <span className="muted">{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {mergedFaq.length > 0 ? (
            <div className="ft-faq">
              {mergedFaq.map((block) => (
                <p key={block.title}>
                  <strong>{block.title}</strong>
                  {block.body}
                </p>
              ))}
            </div>
          ) : null}
          {footerHint ? <p className="muted ft-hint">{footerHint}</p> : null}
        </section>
      </div>
    </ProjectShell>
  )
}

/** 全站「日常應用」等頁面底部摘要 */
export const ftLabInfoItems: FeatureInfoItem[] = [
  { label: '保存期限', value: '本機儲存，直到清除瀏覽器資料或換裝置' },
  { label: '服務性質', value: '前端示範工具，非對外托管的正式服務' },
]

export const ftDataRetention: FaqBlock = {
  title: '資料會保存多久？',
  body:
    '多數設定與紀錄寫在瀏覽器本機（如 localStorage），本站沒有帳號雲端備份。清除網站資料、無痕模式結束、換瀏覽器或換裝置後，資料可能消失或無法沿用。',
}

export const ftSecurityScope: FaqBlock = {
  title: '惡意利用與攻擊風險',
  body:
    '這裡是學習／自用示範，沒有對外托管的正式服務後端。仍請勿在正式環境輸入真實密碼、API 金鑰或機敏個資；若工具會呼叫外部 API（IP、GitHub 等），請求會送到該第三方。',
}

export const ftNotProduction: FaqBlock = {
  title: '能否當正式產品使用？',
  body: '不建議。未經完整安全審查、SLA 與合規流程，不應替代正式產品或對外服務。',
}

export function mergeLabInfoItems(extra: FeatureInfoItem[] = [], includeLab = true): FeatureInfoItem[] {
  if (!includeLab) return extra
  const labels = new Set(extra.map((i) => i.label))
  return [...extra, ...ftLabInfoItems.filter((i) => !labels.has(i.label))]
}

export function mergeLabFaqs(extra: FaqBlock[] = [], includeLab = true): FaqBlock[] {
  if (!includeLab) return extra ?? []
  const list = extra ?? []
  const titles = new Set(list.map((b) => b.title))
  const tail = [ftDataRetention, ftSecurityScope, ftNotProduction].filter((b) => !titles.has(b.title))
  return [...list, ...tail]
}

/** 常用 FAQ 片段（本機優先工具） */
export const ftPrivacyLocal: FaqBlock = {
  title: '隱私',
  body: '資料與設定多存於本機瀏覽器；不上傳伺服器（除非該工具另有說明）。',
}

export const ftPdfLocal = {
  title: 'PDF 處理',
  body: '於瀏覽器本機讀寫 PDF，檔案不會上傳。掃描版或加密 PDF 可能無法完整處理。',
}

export function ftPdfInfoItems(extra: FeatureInfoItem[] = []): FeatureInfoItem[] {
  return [
    { label: '單檔大小上限', value: formatBytes(PDF_MAX_BYTES) },
    { label: '頁數上限', value: `${PDF_MAX_PAGES} 頁` },
    ...extra,
  ]
}

export const ftPdfFaq: FaqBlock[] = [
  ftPdfLocal,
  ftPrivacyLocal,
  {
    title: '加密或受保護 PDF',
    body: '設有開啟密碼或權限的 PDF 可能無法完整處理；本工具無法代為破解密碼。',
  },
  {
    title: '掃描版 PDF',
    body: '每頁皆為影像的掃描檔通常仍可合併、旋轉或轉圖，但無法擷取可選文字。',
  },
]
