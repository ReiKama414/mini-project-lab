import fs from 'fs'
import path from 'path'

const root = 'src/projects'
const nbsp = '\u00a0'

function patch(rel, fn) {
  const p = path.join(root, rel)
  const s0 = fs.readFileSync(p, 'utf8')
  const s1 = fn(s0)
  fs.writeFileSync(p, s1)
  console.log(s0 === s1 ? `NO CHANGE ${rel}` : `patched ${rel}`)
}

// invoice-generator
patch('invoice-generator/index.tsx', (s) => {
  s = s.replace(
    "import { downloadText, copyText, uid } from '../../lib/utils'",
    "import { downloadText, copyText, uid, charCount, clamp, isNonEmpty, limitText, parseNumber } from '../../lib/utils'",
  )
  if (!s.includes('MAX_LINES')) {
    s = s.replace(
      'export default function Page() {',
      `const MAX_LINES = 50
const MAX_TEXT = 80
const MAX_NOTE = 500
const MAX_DESC = 120
const MAX_QTY = 100000
const MAX_PRICE = 1_000_000_000

export default function Page() {`,
    )
  }
  s = s.replace(
    `  const total = subtotal + tax

  function bodyTxt() {`,
    `  const total = subtotal + tax
  const invOk = isNonEmpty(invNo)
  const fromOk = isNonEmpty(from)
  const clientOk = isNonEmpty(client)
  const taxOk = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 40
  const linesOk = lines.length > 0 && lines.every((l) => isNonEmpty(l.desc) && l.qty >= 0 && l.price >= 0)
  const canExport = invOk && fromOk && clientOk && taxOk && linesOk

  function bodyTxt() {`,
  )
  s = s.replace(
    `<button type="button" className="btn ghost sm" onClick={() => void copyText(bodyTxt())}>
            複製
          </button>
          <button type="button" className="btn ghost sm" onClick={() => downloadText(\`\${invNo}.txt\`, bodyTxt())}>
            下載 TXT
          </button>
          <button type="button" className="btn accent sm" onClick={() => downloadText(\`\${invNo}.md\`, bodyMd(), 'text/markdown;charset=utf-8')}>
            下載 MD
          </button>`,
    `<button type="button" className="btn ghost sm" disabled={!canExport} onClick={() => void copyText(bodyTxt())}>
            複製
          </button>
          <button type="button" className="btn ghost sm" disabled={!canExport} onClick={() => downloadText(\`\${invNo}.txt\`, bodyTxt())}>
            下載 TXT
          </button>
          <button type="button" className="btn accent sm" disabled={!canExport} onClick={() => downloadText(\`\${invNo}.md\`, bodyMd(), 'text/markdown;charset=utf-8')}>
            下載 MD
          </button>`,
  )
  s = s.replace(
    `<label className="label">發票編號</label>
          <input className="field" value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          <label className="label">開立者</label>
          <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="label">客戶</label>
          <input className="field" value={client} onChange={(e) => setClient(e.target.value)} />`,
    `<label className="label">發票編號</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${!invOk ? ' is-invalid' : ''}\`} value={invNo} maxLength={MAX_TEXT} onChange={(e) => setInvNo(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span className={!invOk ? 'warn' : undefined}>{!invOk ? '必填' : '${nbsp}'}</span><span>{charCount(invNo)} / {MAX_TEXT}</span></div>
          </div>
          <label className="label">開立者</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${!fromOk ? ' is-invalid' : ''}\`} value={from} maxLength={MAX_TEXT} onChange={(e) => setFrom(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span /><span>{charCount(from)} / {MAX_TEXT}</span></div>
          </div>
          <label className="label">客戶</label>
          <div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${!clientOk ? ' is-invalid' : ''}\`} value={client} maxLength={MAX_TEXT} onChange={(e) => setClient(limitText(e.target.value, MAX_TEXT))} />
            <div className="field-meta"><span /><span>{charCount(client)} / {MAX_TEXT}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input className="field" type="number" min={0} max={40} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} />`,
    `<input className={\`field\${!taxOk ? ' is-invalid' : ''}\`} type="number" min={0} max={40} value={taxRate} onChange={(e) => { const n = parseNumber(e.target.value); setTaxRate(n == null ? 0 : clamp(n, 0, 40)) }} />`,
  )
  s = s.replace(
    `<textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setLines((xs) => [...xs, { id: uid('l'), desc: '新項目', qty: 1, price: 1000 }])}
          >
            加一行
          </button>`,
    `<div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={2} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(limitText(e.target.value, MAX_NOTE))} />
            <div className="field-meta"><span /><span>{charCount(note)} / {MAX_NOTE}</span></div>
          </div>
          <button
            type="button"
            className="btn ghost"
            disabled={lines.length >= MAX_LINES}
            onClick={() => setLines((xs) => xs.length >= MAX_LINES ? xs : [...xs, { id: uid('l'), desc: '新項目', qty: 1, price: 1000 }])}
          >
            加一行
          </button>
          {lines.length >= MAX_LINES && <p className="field-error">已達上限 {MAX_LINES} 行</p>}`,
  )
  s = s.replace(
    `onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, desc: e.target.value } : x)))}`,
    `maxLength={MAX_DESC} onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, desc: limitText(e.target.value, MAX_DESC) } : x)))}`,
  )
  s = s.replace(
    `onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, qty: Number(e.target.value) || 0 } : x)))}`,
    `min={0} max={MAX_QTY} onChange={(e) => { const n = parseNumber(e.target.value); setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, qty: n == null ? 0 : clamp(n, 0, MAX_QTY) } : x))) }}`,
  )
  s = s.replace(
    `onChange={(e) => setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, price: Number(e.target.value) || 0 } : x)))}`,
    `min={0} max={MAX_PRICE} onChange={(e) => { const n = parseNumber(e.target.value); setLines((xs) => xs.map((x) => (x.id === l.id ? { ...x, price: n == null ? 0 : clamp(n, 0, MAX_PRICE) } : x))) }}`,
  )
  return s
})

