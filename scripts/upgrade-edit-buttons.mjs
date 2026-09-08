/**
 * Convert buttons whose only text child is 「編輯」 into <EditButton />.
 * Avoids [^>] attr matching (breaks on => arrows).
 */
import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function relImport(file) {
  let rel = path.relative(path.dirname(file), path.resolve('src/components/EditButton.tsx')).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel.replace(/\.tsx?$/, '')
}

function ensureImport(src, file) {
  if (/from ['"].*EditButton['"]/.test(src)) return src
  const from = relImport(file)
  const line = `import { EditButton } from '${from}'`
  const lines = src.split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) {
    if (!/^import\s/.test(lines[i])) continue
    last = i
    if (lines[i].includes('{') && !lines[i].includes('}')) {
      while (last < lines.length && !lines[last].includes('}')) last++
    }
  }
  if (last >= 0) {
    lines.splice(last + 1, 0, line)
    return lines.join('\n')
  }
  return `${line}\n${src}`
}

function convert(src) {
  // Find <button ...> 編輯 </button> with possible multiline attrs
  const re = /<button\b([\s\S]*?)>\s*編輯\s*<\/button>/g
  return src.replace(re, (full, attrs) => {
    if (!/\bbtn\b/.test(attrs)) return full
    if (/EditButton|btn-edit/.test(full)) return full
    // keep onClick / disabled / etc., drop type & className
    let rest = attrs
      .replace(/\s*type="button"/g, '')
      .replace(/\s*className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, '')
    return `<EditButton${rest} />`
  })
}

let n = 0
for (const file of walk('src/projects')) {
  const orig = fs.readFileSync(file, 'utf8')
  let src = convert(orig)
  if (src === orig) continue
  src = ensureImport(src, file)
  fs.writeFileSync(file, src)
  n++
  console.log('updated', file)
}
console.log('Updated', n)
