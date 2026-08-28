import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { projects } from '../projects/registry'
import { useLocalStorage } from '../lib/storage'
import { IconGithub, IconMenu, IconSearch, IconSidebarClose, IconSidebarOpen } from './icons'

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useLocalStorage('lab:sidebar-collapsed', false)
  const [query, setQuery] = useState('')
  const location = useLocation()
  const year = new Date().getFullYear()
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

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="menu-btn"
          aria-label="開啟選單"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <IconMenu size={18} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={collapsed ? '展開左側導覽' : '收合左側導覽'}
          aria-pressed={collapsed}
          title={collapsed ? '展開導覽' : '收合導覽'}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <IconSidebarOpen size={18} strokeWidth={2.25} />
          ) : (
            <IconSidebarClose size={18} strokeWidth={2.25} />
          )}
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

      {mobileOpen && <div className="overlay" onClick={() => setMobileOpen(false)} />}

      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        query={query}
        onNavigate={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      <div className="content-col">
        <main className="main" key={location.pathname}>
          <Outlet context={{ query }} />
        </main>
        <footer className="site-footer">
          <p>
            © {year}{' '}
            <a href="https://github.com/ReiKama414" target="_blank" rel="noreferrer">
              ReiKama414
            </a>
            {' · '}
            Mini Project Lab ·{' '}
            <a
              href="https://github.com/ReiKama414/mini-project-lab/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              MIT License
            </a>
          </p>
          <a
            className="site-footer-github"
            href="https://github.com/ReiKama414/mini-project-lab"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub：mini-project-lab"
          >
            <IconGithub size={16} strokeWidth={2.25} />
            <span>GitHub</span>
          </a>
        </footer>
      </div>
    </div>
  )
}
