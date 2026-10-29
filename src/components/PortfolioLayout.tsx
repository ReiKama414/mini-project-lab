import type { ReactNode } from 'react'
import { getProject } from '../projects/registry'
import { getPortfolioGuide, type PortfolioSlug } from '../lib/portfolioGuide'
import { FeatureLayout, type FeatureInfoItem } from './FeatureLayout'
import { FtMetric, FtMetricGrid, FtToolHero, FtToolRoot } from './FeatureToolUI'

type FaqBlock = { title: string; body: ReactNode }

type Metric = { label: string; value: ReactNode; mono?: boolean }

const SLUG_EMOJI: Record<PortfolioSlug, string> = {
  'screenshot-html': '🖼️',
  'uptime-monitor': '🛰️',
  'api-monitor': '📡',
  'api-docs-gen': '📄',
  'db-schema-viz': '🗄️',
  'sql-playground': '🧮',
  'readme-generator': '📝',
  'dependency-dashboard': '📦',
  'log-viewer': '📋',
  'feature-flags': '🚩',
  whiteboard: '✏️',
  'tic-tac-toe': '⭕',
  'code-editor': '💻',
}

type Props = {
  slug: PortfolioSlug
  actions?: ReactNode
  toolbar?: ReactNode
  aside?: ReactNode
  heroTitle?: string
  heroSubtitle?: string
  heroBadge?: ReactNode
  metrics?: Metric[]
  extraInfo?: FeatureInfoItem[]
  extraFaq?: FaqBlock[]
  footerHint?: string
  children: ReactNode
}

export function PortfolioLayout({
  slug,
  actions,
  toolbar,
  aside,
  heroTitle,
  heroSubtitle,
  heroBadge,
  metrics,
  extraInfo,
  extraFaq,
  footerHint,
  children,
}: Props) {
  const meta = getProject(slug)!
  const guide = getPortfolioGuide(slug)
  const infoItems = [...guide.info, ...(extraInfo ?? [])]
  const faq = [...(extraFaq ?? []), ...guide.faq]

  return (
    <FeatureLayout
      meta={meta}
      actions={actions}
      toolbar={toolbar}
      aside={aside}
      infoItems={infoItems}
      faq={faq}
      labFaq={false}
      footerHint={footerHint}
      variant="unified"
    >
      <FtToolRoot className="pd-demo">
        <FtToolHero
          emoji={SLUG_EMOJI[slug]}
          title={heroTitle ?? meta.title}
          subtitle={heroSubtitle ?? meta.description}
          badge={heroBadge}
        />
        {metrics && metrics.length > 0 && (
          <FtMetricGrid>
            {metrics.map((m) => (
              <FtMetric key={m.label} label={m.label} value={m.value} mono={m.mono} />
            ))}
          </FtMetricGrid>
        )}
        {children}
      </FtToolRoot>
    </FeatureLayout>
  )
}
