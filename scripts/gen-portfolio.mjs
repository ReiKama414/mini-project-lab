import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'projects')
function write(slug, source) {
  const file = path.join(dir, slug, 'index.tsx')
  if (fs.existsSync(file)) { console.log('skip', slug); return }
  fs.mkdirSync(path.join(dir, slug), { recursive: true })
  fs.writeFileSync(file, source.trim() + '\n')
  console.log('write', slug)
}
const h = (slug, extra) => `import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
${extra}
const meta = getProject('${slug}')!
`

write('screenshot-html', `${h('screenshot-html', `import { useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [desc, setDesc] = useState('頂部導覽、英雄標題、三欄特色、底部 CTA')
  const [html, setHtml] = useState('')
  function gen() {
    setHtml(\`<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"/><title>Generated</title>
<style>body{font-family:system-ui;margin:0}header,footer{padding:1rem 2rem;background:#1a2e28;color:#fff}
.hero{padding:4rem 2rem;background:linear-gradient(135deg,#2a9d8f,#f0734a);color:#fff}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;padding:2rem}
.card{border:1px solid #ddd;padding:1rem;border-radius:12px}</style></head>
<body>
<header>Brand</header>
<section class="hero"><h1>\${desc}</h1><p>由描述產生的版面骨架</p><button>開始</button></section>
<section class="grid"><div class="card">Feature A</div><div class="card">Feature B</div><div class="card">Feature C</div></section>
<footer>CTA · Contact</footer>
</body></html>\`)
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <textarea className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="row"><button className="btn accent" onClick={gen}>產生 HTML</button>
          <button className="btn ghost" disabled={!html} onClick={() => void copyText(html)}>複製</button></div>
        <textarea className="field" readOnly value={html} style={{ minHeight: 260 }} />
      </div>
    </ProjectShell>
  )
}`)

write('website-screenshot', `${h('website-screenshot', `import { useState } from 'react'\n`)}
export default function Page() {
  const [url, setUrl] = useState('https://example.com')
  const [shot, setShot] = useState(false)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 640 }}>
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn accent" onClick={() => setShot(true)}>擷取預覽</button>
        </div>
        {shot && (
          <div className="panel" style={{ background: 'linear-gradient(160deg,#d4f0eb,#ffe0d4)', minHeight: 280, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="tag">preview card</div>
              <h2 style={{ marginTop: 12 }}>{url.replace(/^https?:\\/\\//, '')}</h2>
              <p className="muted">本機示範預覽卡（實務可接截圖服務）</p>
            </div>
          </div>
        )}
      </div>
    </ProjectShell>
  )
}`)

write('uptime-monitor', `${h('uptime-monitor', `import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, randomInt } from '../../lib/utils'
`)}
type Site = { id: string; url: string; up: boolean; latency: number }
export default function Page() {
  const [sites, setSites] = useLocalStorage<Site[]>('lab:uptime-monitor', [
    { id: '1', url: 'https://example.com', up: true, latency: 120 },
    { id: '2', url: 'https://api.demo.dev', up: true, latency: 80 },
  ])
  const [url, setUrl] = useState('https://')
  useEffect(() => {
    const t = setInterval(() => {
      setSites((prev) => prev.map((s) => ({ ...s, up: Math.random() > 0.08, latency: randomInt(40, 400) })))
    }, 3000)
    return () => clearInterval(t)
  }, [setSites])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" style={{ flex: 1 }} value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn accent" onClick={() => { if (!url.trim()) return; setSites([{ id: uid('u'), url, up: true, latency: 100 }, ...sites]); setUrl('https://') }}>監控</button>
        </div>
        <ul className="list">{sites.map((s) => (
          <li key={s.id} className="list-item">
            <span className="dot" style={{ width: 10, height: 10, borderRadius: 99, background: s.up ? 'var(--teal)' : 'var(--rose)' }} />
            <span style={{ flex: 1 }} className="mono">{s.url}</span>
            <span className="tag">{s.up ? 'UP' : 'DOWN'}</span>
            <span className="muted">{s.latency}ms</span>
            <button className="btn ghost sm" onClick={() => setSites(sites.filter((x) => x.id !== s.id))}>刪</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('api-monitor', `${h('api-monitor', `import { useEffect, useState } from 'react'
import { randomInt } from '../../lib/utils'
`)}
type Ep = { name: string; method: string; p50: number; err: number }
export default function Page() {
  const [eps, setEps] = useState<Ep[]>([
    { name: '/api/users', method: 'GET', p50: 42, err: 0.2 },
    { name: '/api/orders', method: 'POST', p50: 88, err: 1.1 },
    { name: '/api/search', method: 'GET', p50: 120, err: 0.5 },
  ])
  useEffect(() => {
    const t = setInterval(() => setEps((list) => list.map((e) => ({ ...e, p50: randomInt(30, 200), err: +(Math.random() * 2).toFixed(1) }))), 2000)
    return () => clearInterval(t)
  }, [])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-3">{eps.map((e) => (
        <div key={e.name} className="panel stack">
          <span className="tag">{e.method}</span>
          <strong className="mono">{e.name}</strong>
          <div className="metric" style={{ fontSize: '1.6rem' }}>{e.p50}<span style={{ fontSize: 14 }}>ms</span></div>
          <p className="muted">error rate {e.err}%</p>
          <div className="progress"><span style={{ width: \`\${Math.min(100, e.p50 / 2)}%\` }} /></div>
        </div>
      ))}</div>
    </ProjectShell>
  )
}`)

write('webhook-tester', `${h('webhook-tester', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Ev = { id: string; body: string; at: number }
export default function Page() {
  const [events, setEvents] = useLocalStorage<Ev[]>('lab:webhook-tester', [])
  const [body, setBody] = useState('{\\n  "event": "payment.succeeded",\\n  "amount": 1200\\n}')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted">模擬送出 webhook payload 到本機收件匣。</p>
        <textarea className="field" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 160 }} />
        <button className="btn accent" onClick={() => setEvents([{ id: uid('wh'), body, at: Date.now() }, ...events].slice(0, 30))}>Send webhook</button>
        <ul className="list">{events.map((e) => (
          <li key={e.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
            <span className="muted">{new Date(e.at).toLocaleTimeString()}</span>
            <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{e.body}</pre>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('api-docs-gen', `${h('api-docs-gen', `import { useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/api/items/:id')
  const [desc, setDesc] = useState('取得單一項目')
  const doc = useMemo(() => \`## \${method} \${path}\\n\\n\${desc}\\n\\n### Parameters\\n| Name | In | Type |\\n|------|----|------|\\n| id | path | string |\\n\\n### Response 200\\n\\\`\\\`\\\`json\\n{ "id": "1", "name": "Demo" }\\n\\\`\\\`\\\`\`, [method, path, desc])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <select className="field" style={{ width: 120 }} value={method} onChange={(e) => setMethod(e.target.value)}>{['GET','POST','PUT','DELETE'].map((m) => <option key={m}>{m}</option>)}</select>
          <input className="field" style={{ flex: 1 }} value={path} onChange={(e) => setPath(e.target.value)} />
        </div>
        <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <pre className="panel mono">{doc}</pre>
        <button className="btn accent" onClick={() => void copyText(doc)}>複製 Markdown</button>
      </div>
    </ProjectShell>
  )
}`)

write('db-schema-viz', `${h('db-schema-viz', `import { useState } from 'react'\n`)}
const SAMPLE = [
  { name: 'users', fields: ['id', 'email', 'name'], links: ['orders'] },
  { name: 'orders', fields: ['id', 'user_id', 'total'], links: ['order_items'] },
  { name: 'order_items', fields: ['id', 'order_id', 'sku'], links: [] },
]
export default function Page() {
  const [tables] = useState(SAMPLE)
  return (
    <ProjectShell meta={meta}>
      <div className="grid-3">{tables.map((t) => (
        <div key={t.name} className="panel stack">
          <h3 className="mono">{t.name}</h3>
          <ul className="list">{t.fields.map((f) => <li key={f} className="list-item mono">{f}</li>)}</ul>
          {t.links.length > 0 && <p className="muted">→ {t.links.join(', ')}</p>}
        </div>
      ))}</div>
    </ProjectShell>
  )
}`)

write('sql-playground', `${h('sql-playground', `import { useMemo, useState } from 'react'\n`)}
const ROWS = [
  { id: 1, name: 'Ada', role: 'admin' },
  { id: 2, name: 'Lin', role: 'user' },
  { id: 3, name: 'Kai', role: 'user' },
  { id: 4, name: 'Mia', role: 'editor' },
]
export default function Page() {
  const [q, setQ] = useState("SELECT * FROM users WHERE role = 'user'")
  const result = useMemo(() => {
    const m = q.match(/role\\s*=\\s*'([^']+)'/i)
    if (/where/i.test(q) && m) return ROWS.filter((r) => r.role === m[1])
    if (/select\\s+\\*/i.test(q)) return ROWS
    return ROWS
  }, [q])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted">記憶體表 users（示範簡單 WHERE role 過濾）</p>
        <textarea className="field" value={q} onChange={(e) => setQ(e.target.value)} />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['id','name','role'].map((c) => <th key={c} style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', padding: 8 }}>{c}</th>)}</tr></thead>
          <tbody>{result.map((r) => <tr key={r.id}>{[r.id, r.name, r.role].map((c, i) => <td key={i} className="mono" style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </ProjectShell>
  )
}`)

write('github-contrib', `${h('github-contrib', `import { useMemo, useState } from 'react'
import { randomInt } from '../../lib/utils'
`)}
export default function Page() {
  const [seed, setSeed] = useState(1)
  const cells = useMemo(() => Array.from({ length: 84 }, (_, i) => ((i * 17 + seed * 13) % 5)), [seed])
  const colors = ['#e8e4d8', '#b7e4c7', '#74c69d', '#40916c', '#1b4332']
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="metric" style={{ fontSize: '1.5rem' }}>{cells.reduce((a, b) => a + b, 0)} contributions</div>
          <button className="btn ghost" onClick={() => setSeed(randomInt(1, 999))}>重新模擬</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
          {cells.map((v, i) => <div key={i} title={String(v)} style={{ aspectRatio: '1', borderRadius: 3, background: colors[v] }} />)}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('readme-generator', `${h('readme-generator', `import { useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [name, setName] = useState('awesome-app')
  const [desc, setDesc] = useState('一個好用的小工具')
  const [stack, setStack] = useState('React, Vite, TypeScript')
  const md = useMemo(() => \`# \${name}\\n\\n\${desc}\\n\\n## Stack\\n\${stack}\\n\\n## Getting Started\\n\\\`\\\`\\\`bash\\nnpm install\\nnpm run dev\\n\\\`\\\`\\\`\\n\\n## License\\nMIT\\n\`, [name, desc, stack])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="專案名" />
        <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input className="field" value={stack} onChange={(e) => setStack(e.target.value)} />
        <pre className="panel mono">{md}</pre>
        <button className="btn accent" onClick={() => void copyText(md)}>複製 README</button>
      </div>
    </ProjectShell>
  )
}`)

write('dependency-dashboard', `${h('dependency-dashboard', `\n`)}
const DEPS = [
  { name: 'react', current: '19.2.0', latest: '19.2.8', status: 'minor' },
  { name: 'vite', current: '8.0.0', latest: '8.2.2', status: 'minor' },
  { name: 'lodash', current: '4.17.20', latest: '4.17.21', status: 'patch' },
  { name: 'left-pad', current: '1.3.0', latest: '1.3.0', status: 'ok' },
]
export default function Page() {
  return (
    <ProjectShell meta={meta}>
      <div className="panel">
        <ul className="list">{DEPS.map((d) => (
          <li key={d.name} className="list-item">
            <strong className="mono" style={{ flex: 1 }}>{d.name}</strong>
            <span className="muted">{d.current}</span>
            <span>→</span>
            <span className="mono">{d.latest}</span>
            <span className="tag">{d.status}</span>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('docker-dashboard', `${h('docker-dashboard', `import { useEffect, useState } from 'react'
import { randomInt } from '../../lib/utils'
`)}
type C = { name: string; status: string; cpu: number; mem: number }
export default function Page() {
  const [list, setList] = useState<C[]>([
    { name: 'web', status: 'running', cpu: 12, mem: 256 },
    { name: 'api', status: 'running', cpu: 28, mem: 512 },
    { name: 'redis', status: 'running', cpu: 3, mem: 64 },
    { name: 'worker', status: 'exited', cpu: 0, mem: 0 },
  ])
  useEffect(() => {
    const t = setInterval(() => setList((xs) => xs.map((c) => c.status === 'running' ? { ...c, cpu: randomInt(1, 60), mem: randomInt(64, 800) } : c)), 2000)
    return () => clearInterval(t)
  }, [])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">{list.map((c) => (
        <div key={c.name} className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 className="mono">{c.name}</h3>
            <span className="tag">{c.status}</span>
          </div>
          <p>CPU {c.cpu}%</p>
          <div className="progress"><span style={{ width: \`\${c.cpu}%\` }} /></div>
          <p className="muted">Mem {c.mem} MB</p>
        </div>
      ))}</div>
    </ProjectShell>
  )
}`)

write('server-monitor', `${h('server-monitor', `import { useEffect, useState } from 'react'
import { randomInt } from '../../lib/utils'
`)}
export default function Page() {
  const [cpu, setCpu] = useState(22)
  const [mem, setMem] = useState(48)
  const [disk, setDisk] = useState(61)
  useEffect(() => {
    const t = setInterval(() => { setCpu(randomInt(10, 90)); setMem(randomInt(30, 85)); setDisk(randomInt(55, 70)) }, 1500)
    return () => clearInterval(t)
  }, [])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-3">{[
        ['CPU', cpu, '%'],
        ['Memory', mem, '%'],
        ['Disk', disk, '%'],
      ].map(([l, v, u]) => (
        <div key={l as string} className="panel stack">
          <span className="muted">{l as string}</span>
          <div className="metric">{v as number}{u as string}</div>
          <div className="progress"><span style={{ width: \`\${v as number}%\` }} /></div>
        </div>
      ))}</div>
    </ProjectShell>
  )
}`)

write('log-viewer', `${h('log-viewer', `import { useMemo, useState } from 'react'\n`)}
const LOGS = [
  { level: 'INFO', msg: 'server started on :5173' },
  { level: 'DEBUG', msg: 'cache warm complete' },
  { level: 'WARN', msg: 'slow query 320ms' },
  { level: 'ERROR', msg: 'payment webhook timeout' },
  { level: 'INFO', msg: 'user login ok' },
  { level: 'ERROR', msg: 'disk almost full' },
]
export default function Page() {
  const [level, setLevel] = useState('ALL')
  const [q, setQ] = useState('')
  const list = useMemo(() => LOGS.filter((l) => (level === 'ALL' || l.level === level) && l.msg.includes(q)), [level, q])
  const color: Record<string, string> = { INFO: 'var(--teal)', WARN: 'var(--amber)', ERROR: 'var(--rose)', DEBUG: 'var(--ink-muted)' }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          {['ALL','INFO','WARN','ERROR','DEBUG'].map((l) => (
            <button key={l} className={\`btn sm \${level === l ? 'accent' : 'ghost'}\`} onClick={() => setLevel(l)}>{l}</button>
          ))}
          <input className="field" style={{ flex: 1 }} placeholder="搜尋" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="list">{list.map((l, i) => (
          <li key={i} className="list-item mono">
            <span style={{ color: color[l.level], fontWeight: 700, width: 64 }}>{l.level}</span>
            <span>{l.msg}</span>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('feature-flags', `${h('feature-flags', `import { useLocalStorage } from '../../lib/storage'\n`)}
type Flag = { key: string; on: boolean; desc: string }
export default function Page() {
  const [flags, setFlags] = useLocalStorage<Flag[]>('lab:feature-flags', [
    { key: 'new_checkout', on: true, desc: '新結帳流程' },
    { key: 'ai_suggestions', on: false, desc: 'AI 建議面板' },
    { key: 'dark_mode', on: true, desc: '深色模式' },
  ])
  return (
    <ProjectShell meta={meta}>
      <div className="panel">
        <ul className="list">{flags.map((f) => (
          <li key={f.key} className="list-item">
            <div style={{ flex: 1 }}><strong className="mono">{f.key}</strong><div className="muted">{f.desc}</div></div>
            <button className={\`btn sm \${f.on ? 'teal' : 'ghost'}\`} onClick={() => setFlags(flags.map((x) => x.key === f.key ? { ...x, on: !x.on } : x))}>{f.on ? 'ON' : 'OFF'}</button>
          </li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('simple-analytics', `${h('simple-analytics', `import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'
`)}
type Ev = { id: string; name: string; at: number }
export default function Page() {
  const [events, setEvents] = useLocalStorage<Ev[]>('lab:simple-analytics', [])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of events) m[e.name] = (m[e.name] ?? 0) + 1
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [events])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          {['page_view', 'click_cta', 'signup'].map((n) => (
            <button key={n} className="btn accent sm" onClick={() => setEvents([{ id: uid('ev'), name: n, at: Date.now() }, ...events])}>track {n}</button>
          ))}
          <button className="btn ghost sm" onClick={() => setEvents([])}>清空</button>
        </div>
        <div className="metric">{events.length} events</div>
        <ul className="list">{counts.map(([n, c]) => (
          <li key={n} className="list-item"><span style={{ flex: 1 }} className="mono">{n}</span><strong>{c}</strong>
            <div className="progress" style={{ width: 120 }}><span style={{ width: \`\${Math.min(100, c * 10)}%\` }} /></div></li>
        ))}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('heatmap-analytics', `${h('heatmap-analytics', `import { useState } from 'react'\n`)}
export default function Page() {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted">在區域內點擊，模擬熱點累積。</p>
        <div
          onClick={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            setPoints([...points, { x: e.clientX - r.left, y: e.clientY - r.top }])
          }}
          style={{ position: 'relative', height: 320, borderRadius: 14, background: 'var(--bg-muted)', overflow: 'hidden', cursor: 'crosshair' }}
        >
          {points.map((p, i) => (
            <span key={i} style={{ position: 'absolute', left: p.x - 12, top: p.y - 12, width: 24, height: 24, borderRadius: 99, background: 'rgba(240,115,74,0.35)', pointerEvents: 'none' }} />
          ))}
        </div>
        <div className="row">
          <span className="tag">{points.length} clicks</span>
          <button className="btn ghost sm" onClick={() => setPoints([])}>重置</button>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('ab-testing', `${h('ab-testing', `import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
`)}
export default function Page() {
  const [stats, setStats] = useLocalStorage('lab:ab-testing', { A: { views: 0, conv: 0 }, B: { views: 0, conv: 0 } })
  const [variant, setVariant] = useState<'A' | 'B'>('A')
  const rate = useMemo(() => ({
    A: stats.A.views ? ((stats.A.conv / stats.A.views) * 100).toFixed(1) : '0.0',
    B: stats.B.views ? ((stats.B.conv / stats.B.views) * 100).toFixed(1) : '0.0',
  }), [stats])
  function assign() {
    const v = Math.random() > 0.5 ? 'A' : 'B'
    setVariant(v)
    setStats({ ...stats, [v]: { ...stats[v], views: stats[v].views + 1 } })
  }
  function convert() {
    setStats({ ...stats, [variant]: { ...stats[variant], conv: stats[variant].conv + 1 } })
  }
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <p>目前變體：<strong>{variant}</strong></p>
          <div className="panel" style={{ background: variant === 'A' ? 'var(--teal-soft)' : 'var(--accent-soft)', textAlign: 'center', padding: '2rem' }}>
            <h2>{variant === 'A' ? '開始免費試用' : '立即升級 Pro'}</h2>
          </div>
          <div className="row">
            <button className="btn accent" onClick={assign}>分配流量</button>
            <button className="btn teal" onClick={convert}>記一次轉換</button>
          </div>
        </div>
        <div className="panel stack">
          {(['A','B'] as const).map((v) => (
            <div key={v}><strong>Variant {v}</strong>
              <p className="muted">views {stats[v].views} · conv {stats[v].conv}</p>
              <div className="metric" style={{ fontSize: '1.5rem' }}>{rate[v]}%</div>
              <div className="progress"><span style={{ width: \`\${Math.min(100, +rate[v] * 2)}%\` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('passwordless-login', `${h('passwordless-login', `import { useState } from 'react'\n`)}
export default function Page() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [ok, setOk] = useState(false)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 440 }}>
        {!sent && (
          <>
            <label className="label">Email</label>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn accent" onClick={() => email && setSent(true)}>寄送魔法連結</button>
          </>
        )}
        {sent && !ok && (
          <>
            <p className="muted">已寄到 {email}（示範碼：123456）</p>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="輸入 6 碼" />
            <button className="btn teal" onClick={() => setOk(code === '123456')}>驗證登入</button>
          </>
        )}
        {ok && <div className="metric" style={{ fontSize: '1.4rem' }}>登入成功 ✓</div>}
      </div>
    </ProjectShell>
  )
}`)

write('oauth-playground', `${h('oauth-playground', `import { useState } from 'react'\n`)}
const STEPS = ['授權請求', '使用者同意', '換取 token', '呼叫 API']
export default function Page() {
  const [step, setStep] = useState(0)
  const [log, setLog] = useState<string[]>([])
  function next() {
    const msgs = [
      'redirect → /oauth/authorize?client_id=demo',
      'user granted scope: profile email',
      'POST /oauth/token → access_token=demo_xxx',
      'GET /me → { "name": "Demo User" }',
    ]
    setLog((l) => [...l, msgs[step]!])
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">{STEPS.map((s, i) => (
          <span key={s} className={\`tag\`} style={{ opacity: i <= step ? 1 : 0.4 }}>{i + 1}. {s}</span>
        ))}</div>
        <button className="btn accent" onClick={next} disabled={step >= STEPS.length - 1 && log.length >= STEPS.length}>下一步</button>
        <button className="btn ghost" onClick={() => { setStep(0); setLog([]) }}>重置</button>
        <ul className="list">{log.map((l, i) => <li key={i} className="list-item mono">{l}</li>)}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('realtime-chat', `${h('realtime-chat', `import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, pick } from '../../lib/utils'
`)}
type Msg = { id: string; room: string; user: string; text: string }
const BOTS = ['Ava', 'Kai', 'Mia']
export default function Page() {
  const [room, setRoom] = useState('general')
  const [msgs, setMsgs] = useLocalStorage<Msg[]>('lab:realtime-chat', [])
  const [text, setText] = useState('')
  const visible = msgs.filter((m) => m.room === room)
  function send() {
    if (!text.trim()) return
    const mine = { id: uid('m'), room, user: 'You', text: text.trim() }
    setMsgs([...msgs, mine])
    setText('')
    setTimeout(() => {
      setMsgs((prev) => [...prev, { id: uid('m'), room, user: pick(BOTS), text: pick(['收到！', '好主意', '等等我來看', '👍']) }])
    }, 500)
  }
  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>{['general', 'random', 'dev'].map((r) => (
        <button key={r} className={\`btn sm \${room === r ? 'accent' : 'ghost'}\`} onClick={() => setRoom(r)}>#{r}</button>
      ))}</div>
      <div className="panel stack" style={{ minHeight: 280 }}>
        {visible.map((m) => (
          <div key={m.id} className={\`chat-bubble \${m.user === 'You' ? 'user' : 'bot'}\`}><strong>{m.user}</strong>: {m.text}</div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input className="field" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn accent" onClick={send}>送出</button>
      </div>
    </ProjectShell>
  )
}`)

write('whiteboard', `${h('whiteboard', `import { useEffect, useRef, useState } from 'react'\n`)}
export default function Page() {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [color, setColor] = useState('#1a2e28')
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineWidth = 3
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => { drawing.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); ctx.strokeStyle = color; ctx.lineTo(p.x, p.y); ctx.stroke() }
    const up = () => { drawing.current = false }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [color])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          {['#1a2e28', '#f0734a', '#2a9d8f', '#d6406a'].map((c) => (
            <button key={c} className="btn sm" style={{ background: c, width: 36, height: 36 }} onClick={() => setColor(c)} />
          ))}
          <button className="btn ghost sm" onClick={() => { const c = ref.current; if (!c) return; c.getContext('2d')!.clearRect(0, 0, c.width, c.height) }}>清除</button>
        </div>
        <canvas ref={ref} width={800} height={420} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', background: '#fff', touchAction: 'none' }} />
      </div>
    </ProjectShell>
  )
}`)

write('tic-tac-toe', `${h('tic-tac-toe', `import { useState } from 'react'\n`)}
function winner(b: (string | null)[]) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  for (const [a,b1,c] of lines) if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a]
  return null
}
export default function Page() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)
  const w = winner(board)
  function play(i: number) {
    if (board[i] || w) return
    const next = board.slice()
    next[i] = xIsNext ? 'X' : 'O'
    setBoard(next)
    setXIsNext(!xIsNext)
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
        <p>{w ? \`勝者：\${w}\` : \`輪到：\${xIsNext ? 'X' : 'O'}\`}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {board.map((c, i) => (
            <button key={i} className="btn ghost" style={{ height: 72, fontSize: 28, fontFamily: 'var(--font-display)' }} onClick={() => play(i)}>{c}</button>
          ))}
        </div>
        <button className="btn accent" onClick={() => { setBoard(Array(9).fill(null)); setXIsNext(true) }}>重來</button>
      </div>
    </ProjectShell>
  )
}`)

write('code-editor', `${h('code-editor', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [html, setHtml] = useState('<h1>Hello Lab</h1>\\n<p style="color:#f0734a">編輯左側看看</p>')
  const src = useMemo(() => \`<!doctype html><html><body>\${html}</body></html>\`, [html])
  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <textarea className="field panel mono" style={{ minHeight: 360 }} value={html} onChange={(e) => setHtml(e.target.value)} />
        <iframe title="preview" className="panel" style={{ minHeight: 360, width: '100%', border: '1px solid var(--line)', borderRadius: 14, background: '#fff' }} srcDoc={src} />
      </div>
    </ProjectShell>
  )
}`)

write('saas-boilerplate', `${h('saas-boilerplate', `import { useState } from 'react'\n`)}
const NAV = ['Overview', 'Customers', 'Billing', 'Settings']
export default function Page() {
  const [tab, setTab] = useState('Overview')
  return (
    <ProjectShell meta={meta}>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', minHeight: 360, padding: 0, overflow: 'hidden' }}>
        <aside style={{ background: 'var(--ink)', color: '#fff', padding: '1rem' }}>
          <strong style={{ fontFamily: 'var(--font-display)' }}>MiniSaaS</strong>
          <div className="stack" style={{ marginTop: 16 }}>
            {NAV.map((n) => (
              <button key={n} className="btn sm" style={{ background: tab === n ? 'var(--accent)' : 'transparent', justifyContent: 'flex-start' }} onClick={() => setTab(n)}>{n}</button>
            ))}
          </div>
        </aside>
        <div style={{ padding: '1.25rem' }} className="stack">
          <h2>{tab}</h2>
          {tab === 'Overview' && (
            <div className="grid-3">
              {[['MRR', '$12.4k'], ['Users', '1,284'], ['Churn', '2.1%']].map(([k, v]) => (
                <div key={k} className="panel"><div className="muted">{k}</div><div className="metric" style={{ fontSize: '1.5rem' }}>{v}</div></div>
              ))}
            </div>
          )}
          {tab === 'Customers' && <ul className="list">{['Ada Chen','Kai Lin','Mia Wu'].map((n) => <li key={n} className="list-item">{n}<span className="tag">Pro</span></li>)}</ul>}
          {tab === 'Billing' && <p>目前方案：<strong>Pro / $29 mo</strong></p>}
          {tab === 'Settings' && <p className="muted">團隊、網域、API Key 設定佔位。</p>}
        </div>
      </div>
    </ProjectShell>
  )
}`)

console.log('portfolio done')
