/**
 * Batch-upgrade action / edit buttons across src/projects (+ pages).
 * - Text-only action buttons → ActionButton (leading icon + data-tooltip)
 * - 「編輯」text buttons → EditButton
 * Skips obvious chip toggles (short codes / pure numbers) by only matching action verbs.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['src/projects', 'src/pages']

const ACTION_RE =
  '(?:重新[^<]{0,12}|更新中…?|抓匯率|複製[^<]{0,8}|已複製|清空[^<]{0,8}|清除[^<]{0,8}|刪除[^<]{0,8}|儲存[^<]{0,10}|存入[^<]{0,10}|下載[^<]{0,10}|匯出[^<]{0,10}|匯入[^<]{0,8}|上傳[^<]{0,8}|新增[^<]{0,8}|套用|產生[^<]{0,10}|生成[^<]{0,10}|計算[^<]{0,8}|轉換[^<]{0,8}|送出|發送|執行|搜尋|搜索|開始|暫停|繼續|重置|重設|取消|關閉|交換)'

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

function ensureImport(src, what, from) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
  const m = src.match(re)
  if (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    if (names.some((n) => n === what || n.startsWith(what + ' '))) return src
    const next = names.concat(what).sort().join(', ')
    return src.replace(re, `import { ${next} } from '${from}'`)
  }
  // insert after last import
  const lines = src.split('\n')
  let last = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) last = i
  }
  const line = `import { ${what} } from '${from}'`
  if (last >= 0) {
    lines.splice(last + 1, 0, line)
    return lines.join('\n')
  }
  return `${line}\n${src}`
}

function relImport(file, targetAbs) {
  let rel = path.relative(path.dirname(file), targetAbs).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel.replace(/\.tsx?$/, '')
}

function upgradeFile(file) {
  let src = fs.readFileSync(file, 'utf8')
  const orig = src
  let usedAction = false
  let usedEdit = false

  // Replace edit text buttons: >編輯</button> with class btn
  src = src.replace(
    /<button(\s[^>]*className=\{?`[^`]*btn[^`]*`\}?[^>]*|\s[^>]*className="[^"]*btn[^"]*"[^>]*)>\s*編輯\s*<\/button>/g,
    (full, attrs) => {
      // skip if already has only icon / EditButton
      if (/btn-edit|EditButton|aria-label/.test(full) && !/>\s*編輯\s*</.test(full)) return full
      usedEdit = true
      // keep onClick and disabled etc., drop className tones into EditButton
      const onClick = attrs.match(/onClick=\{[^}]+\}/)?.[0] || attrs.match(/onClick=\{[\s\S]*?\}(?=\s|\/)/)?.[0]
      // simpler: strip type/className, keep rest
      let rest = attrs
        .replace(/\s*type="button"/g, '')
        .replace(/\s*className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, '')
      return `<EditButton${rest} />`
    },
  )

  // Self-closing already handled. Also: children 編輯 with multiline
  src = src.replace(
    /<button(\s[^>]*)>\s*編輯\s*<\/button>/g,
    (full, attrs) => {
      if (!/className=/.test(attrs) || !/btn/.test(attrs)) return full
      if (/btn-edit|DeleteButton|EditButton/.test(full)) return full
      usedEdit = true
      let rest = attrs
        .replace(/\s*type="button"/g, '')
        .replace(/\s*className=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, '')
      return `<EditButton${rest} />`
    },
  )

  // Action buttons: opening tag with btn class, simple text child matching verbs
  const actionBtnRe = new RegExp(
    `<button(\\s[^>]*className=(?:"[^"]*btn[^"]*"|\\{\`[^\`]*btn[^\`]*\`\}|\\{[^}]*btn[^}]*\\})[^>]*)>\\s*(${ACTION_RE})\\s*<\\/button>`,
    'g',
  )

  src = src.replace(actionBtnRe, (full, attrs, label) => {
    if (/ActionButton|AddButton|DeleteButton|EditButton|btn-del|btn-edit|btn-add|btn-icon/.test(full)) return full
    // skip if children already include SVG / Icon
    if (/<[A-Z]|<svg|Icon[A-Z]/.test(full)) return full
    usedAction = true
    // convert className: keep as-is on ActionButton
    let rest = attrs.replace(/\s*type="button"/g, '')
    // Ensure className stays
    return `<ActionButton${rest}>${label}</ActionButton>`
  })

  if (src === orig) return false

  const actionFrom = relImport(file, path.resolve('src/components/ActionButton.tsx'))
  const editFrom = relImport(file, path.resolve('src/components/EditButton.tsx'))
  if (usedAction) src = ensureImport(src, 'ActionButton', actionFrom)
  if (usedEdit) src = ensureImport(src, 'EditButton', editFrom)

  fs.writeFileSync(file, src)
  return true
}

let n = 0
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (upgradeFile(file)) {
      n++
      console.log('updated', file)
    }
  }
}
console.log(`Updated ${n} files`)
