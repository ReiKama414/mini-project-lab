import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { tiers, type ProjectMeta } from '../projects/registry'
import { IconArrowLeft } from './icons'

export function ProjectShell({
  meta,
  children,
  actions,
}: {
  meta: ProjectMeta
  children: ReactNode
  actions?: ReactNode
}) {
  const tier = tiers.find((t) => t.id === meta.tier)

  return (
    <div className="project-shell">
      <div className="project-shell-header">
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            <Link to="/" className="btn ghost sm btn-back">
              <IconArrowLeft size={16} strokeWidth={2.25} />
              導覽
            </Link>
            {tier && <span className={`badge ${meta.tier}`}>{tier.label}</span>}
          </div>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        {actions ? <div className="project-shell-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
