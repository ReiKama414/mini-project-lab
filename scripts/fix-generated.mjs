/**
 * Reliable fixes for generated image/pdf projects
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'src', 'projects')

const slugs = fs.readdirSync(dir).filter((s) => {
  const p = path.join(dir, s, 'index.tsx')
  if (!fs.existsSync(p)) return false
  const t = fs.readFileSync(p, 'utf8')
  return t.includes("getProject('") && (t.includes('imageCanvas') || t.includes('pdf-lib') || t.includes('pdfjs-dist') || t.includes('exifr') || t.includes('JSZip'))
})

const controlLabels = {
  'image-brightness': '亮度',
  'image-contrast': '對比',
  'image-saturation': '飽和度',
}

function cleanImportBlock(src, fromMod) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${fromMod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*;?`)
  const m = src.match(re)
  if (!m) return src
  const rest = src.slice(0, m.index) + src.slice(m.index + m[0].length)
  const items = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const kept = items.filter((item) => {
    const isType = item.startsWith('type ')
    const name = item.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim()
    if (isType) return new RegExp(`\\b${name}\\b`).test(rest)
    // count occurrences in rest
    const matches = rest.match(new RegExp(`\\b${name}\\b`, 'g'))
    return !!(matches && matches.length)
  })
  if (!kept.length) return rest.replace(/^\n/, '')
  return src.slice(0, m.index) + `import { ${kept.join(', ')} } from '${fromMod}'\n` + src.slice(m.index + m[0].length)
}

for (const slug of slugs) {
  // only touch our new tools — skip if registry already had them? All new ones have fallback meta
  const file = path.join(dir, slug, 'index.tsx')
  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('const fallback: ProjectMeta')) continue

  if (controlLabels[slug]) {
    src = src.replace('{controlLabel}', controlLabels[slug])
  }

  // Blob([await x.save()]) -> Blob([Uint8Array.from(await x.save())])
  src = src.replace(/new Blob\(\[await ([^\]]+)\]/g, 'new Blob([Uint8Array.from(await $1)]')
  src = src.replace(/new Blob\(\[bytes\]/g, 'new Blob([Uint8Array.from(bytes)]')
  src = src.replace(/new Blob\(\[new Uint8Array\(await /g, 'new Blob([Uint8Array.from(await ') // avoid double wrap if partially fixed

  // pdf render canvas prop
  src = src.replace(
    /page\.render\(\{\s*canvasContext:\s*([^,]+),\s*viewport(?:,\s*canvas)?\s*\}\)/g,
    'page.render({ canvasContext: $1, viewport })',
  )
  src = src.replace(
    /p\.render\(\{\s*canvasContext:\s*([^,]+),\s*viewport(?:,\s*canvas)?\s*\}\)/g,
    'p.render({ canvasContext: $1, viewport })',
  )

  // pdf-encrypt: remove unused ts-expect-error and simplify save
  if (slug === 'pdf-encrypt') {
    src = src.replace(/\s*\/\/ @ts-expect-error pdf-lib encrypt option\n/g, '\n')
  }

  // pdf-metadata keywords join
  if (slug === 'pdf-metadata') {
    src = src.replace(
      "setKeywords(limitText((doc.getKeywords() ?? []).join(', '), F_MAX))",
      "setKeywords(limitText(Array.isArray(doc.getKeywords()) ? (doc.getKeywords() as string[]).join(', ') : String(doc.getKeywords() ?? ''), F_MAX))",
    )
  }

  src = cleanImportBlock(src, '../../lib/utils')
  src = cleanImportBlock(src, '../../lib/imageCanvas')
  src = cleanImportBlock(src, 'react')

  // tidy blank lines at top after import removals
  src = src.replace(/\n{3,}/g, '\n\n')

  fs.writeFileSync(file, src)
  console.log('fixed', slug)
}

console.log('count', slugs.filter((s) => fs.readFileSync(path.join(dir, s, 'index.tsx'), 'utf8').includes('const fallback: ProjectMeta')).length)
