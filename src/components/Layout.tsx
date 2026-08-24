import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { projects } from '../projects/registry'

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
        <button className="menu-btn" aria-label="選單" onClick={() => setOpen((v) => !v)}>
          ☰
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark">M</span>
          Mini Project Lab
        </Link>
        <div className="topbar-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜尋名稱、標籤…（${matchCount}）`}
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
