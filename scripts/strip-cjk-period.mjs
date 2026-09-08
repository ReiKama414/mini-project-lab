/**
 * Strip CJK full stop 「。」 from UI strings under src/.
 * Does not touch ASCII "." (decimals, domains, etc.).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const SKIP = new Set(['node_modules', 'dist'])

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|md|css)$/.test(name)) out.push(p)
  }
  return out
}

let files = 0
let hits = 0
for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('。')) continue
  const next = raw.replaceAll('。', '')
  if (next === raw) continue
  const n = (raw.match(/。/g) || []).length
  fs.writeFileSync(file, next)
  files++
  hits += n
  console.log(`- ${path.relative(process.cwd(), file)} (${n})`)
}
console.log(`Done: removed ${hits} 「。」 in ${files} files`)
