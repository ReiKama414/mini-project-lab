/**
 * Convert remaining action text buttons that contain => in onClick (broke [^>] regex).
 */
import fs from 'node:fs'
import path from 'node:path'

const VERBS =
  '複製|已複製|清空|清除|刪除|儲存|存入|下載|匯出|匯入|上傳|新增|套用|產生|生成|計算|轉換|送出|發送|執行|搜尋|開始|暫停|繼續|重置|重設|取消|關閉|重新抓|重新|刷新|更新中|抓匯率|交換|收藏|確定清除|產生密鑰|產生 UUID|產生亂數'

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
  let rel = path.relative(path.dirname(file), path.resolve('src/components/ActionButton.tsx')).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel.replace(/\.tsx?$/, '')
}

function ensureImport(src, file) {
  if (/from ['"].*ActionButton['"]/.test(src)) return src
  const from = relImport(file)
  const line = `import { ActionButton } from '${from}'`
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

const childRe = new RegExp(`^\\s*(?:${VERBS})[^\\n<]{0,20}\\s*$`)

function convert(src) {
  const re = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g
  return src.replace(re, (full, attrs, body) => {
    if (!/\bbtn\b/.test(attrs)) return full
    if (/ActionButton|AddButton|DeleteButton|EditButton|btn-del|btn-edit|btn-add|btn-icon/.test(full)) return full
    if (/<[A-Za-z]|\{/.test(body) && !childRe.test(body)) {
      // allow simple expression? skip if has JSX/expr
      if (/[<{]/.test(body.trim())) return full
    }
    const text = body.replace(/\s+/g, ' ').trim()
    if (!new RegExp(`^(?:${VERBS})`).test(text)) return full
    // skip short chip-like if matches currency codes only
    if (/^[A-Z]{3}$/.test(text)) return full
    if (/^\d/.test(text)) return full
    const rest = attrs.replace(/\s*type="button"/g, '')
    return `<ActionButton${rest}>${text}</ActionButton>`
  })
}

let n = 0
for (const file of [...walk('src/projects'), ...walk('src/pages')]) {
  const orig = fs.readFileSync(file, 'utf8')
  let src = convert(orig)
  if (src === orig) continue
  src = ensureImport(src, file)
  fs.writeFileSync(file, src)
  n++
  console.log('updated', file)
}
console.log('Updated', n)
