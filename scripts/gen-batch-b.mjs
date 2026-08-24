import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'src', 'projects')
const force = process.argv.includes('--force')

function write(slug, source) {
  const file = path.join(dir, slug, 'index.tsx')
  if (!force && fs.existsSync(file)) { console.log('skip', slug); return }
  fs.mkdirSync(path.join(dir, slug), { recursive: true })
  fs.writeFileSync(file, source.trim() + '\n')
  console.log('write', slug)
}

const h = (slug, extra) => `import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
${extra}
const meta = getProject('${slug}')!
`

write('markdown-previewer', `${h('markdown-previewer', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [md, setMd] = useState('# Hello Lab\\n\\n**粗體** _斜體_\\n\\n- item one\\n- item two\\n\\n\`inline code\`')
  const html = useMemo(() => md
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\`(.*?)\`/g, '<code>$1</code>')
    .replace(/^- (.*)$/gim, '<li>$1</li>')
    .replace(/\\n/g, '<br/>'), [md])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <textarea className="field panel" value={md} onChange={(e) => setMd(e.target.value)} style={{ minHeight: 360 }} />
        <div className="panel" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ProjectShell>
  )
}`)

write('json-formatter', `${h('json-formatter', `import { useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [raw, setRaw] = useState('{"hello":"world","items":[1,2,3]}')
  const [out, setOut] = useState('')
  const [err, setErr] = useState('')
  function run(space: number | null) {
    try {
      const o = JSON.parse(raw)
      setOut(space === null ? JSON.stringify(o) : JSON.stringify(o, null, space))
      setErr('')
    } catch (e) {
      setErr(String(e))
      setOut('')
    }
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <textarea className="field" value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="row">
          <button className="btn accent" onClick={() => run(2)}>格式化</button>
          <button className="btn ghost" onClick={() => run(null)}>壓縮</button>
          <button className="btn ghost" disabled={!out} onClick={() => void copyText(out)}>複製</button>
        </div>
        {err && <p style={{ color: 'var(--rose)' }}>{err}</p>}
        {out && <pre className="mono panel" style={{ overflow: 'auto' }}>{out}</pre>}
      </div>
    </ProjectShell>
  )
}`)

write('json-to-csv', `${h('json-to-csv', `import { useState } from 'react'
import { downloadText } from '../../lib/utils'
`)}
export default function Page() {
  const [raw, setRaw] = useState('[{"name":"Ada","age":36},{"name":"Lin","age":28}]')
  const [csv, setCsv] = useState('')
  function convert() {
    try {
      const arr = JSON.parse(raw) as Record<string, unknown>[]
      if (!Array.isArray(arr) || !arr.length) throw new Error('需要非空 JSON 陣列')
      const keys = Object.keys(arr[0]!)
      setCsv([keys.join(','), ...arr.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\\n'))
    } catch (e) {
      setCsv(String(e))
    }
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <textarea className="field" value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="row">
          <button className="btn accent" onClick={convert}>轉換</button>
          <button className="btn ghost" disabled={!csv} onClick={() => downloadText('data.csv', csv, 'text/csv')}>下載 CSV</button>
        </div>
        <textarea className="field" readOnly value={csv} />
      </div>
    </ProjectShell>
  )
}`)

write('base64', `${h('base64', `import { useState } from 'react'\n`)}
export default function Page() {
  const [text, setText] = useState('Hello Mini Lab')
  const [mode, setMode] = useState<'enc' | 'dec'>('enc')
  let out = ''
  try {
    out = mode === 'enc' ? btoa(unescape(encodeURIComponent(text))) : decodeURIComponent(escape(atob(text)))
  } catch {
    out = '無法轉換'
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <button className={\`btn sm \${mode === 'enc' ? 'accent' : 'ghost'}\`} onClick={() => setMode('enc')}>Encode</button>
          <button className={\`btn sm \${mode === 'dec' ? 'accent' : 'ghost'}\`} onClick={() => setMode('dec')}>Decode</button>
        </div>
        <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} />
        <textarea className="field" readOnly value={out} />
      </div>
    </ProjectShell>
  )
}`)

write('url-codec', `${h('url-codec', `import { useState } from 'react'\n`)}
export default function Page() {
  const [text, setText] = useState('https://example.com/?q=你好 world')
  const [mode, setMode] = useState<'enc' | 'dec'>('enc')
  let out = ''
  try {
    out = mode === 'enc' ? encodeURIComponent(text) : decodeURIComponent(text)
  } catch {
    out = '無法轉換'
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <button className={\`btn sm \${mode === 'enc' ? 'accent' : 'ghost'}\`} onClick={() => setMode('enc')}>Encode</button>
          <button className={\`btn sm \${mode === 'dec' ? 'accent' : 'ghost'}\`} onClick={() => setMode('dec')}>Decode</button>
        </div>
        <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} />
        <textarea className="field" readOnly value={out} />
      </div>
    </ProjectShell>
  )
}`)

write('timestamp', `${h('timestamp', `import { useEffect, useState } from 'react'\n`)}
export default function Page() {
  const [now, setNow] = useState(Date.now())
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000)))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <p>現在：<strong className="mono">{Math.floor(now / 1000)}</strong> · {new Date(now).toLocaleString()}</p>
        <label className="label">Timestamp → Date</label>
        <div className="row">
          <input className="field" value={ts} onChange={(e) => setTs(e.target.value)} />
          <span className="mono">{new Date((+ts || 0) * 1000).toLocaleString()}</span>
        </div>
        <label className="label">Date → Timestamp</label>
        <div className="row">
          <input className="field" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="mono">{Math.floor(new Date(date).getTime() / 1000)}</span>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('cron-generator', `${h('cron-generator', `import { useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [min, setMin] = useState('*/5')
  const [hour, setHour] = useState('*')
  const [dom, setDom] = useState('*')
  const [mon, setMon] = useState('*')
  const [dow, setDow] = useState('*')
  const expr = \`\${min} \${hour} \${dom} \${mon} \${dow}\`
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <div className="grid-2">
          {([['分', min, setMin], ['時', hour, setHour], ['日', dom, setDom], ['月', mon, setMon], ['週', dow, setDow]] as const).map(([l, v, s]) => (
            <div key={l}><label className="label">{l}</label><input className="field" value={v} onChange={(e) => s(e.target.value)} /></div>
          ))}
        </div>
        <code className="mono panel">{expr}</code>
        <button className="btn accent" onClick={() => void copyText(expr)}>複製</button>
        <p className="muted">例：*/5 * * * * = 每 5 分鐘</p>
      </div>
    </ProjectShell>
  )
}`)

write('regex-tester', `${h('regex-tester', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [pattern, setPattern] = useState('\\\\b\\\\w+\\\\b')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('Hello Mini Project Lab 123')
  const result = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags)
      return { matches: [...text.matchAll(re)].map((m) => ({ match: m[0], index: m.index ?? 0 })), error: '' }
    } catch (e) {
      return { matches: [], error: String(e) }
    }
  }, [pattern, flags, text])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="pattern" />
          <input className="field" style={{ width: 80 }} value={flags} onChange={(e) => setFlags(e.target.value)} />
        </div>
        <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} />
        {result.error && <p style={{ color: 'var(--rose)' }}>{result.error}</p>}
        <p>匹配數：{result.matches.length}</p>
        <ul className="list">{result.matches.map((m, i) => <li key={i} className="list-item mono">[{m.index}] {m.match}</li>)}</ul>
      </div>
    </ProjectShell>
  )
}`)

console.log('batch B done')
