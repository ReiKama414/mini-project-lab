import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

let fixed = 0
for (const file of walk('src')) {
  let src = fs.readFileSync(file, 'utf8')
  const orig = src

  src = src.replace(
    /import\s*\{\s*\r?\nimport\s*\{\s*(ActionButton|EditButton)\s*\}\s*from\s*('[^']+'|"[^"]+");?\s*\r?\n/g,
    (_m, name, from) => `import { ${name} } from ${from}\nimport {\n`,
  )

  // duplicate consecutive ActionButton imports
  src = src.replace(
    /(import\s*\{\s*ActionButton\s*\}\s*from\s*'[^']+'\s*\r?\n)\s*import\s*\{\s*ActionButton\s*\}\s*from\s*'[^']+'\s*\r?\n/g,
    '$1',
  )

  if (src !== orig) {
    fs.writeFileSync(file, src)
    fixed++
    console.log('fixed', file)
  }
}
console.log('fixed files', fixed)
