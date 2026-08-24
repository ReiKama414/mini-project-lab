import { NavLink } from 'react-router-dom'
import { projects, tiers, type Tier } from '../projects/registry'

const tierColor: Record<Tier, string> = {
  quick: '#2a9d8f',
  feature: '#e9a319',
  product: '#f0734a',
  portfolio: '#d6406a',
}

export function Sidebar({
  open,
  onNavigate,
  query,
}: {
  open: boolean
  onNavigate?: () => void
  query: string
}) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)),
      )
    : projects

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <NavLink
        to="/"
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        onClick={onNavigate}
      >
        <span className="dot" style={{ background: 'var(--accent)' }} />
        全部導覽
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {filtered.length}
        </span>
      </NavLink>

      {tiers.map((tier) => {
        const list = filtered.filter((p) => p.tier === tier.id)
        if (!list.length) return null
        return (
          <div key={tier.id} className="sidebar-section">
            <div className="sidebar-label">
              {tier.label}
              <span style={{ float: 'right', fontWeight: 600 }}>{list.length}</span>
            </div>
            {list.map((p) => (
              <NavLink
                key={p.slug}
                to={`/p/${p.slug}`}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={onNavigate}
                title={p.description}
              >
                <span className="dot" style={{ background: tierColor[p.tier] }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </span>
              </NavLink>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
