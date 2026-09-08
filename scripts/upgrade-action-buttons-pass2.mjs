/**
 * Second pass: convert remaining action <button> with simple/expression labels,
 * and migrate title= → data-tooltip on buttons.
 */
import fs from 'node:fs'
import path from 'node:path'

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
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
  if (/ActionButton/.test(src) && /from ['"].*ActionButton['"]/.test(src)) return src
  const from = relImport(file)
  const line = `import { ActionButton } from '${from}'`
  const lines = src.split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) last = i
  if (last >= 0) {
    // don't insert inside multi-line import
    while (last >= 0 && lines[last].includes('{') && !lines[last].includes('}')) {
      // find end of block
      let j = last
      while (j < lines.length && !lines[j].includes('}')) j++
      last = j
    }
    lines.splice(last + 1, 0, line)
    return lines.join('\n')
  }
  return `${line}\n${src}`
}

const VERB =
  '複製|已複製|清空|清除|刪除|儲存|存入|下載|匯出|匯入|上傳|新增|套用|產生|生成|計算|轉換|送出|發送|執行|搜尋|開始|暫停|繼續|重置|重設|取消|關閉|重新|刷新|更新中|抓匯率|交換|收藏|確定清除'

let n = 0
for (const file of [...walk('src/projects'), ...walk('src/pages'), ...walk('src/components')]) {
  let src = fs.readFileSync(file, 'utf8')
  const orig = src
  let used = false

  // title="..." on button/link.btn → data-tooltip (avoid native tooltip)
  src = src.replace(
    /(<(?:button|a)\b[^>]*\b(?:className)=(?:"[^"]*\bbtn\b[^"]*"|\{`[^`]*\bbtn\b[^`]*`\}))([^>]*?)\stitle=\{?["']([^"']+)["']\}?/g,
    (full, start, mid, tip) => {
      if (/data-tooltip=/.test(full)) return full
      return `${start}${mid} data-tooltip="${tip}"`
    },
  )
  src = src.replace(
    /(<(?:button|a)\b[^>]*?)\stitle=\{?["']([^"']+)["']\}?([^>]*\b(?:className)=(?:"[^"]*\bbtn\b[^"]*"|\{`[^`]*\bbtn\b[^`]*`\}))/g,
    (full, start, tip, rest) => {
      if (/data-tooltip=/.test(full)) return full
      return `${start} data-tooltip="${tip}"${rest}`
    },
  )

  // Multiline: <button ...>\n  LABEL\n</button>
  const multi = new RegExp(
    `<button(\\s[^>]*className=(?:"[^"]*btn[^"]*"|\\{\`[^\`]*btn[^\`]*\`\}|\\{[^}]*btn[^}]*\\})[^>]*)>\\s*((?:${VERB})[^<]{0,16})\\s*<\\/button>`,
    'g',
  )
  src = src.replace(multi, (full, attrs, label) => {
    if (/ActionButton|AddButton|DeleteButton|EditButton|btn-del|btn-edit|btn-add/.test(full)) return full
    if (/<[A-Z]|<svg|Icon[A-Z]/.test(full)) return full
    used = true
    const rest = attrs.replace(/\s*type="button"/g, '')
    return `<ActionButton${rest}>${label.trim()}</ActionButton>`
  })

  // Expression children: {copied ? '已複製' : '複製結果'}
  src = src.replace(
    /<button(\s[^>]*className=(?:"[^"]*btn[^"]*"|\{`[^`]*btn[^`]*`\}|\{[^}]*btn[^}]*\})[^>]*)>\s*\{([^}]*(?:複製|清空|清除|儲存|存入|下載|匯出|重新|取消|更新中)[^}]*)\}\s*<\/button>/g,
    (full, attrs, expr) => {
      if (/ActionButton|AddButton|DeleteButton|EditButton/.test(full)) return full
      if (/<[A-Z]|Icon[A-Z]/.test(full)) return full
      used = true
      const rest = attrs.replace(/\s*type="button"/g, '')
      // pick icon hint from expression text
      let icon = ''
      if (/複製/.test(expr)) icon = ' icon="copy"'
      else if (/清空|清除|刪除/.test(expr)) icon = ' icon="trash"'
      else if (/重新|更新/.test(expr)) icon = ' icon="reset"'
      else if (/儲存|存入/.test(expr)) icon = ' icon="save"'
      else if (/下載|匯出/.test(expr)) icon = ' icon="download"'
      else if (/取消/.test(expr)) icon = ' icon="close"'
      return `<ActionButton${rest}${icon}>{${expr}}</ActionButton>`
    },
  )

  if (src === orig) continue
  if (used) src = ensureImport(src, file)
  // tidy broken ActionButton whitespace
  src = src.replace(/>(\s*)(複製|清除|清空|存入|儲存|取消|下載|匯出|套用|重新)([^<]*)\s*\n\s*<\/ActionButton>/g, '>$2$3</ActionButton>')
  fs.writeFileSync(file, src)
  n++
  console.log('updated', file)
}
console.log('Updated', n)
