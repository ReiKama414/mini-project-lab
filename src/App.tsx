import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ShortRedirect } from './pages/ShortRedirect'
import { getProject } from './projects/registry'

/**
 * Vite glob: every projects/<slug>/index.tsx is a lazy route chunk.
 * Add a project = registry entry + folder; no manual import list needed.
 */
const modules = import.meta.glob('./projects/*/index.tsx')

const loaders: Record<string, React.LazyExoticComponent<React.ComponentType>> = {}
for (const path of Object.keys(modules)) {
  const slug = path.split('/')[2]
  if (!slug) continue
  loaders[slug] = lazy(modules[path] as () => Promise<{ default: React.ComponentType }>)
}

function ProjectRoute() {
  const { slug = '' } = useParams()
  const meta = getProject(slug)
  const Comp = loaders[slug]

  if (!meta || !Comp) {
    return (
      <div className="panel stack">
        <h2>找不到專案</h2>
        <p className="muted">slug「{slug}」尚未實作或不存在。</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="panel">
          <p className="muted">載入 {meta.title}…</p>
        </div>
      }
    >
      <Comp />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="s/:code" element={<ShortRedirect />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="p/:slug" element={<ProjectRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
