import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getProject } from '../projects/registry'

const SITE = 'Mini Project Lab'
const DEFAULT_DESC = '瀏覽器本機小工具集合：圖片、PDF、開發與隱私工具，檔案不上傳伺服器。'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const match = pathname.match(/^\/p\/([^/]+)/)
    const slug = match?.[1]
    const project = slug ? getProject(slug) : undefined
    const title = project ? `${project.title} — ${SITE}` : `${SITE} — 實用小專案集合`
    const description = project?.description || DEFAULT_DESC
    const url = `${window.location.origin}${pathname === '/' ? '/' : pathname}`

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', 'index,follow')
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', SITE)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertLink('canonical', url)
  }, [pathname])

  return null
}
