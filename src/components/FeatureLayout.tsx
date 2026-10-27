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
  footerHint,
  children,
  variant = 'unified',
}: Props) {
  const hasAside = Boolean(aside)
  const unified = variant === 'unified'
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
          {infoItems && infoItems.length > 0 ? (
            <ul className="pw-info-list">
              {infoItems.map((item) => (
                <li key={item.label}>
                  <span className="muted">{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {faq && faq.length > 0 ? (
            <div className="ft-faq">
              {faq.map((block) => (
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

/** 常用 FAQ 片段（本機優先工具） */
export const ftPrivacyLocal = {
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
