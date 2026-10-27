import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { projects, tiers, type Tier } from '../projects/registry'
import { IconGrid, IconSidebarClose } from './icons'

const tierColor: Record<Tier, string> = {
  quick: '#2a9d8f',
  feature: '#e9a319',
  product: '#f0734a',
  portfolio: '#d6406a',
}

export function Sidebar({
  open,
  collapsed,
  onNavigate,
  onToggleCollapse,
  query,
}: {
  open: boolean
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
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

  const location = useLocation()
  const asideRef = useRef<HTMLElement>(null)
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    const aside = asideRef.current
    if (!aside || (collapsed && !open)) return

    const isReload = prevPath.current === null
    const pathChanged = prevPath.current !== location.pathname
    prevPath.current = location.pathname

    requestAnimationFrame(() => {
      // 重整或直接開連結：側欄從頂部開始，避免整條清單被捲到最底
      if (isReload) {
        aside.scrollTop = 0
        return
      }

      if (!pathChanged) return

      const active = aside.querySelector<HTMLElement>('.nav-link.active')
      if (!active) return

      const top = aside.scrollTop
      const viewH = aside.clientHeight
      const linkTop = active.offsetTop
      const linkH = active.offsetHeight
      const pad = 12
      const above = linkTop < top + pad
      const below = linkTop + linkH > top + viewH - pad
      if (!above && !below) return

      const target = linkTop - viewH / 2 + linkH / 2
      aside.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    })
  }, [location.pathname, collapsed, open])

  return (
    <aside
      ref={asideRef}
      className={`sidebar${open ? ' open' : ''}${collapsed ? ' is-collapsed' : ''}`}
      aria-hidden={collapsed && !open ? true : undefined}
    >
      <div className="sidebar-head">
        <span className="sidebar-head-label">導覽</span>
        <button
          type="button"
          className="sidebar-collapse-btn"
          aria-label="收合左側導覽"
          data-tooltip="收合導覽"
          onClick={onToggleCollapse}
        >
          <IconSidebarClose size={16} strokeWidth={2.25} />
        </button>
      </div>

      <NavLink
        to="/"
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        onClick={onNavigate}
      >
        <IconGrid size={15} strokeWidth={2.25} />
        <span className="nav-link-text">全部導覽</span>
        <span className="muted nav-link-count" style={{ marginLeft: 'auto', fontSize: 12 }}>
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
                title={p.title}
              >
                <span className="dot" style={{ background: tierColor[p.tier] }} />
                <span className="nav-link-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