// personal-dashboard
patch('personal-dashboard/index.tsx', (s) => {
  s = s.replace(
    "import { pick, randomInt, uid } from '../../lib/utils'",
    "import { pick, randomInt, uid, charCount, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'",
  )
  if (!s.includes('MAX_TODOS')) {
    s = s.replace(
      'const CONDITIONS = ',
      `const MAX_TODOS = 100
const MAX_LINKS = 30
const MAX_TODO = 80
const MAX_FOCUS = 80
const MAX_NOTE = 2000
const MAX_CITY = 40
const MAX_LABEL = 40
const MAX_URL = 2048

const CONDITIONS = `,
    )
  }
  s = s.replace(
    `  function addTodo() {
    if (!draft.trim()) return
    setTodos((t) => [...t, { id: uid('t'), text: draft.trim(), done: false }])
    setDraft('')
  }`,
    `  const draftOk = isNonEmpty(draft)
  const todosAtLimit = todos.length >= MAX_TODOS
  const canAddTodo = draftOk && !todosAtLimit
  const linkLabelOk = isNonEmpty(linkLabel)
  const linkUrlOk = isValidHttpUrl(linkUrl)
  const linksAtLimit = links.length >= MAX_LINKS
  const canAddLink = linkLabelOk && linkUrlOk && !linksAtLimit

  function addTodo() {
    if (!canAddTodo) return
    setTodos((t) => [...t, { id: uid('t'), text: limitText(draft.trim(), MAX_TODO), done: false }])
    setDraft('')
  }`,
  )
  s = s.replace(
    `<input className="field" value={weather.city} onChange={(e) => setWeather((w) => ({ ...w, city: e.target.value }))} />`,
    `<div className="stack" style={{ gap: 0 }}>
            <input className="field" value={weather.city} maxLength={MAX_CITY} onChange={(e) => setWeather((w) => ({ ...w, city: limitText(e.target.value, MAX_CITY) }))} />
            <div className="field-meta"><span /><span>{charCount(weather.city)} / {MAX_CITY}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input className="field" value={focus} onChange={(e) => setFocus(e.target.value)} />`,
    `<div className="stack" style={{ gap: 0 }}>
            <input className="field" value={focus} maxLength={MAX_FOCUS} onChange={(e) => setFocus(limitText(e.target.value, MAX_FOCUS))} />
            <div className="field-meta"><span /><span>{charCount(focus)} / {MAX_FOCUS}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input
              className="field"
              style={{ flex: 1 }}
              value={draft}
              placeholder="新增待辦"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <button type="button" className="btn accent" onClick={addTodo}>
              新增
            </button>`,
    `<div className="stack" style={{ flex: 1, gap: 0 }}>
              <input className={\`field\${draft.length > 0 && !draftOk ? ' is-invalid' : ''}\`} style={{ width: '100%' }} value={draft} maxLength={MAX_TODO} placeholder="新增待辦" onChange={(e) => setDraft(limitText(e.target.value, MAX_TODO))} onKeyDown={(e) => e.key === 'Enter' && addTodo()} />
              <div className="field-meta"><span className={todosAtLimit ? 'warn' : undefined}>{todosAtLimit ? \`待辦上限 \${MAX_TODOS}\` : '${nbsp}'}</span><span>{charCount(draft)} / {MAX_TODO}</span></div>
            </div>
            <button type="button" className="btn accent" onClick={addTodo} disabled={!canAddTodo}>
              新增
            </button>`,
  )
  s = s.replace(
    `value={editText}
                    onChange={(e) => setEditText(e.target.value)}`,
    `value={editText}
                    maxLength={MAX_TODO}
                    onChange={(e) => setEditText(limitText(e.target.value, MAX_TODO))}`,
  )
  s = s.replace(
    `<textarea className="field" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="隨手記…" />`,
    `<div className="stack" style={{ gap: 0 }}>
            <textarea className="field" rows={4} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(limitText(e.target.value, MAX_NOTE))} placeholder="隨手記…" />
            <div className="field-meta"><span /><span>{charCount(note)} / {MAX_NOTE}</span></div>
          </div>`,
  )
  s = s.replace(
    `<input className="field" placeholder="名稱" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <input className="field" style={{ flex: 1 }} placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (!linkLabel.trim() || !linkUrl.trim()) return
                setLinks((xs) => [...xs, { id: uid('l'), label: linkLabel.trim(), url: linkUrl.trim() }])
                setLinkLabel('')
                setLinkUrl('https://')
              }}
            >
              加
            </button>`,
    `<div className="stack" style={{ gap: 0 }}>
              <input className={\`field\${linkLabel.length > 0 && !linkLabelOk ? ' is-invalid' : ''}\`} placeholder="名稱" value={linkLabel} maxLength={MAX_LABEL} onChange={(e) => setLinkLabel(limitText(e.target.value, MAX_LABEL))} />
              <div className="field-meta"><span /><span>{charCount(linkLabel)} / {MAX_LABEL}</span></div>
            </div>
            <div className="stack" style={{ flex: 1, gap: 0 }}>
              <input className={\`field\${linkUrl.length > 0 && !linkUrlOk ? ' is-invalid' : ''}\`} style={{ width: '100%' }} placeholder="URL" value={linkUrl} maxLength={MAX_URL} onChange={(e) => setLinkUrl(limitText(e.target.value, MAX_URL))} />
              <div className="field-meta"><span className={linkUrl.length > 0 && !linkUrlOk ? 'warn' : undefined}>{linkUrl.length > 0 && !linkUrlOk ? '網址無效' : '${nbsp}'}</span><span>{charCount(linkUrl)} / {MAX_URL}</span></div>
            </div>
            <button
              type="button"
              className="btn ghost"
              disabled={!canAddLink}
              onClick={() => {
                if (!canAddLink) return
                setLinks((xs) => [...xs, { id: uid('l'), label: linkLabel.trim(), url: normalizeHttpUrl(linkUrl) }])
                setLinkLabel('')
                setLinkUrl('https://')
              }}
            >
              加
            </button>`,
  )
  return s
})

