import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reg = fs.readFileSync(path.join(root, 'src/projects/registry.ts'), 'utf8')
const slugs = [...reg.matchAll(/slug: '([^']+)'/g)].map((m) => m[1])

const base = process.env.SITE_URL?.replace(/\/$/, '') || 'https://mini-project-lab-wheat.vercel.app'
const today = new Date().toISOString().slice(0, 10)

const urls = [
  { loc: `${base}/`, priority: '1.0' },
  ...slugs.map((s) => ({ loc: `${base}/p/${s}`, priority: '0.6' })),
]

const body = urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`

fs.writeFileSync(path.join(root, 'public/sitemap.xml'), xml)
console.log('sitemap.xml', urls.length, 'urls (base=', base, ')')
