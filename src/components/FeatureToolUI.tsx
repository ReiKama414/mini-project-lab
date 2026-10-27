import type { ReactNode } from 'react'
import { formatBytes } from '../lib/utils'

/** 日常應用共用區塊（對齊 ip-lookup 視覺） */

export function FtToolRoot({ children }: { children: ReactNode }) {
  return <div className="ft-ui-root">{children}</div>
}

export function FtToolSearch({ children }: { children: ReactNode }) {
  return <section className="ft-ui-search">{children}</section>
}

export function FtToolHero({
  emoji,
  title,
  subtitle,
  meta,
  badge,
}: {
  emoji?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  badge?: ReactNode
}) {
  return (
    <section className="ft-ui-hero">
      {emoji != null && <div className="ft-ui-hero-emoji" aria-hidden>{emoji}</div>}
      <div className="ft-ui-hero-body">
        <div className="ft-ui-hero-title">{title}</div>
        {subtitle != null && <div className="ft-ui-hero-sub">{subtitle}</div>}
        {meta != null && <div className="muted ft-ui-hero-meta">{meta}</div>}
      </div>
      {badge != null && <div className="ft-ui-hero-badge">{badge}</div>}
    </section>
  )
}

export function FtMetricGrid({ children }: { children: ReactNode }) {
  return <section className="ft-ui-metrics">{children}</section>
}

export function FtMetric({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="ft-ui-metric">
      <span className="muted">{label}</span>
      <strong className={mono ? 'mono' : undefined}>{value}</strong>
    </div>
  )
}

export type FtPdfMetricExtra = { label: string; value: ReactNode; mono?: boolean }

/** PDF 工具：已選檔案的檔名／頁數／大小（置於主內容區 metrics 列） */
export function FtPdfFileMetrics({
  fileName,
  sizeBytes,
  pageCount,
  extra = [],
}: {
  fileName?: string
  sizeBytes?: number
  pageCount?: number
  extra?: FtPdfMetricExtra[]
}) {
  const hasCore = Boolean(fileName) || (pageCount != null && pageCount > 0) || (sizeBytes != null && sizeBytes > 0)
  if (!hasCore && extra.length === 0) return null
  return (
    <FtMetricGrid>
      {fileName ? <FtMetric label="檔案" value={fileName} /> : null}
      {pageCount != null && pageCount > 0 ? <FtMetric label="頁數" value={`${pageCount} 頁`} /> : null}
      {sizeBytes != null && sizeBytes > 0 ? <FtMetric label="大小" value={formatBytes(sizeBytes)} /> : null}
      {extra.map((e) => (
        <FtMetric key={e.label} label={e.label} value={e.value} mono={e.mono} />
      ))}
    </FtMetricGrid>
  )
}

export function FtSection({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="ft-ui-section">
      {title ? <h3 className="pw-panel-title">{title}</h3> : null}
      {hint ? <p className="muted ft-ui-section-hint">{hint}</p> : null}
      {children}
    </section>
  )
}

export function FtRowList({ children }: { children: ReactNode }) {
  return <ul className="ft-ui-list">{children}</ul>
}

export function FtRowItem({ children }: { children: ReactNode }) {
  return <li className="ft-ui-list-item">{children}</li>
}