// link-in-bio
patch('link-in-bio/index.tsx', (s) => {
  s = s.replace(
    /import \{([^}]+)\} from '\.\.\/\.\.\/lib\/utils'/,
    (m, inner) => {
      const extras = ['charCount', 'isNonEmpty', 'isValidHttpUrl', 'limitText', 'normalizeHttpUrl']
      const parts = inner.split(',').map((x) => x.trim()).filter(Boolean)
      for (const e of extras) if (!parts.includes(e)) parts.push(e)
      return `import { ${parts.join(', ')} } from '../../lib/utils'`
    },
  )
  if (!s.includes('MAX_LINKS')) {
    s = s.replace(
      /export default function Page\(\) \{/,
      `const MAX_LINKS = 30
const MAX_SOCIALS = 12
const MAX_NAME = 40
const MAX_BIO = 200
const MAX_LABEL = 40
const MAX_URL = 2048
const MAX_EMOJI = 8

export default function Page() {`,
    )
  }
  s = s.replace(
    /value=\{name\} onChange=\{\(e\) => setName\(e\.target\.value\)\}/,
    `value={name} maxLength={MAX_NAME} onChange={(e) => setName(limitText(e.target.value, MAX_NAME))}`,
  )
  s = s.replace(
    /value=\{bio\} onChange=\{\(e\) => setBio\(e\.target\.value\)\}/,
    `value={bio} maxLength={MAX_BIO} onChange={(e) => setBio(limitText(e.target.value, MAX_BIO))}`,
  )
  // wrap name/bio with meta - approximate
  s = s.replace(
    /<input className="field" value=\{name\} maxLength=\{MAX_NAME\}/,
    `<div className="stack" style={{ gap: 0 }}><input className="field" value={name} maxLength={MAX_NAME}`,
  )
  // This might be fragile - skip if broken

  s = s.replace(
    /onClick=\{\(\) => setSocials\(\(xs\) => \[\.\.\.xs, \{ id: uid\('s'\), label: '社群', icon: '◎', url: 'https:\/\/' \}\]\)\}/,
    `onClick={() => setSocials((xs) => xs.length >= MAX_SOCIALS ? xs : [...xs, { id: uid('s'), label: '社群', icon: '◎', url: 'https://' }])} disabled={socials.length >= MAX_SOCIALS}`,
  )
  s = s.replace(
    /onClick=\{\(\) => setLinks\(\(xs\) => \[\.\.\.xs, \{ id: uid\('l'\), label: '新連結', url: 'https:\/\/' \}\]\)\}/,
    `onClick={() => setLinks((xs) => xs.length >= MAX_LINKS ? xs : [...xs, { id: uid('l'), label: '新連結', url: 'https://' }])} disabled={links.length >= MAX_LINKS}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => setLinks\(\(xs\) => xs\.map\(\(x\) => \(x\.id === l\.id \? \{ \.\.\.x, label: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_LABEL} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, label: limitText(e.target.value, MAX_LABEL) } : x)))}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => setLinks\(\(xs\) => xs\.map\(\(x\) => \(x\.id === l\.id \? \{ \.\.\.x, url: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_URL} className={\`field\${l.url && !isValidHttpUrl(l.url) ? ' is-invalid' : ''}\`} onChange={(e) => setLinks((xs) => xs.map((x) => (x.id === l.id ? { ...x, url: limitText(e.target.value, MAX_URL) } : x)))}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => setSocials\(\(xs\) => xs\.map\(\(x\) => \(x\.id === s\.id \? \{ \.\.\.x, label: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_LABEL} onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, label: limitText(e.target.value, MAX_LABEL) } : x)))}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => setSocials\(\(xs\) => xs\.map\(\(x\) => \(x\.id === s\.id \? \{ \.\.\.x, url: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_URL} className={\`field\${s.url && !isValidHttpUrl(s.url) ? ' is-invalid' : ''}\`} onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, url: limitText(e.target.value, MAX_URL) } : x)))}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => setSocials\(\(xs\) => xs\.map\(\(x\) => \(x\.id === s\.id \? \{ \.\.\.x, icon: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_EMOJI} onChange={(e) => setSocials((xs) => xs.map((x) => (x.id === s.id ? { ...x, icon: limitText(e.target.value, MAX_EMOJI) } : x)))}`,
  )
  s = s.replace(
    /value=\{avatarEmoji\} onChange=\{\(e\) => setAvatarEmoji\(e\.target\.value\)\}/,
    `value={avatarEmoji} maxLength={MAX_EMOJI} onChange={(e) => setAvatarEmoji(limitText(e.target.value, MAX_EMOJI))}`,
  )
  return s
})

