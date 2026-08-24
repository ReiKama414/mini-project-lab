import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { projects } from '../projects/registry'
import { IconMenu, IconSearch } from './icons'

export function Layout() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const location = useLocation()
  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects.length
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q)),
    ).length
  }, [query])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="menu-btn" aria-label="選單" onClick={() => setOpen((v) => !v)}>
          <IconMenu size={18} strokeWidth={2.25} />
        </button>
        <Link to="/" className="brand" aria-label="Mini Project Lab">
          <img src="/favicon.svg" alt="" className="brand-mark" width={28} height={28} draggable={false} />
          <span className="brand-text">Mini Project Lab</span>
        </Link>
        <div className="topbar-search">
          <IconSearch className="search-icon" size={16} strokeWidth={2.25} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜尋名稱、標籤…（${matchCount}）`}
            aria-label="搜尋專案"
          />
        </div>
      </header>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <Sidebar open={open} query={query} onNavigate={() => setOpen(false)} />

      <main className="main" key={location.pathname}>
        <Outlet context={{ query }} />
      </main>
    </div>
  )
}