// form-builder
patch('form-builder/index.tsx', (s) => {
  s = s.replace(
    /import \{([^}]+)\} from '\.\.\/\.\.\/lib\/utils'/,
    (m, inner) => {
      const extras = ['charCount', 'isNonEmpty', 'limitText', 'clamp']
      const parts = inner.split(',').map((x) => x.trim()).filter(Boolean)
      for (const e of extras) if (!parts.includes(e)) parts.push(e)
      return `import { ${parts.join(', ')} } from '../../lib/utils'`
    },
  )
  if (!s.includes('MAX_FIELDS')) {
    s = s.replace(
      /export default function Page\(\) \{/,
      `const MAX_FIELDS = 40
const MAX_TITLE = 80
const MAX_LABEL = 80
const MAX_OPTIONS = 200

export default function Page() {`,
    )
  }
  s = s.replace(
    /function add\(type: FieldType\) \{[\s\S]*?setFields/,
    (m) => {
      if (m.includes('MAX_FIELDS')) return m
      return m.replace('function add(type: FieldType) {', 'function add(type: FieldType) {\n    if (fields.length >= MAX_FIELDS) return')
    },
  )
  s = s.replace(
    /<input className="field" value=\{title\} onChange=\{\(e\) => setTitle\(e\.target\.value\)\} \/>/,
    `<div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${!isNonEmpty(title) ? ' is-invalid' : ''}\`} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!isNonEmpty(title) ? 'warn' : undefined}>{!isNonEmpty(title) ? '標題不可空白' : '${nbsp}'}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>`,
  )
  s = s.replace(
    /onChange=\{\(e\) => updateField\(f\.id, \{ label: e\.target\.value \}\)\}/g,
    `maxLength={MAX_LABEL} onChange={(e) => updateField(f.id, { label: limitText(e.target.value, MAX_LABEL) })}`,
  )
  s = s.replace(
    /placeholder="選項，逗號分隔"[\s\S]*?onChange=\{\(e\) => updateField\(f\.id, \{ options: e\.target\.value \}\)\}/,
    `placeholder="選項，逗號分隔"
                    maxLength={MAX_OPTIONS}
                    onChange={(e) => updateField(f.id, { options: limitText(e.target.value, MAX_OPTIONS) })}`,
  )
  return s
})

// survey-app
patch('survey-app/index.tsx', (s) => {
  s = s.replace(
    /import \{([^}]+)\} from '\.\.\/\.\.\/lib\/utils'/,
    (m, inner) => {
      const extras = ['charCount', 'isNonEmpty', 'limitText', 'clamp']
      const parts = inner.split(',').map((x) => x.trim()).filter(Boolean)
      for (const e of extras) if (!parts.includes(e)) parts.push(e)
      return `import { ${parts.join(', ')} } from '../../lib/utils'`
    },
  )
  if (!s.includes('MAX_TITLE =')) {
    s = s.replace(
      /export default function Page\(\) \{/,
      `const MAX_TITLE = 80
const MAX_QUESTION = 200
const MAX_QUESTIONS = 30

export default function Page() {`,
    )
  }
  s = s.replace(
    /<input className="field" value=\{title\} onChange=\{\(e\) => setTitle\(e\.target\.value\)\} \/>/,
    `<div className="stack" style={{ gap: 0 }}>
            <input className={\`field\${!isNonEmpty(title) ? ' is-invalid' : ''}\`} value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(limitText(e.target.value, MAX_TITLE))} />
            <div className="field-meta"><span className={!isNonEmpty(title) ? 'warn' : undefined}>{!isNonEmpty(title) ? '標題不可空白' : '${nbsp}'}</span><span>{charCount(title)} / {MAX_TITLE}</span></div>
          </div>`,
  )
  // question text updates
  s = s.replace(
    /onChange=\{\(e\) => setQuestions\(\(qs\) => qs\.map\(\(x\) => \(x\.id === q\.id \? \{ \.\.\.x, text: e\.target\.value \} : x\)\)\)\}/g,
    `maxLength={MAX_QUESTION} onChange={(e) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, text: limitText(e.target.value, MAX_QUESTION) } : x)))}`,
  )
  return s
})

// feedback reply limits
patch('anonymous-feedback/index.tsx', (s) => {
  s = s.replace(
    `function patch(id: string, patch: Partial<Item>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, reply: x.reply ?? '', adminNote: x.adminNote ?? '', ...patch } : x)))
  }`,
    `function patch(id: string, patch: Partial<Item>) {
    const next = { ...patch }
    if (next.reply != null) next.reply = limitText(next.reply, MAX_REPLY)
    if (next.adminNote != null) next.adminNote = limitText(next.adminNote, MAX_REPLY)
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, reply: x.reply ?? '', adminNote: x.adminNote ?? '', ...next } : x)))
  }`,
  )
  s = s.replace(
    /onChange=\{\(e\) => patch\(it\.id, \{ reply: e\.target\.value \}\)\}/,
    `maxLength={MAX_REPLY} onChange={(e) => patch(it.id, { reply: limitText(e.target.value, MAX_REPLY) })}`,
  )
  s = s.replace(
    /onChange=\{\(e\) => patch\(it\.id, \{ adminNote: e\.target\.value \}\)\}/,
    `maxLength={MAX_REPLY} onChange={(e) => patch(it.id, { adminNote: limitText(e.target.value, MAX_REPLY) })}`,
  )
  return s
})

console.log('batch2 done')
