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

// leftover quick tools if missing
write('currency-converter', `${h('currency-converter', `import { useMemo, useState } from 'react'\n`)}
const rates: Record<string, number> = { TWD: 1, USD: 0.031, EUR: 0.029, JPY: 4.7, CNY: 0.22, GBP: 0.024, KRW: 42 }
export default function Page() {
  const [amount, setAmount] = useState(1000)
  const [from, setFrom] = useState('TWD')
  const [to, setTo] = useState('USD')
  const result = useMemo(() => (amount / rates[from]!) * rates[to]!, [amount, from, to])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 520 }}>
        <p className="muted">離線示範匯率。</p>
        <div className="grid-2">
          <div><label className="label">金額</label><input className="field" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></div>
          <div><label className="label">從</label><select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>{Object.keys(rates).map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><label className="label">到</label><select className="field" value={to} onChange={(e) => setTo(e.target.value)}>{Object.keys(rates).map((k) => <option key={k}>{k}</option>)}</select></div>
          <div><label className="label">結果</label><div className="metric" style={{ fontSize: '1.6rem' }}>{result.toFixed(2)} {to}</div></div>
        </div>
      </div>
    </ProjectShell>
  )
}`)

write('unit-converter', `${h('unit-converter', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [mode, setMode] = useState<'length' | 'weight' | 'temp'>('length')
  const [val, setVal] = useState(1)
  const out = useMemo(() => {
    if (mode === 'length') return { label: '公尺 → 英尺', value: val * 3.28084 }
    if (mode === 'weight') return { label: '公斤 → 磅', value: val * 2.20462 }
    return { label: '°C → °F', value: (val * 9) / 5 + 32 }
  }, [mode, val])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 480 }}>
        <div className="row">{(['length', 'weight', 'temp'] as const).map((m) => (
          <button key={m} className={\`btn sm \${mode === m ? 'accent' : 'ghost'}\`} onClick={() => setMode(m)}>{m}</button>
        ))}</div>
        <input className="field" type="number" value={val} onChange={(e) => setVal(+e.target.value)} />
        <p className="muted">{out.label}</p>
        <div className="metric">{out.value.toFixed(2)}</div>
      </div>
    </ProjectShell>
  )
}`)

write('age-calculator', `${h('age-calculator', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [dob, setDob] = useState('2000-01-01')
  const info = useMemo(() => {
    const birth = new Date(dob), now = new Date()
    let years = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--
    const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
    if (next < now) next.setFullYear(now.getFullYear() + 1)
    return { years, days: Math.ceil((+next - +now) / 86400000) }
  }, [dob])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420 }}>
        <label className="label">生日</label>
        <input className="field" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        <div className="metric">{info.years} 歲</div>
        <p className="muted">距離下次生日還有 {info.days} 天</p>
      </div>
    </ProjectShell>
  )
}`)

write('tip-calculator', `${h('tip-calculator', `import { useMemo, useState } from 'react'\n`)}
export default function Page() {
  const [bill, setBill] = useState(1000)
  const [tip, setTip] = useState(10)
  const [people, setPeople] = useState(2)
  const tipAmt = useMemo(() => (bill * tip) / 100, [bill, tip])
  const total = bill + tipAmt
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 480 }}>
        <div className="grid-2">
          <div><label className="label">帳單</label><input className="field" type="number" value={bill} onChange={(e) => setBill(+e.target.value)} /></div>
          <div><label className="label">小費 %</label><input className="field" type="number" value={tip} onChange={(e) => setTip(+e.target.value)} /></div>
          <div><label className="label">人數</label><input className="field" type="number" min={1} value={people} onChange={(e) => setPeople(+e.target.value)} /></div>
        </div>
        <p>小費 <strong>{tipAmt.toFixed(0)}</strong> · 總計 <strong>{total.toFixed(0)}</strong></p>
        <div className="metric" style={{ fontSize: '1.8rem' }}>每人 {(total / Math.max(1, people)).toFixed(0)}</div>
      </div>
    </ProjectShell>
  )
}`)

write('password-generator', `${h('password-generator', `import { useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [len, setLen] = useState(16)
  const [opts, setOpts] = useState({ upper: true, lower: true, num: true, sym: true })
  const [pwd, setPwd] = useState('')
  function gen() {
    let chars = ''
    if (opts.lower) chars += 'abcdefghijklmnopqrstuvwxyz'
    if (opts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (opts.num) chars += '0123456789'
    if (opts.sym) chars += '!@#$%^&*-_=+?'
    if (!chars) return
    const arr = new Uint32Array(len)
    crypto.getRandomValues(arr)
    setPwd(Array.from(arr, (x) => chars[x % chars.length]!).join(''))
  }
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 520 }}>
        <label className="label">長度 {len}</label>
        <input className="field" type="range" min={8} max={64} value={len} onChange={(e) => setLen(+e.target.value)} />
        <div className="row">{([['lower','小寫'],['upper','大寫'],['num','數字'],['sym','符號']] as const).map(([k,l]) => (
          <label key={k} className="row"><input type="checkbox" checked={opts[k]} onChange={() => setOpts({ ...opts, [k]: !opts[k] })} />{l}</label>
        ))}</div>
        <button className="btn accent" onClick={gen}>產生</button>
        {pwd && <div className="row"><code className="mono panel" style={{ flex: 1, padding: '0.7rem' }}>{pwd}</code><button className="btn ghost" onClick={() => void copyText(pwd)}>複製</button></div>}
      </div>
    </ProjectShell>
  )
}`)

write('qr-generator', `${h('qr-generator', `import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
`)}
export default function Page() {
  const [text, setText] = useState('https://example.com')
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420, alignItems: 'center' }}>
        <input className="field" style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} />
        <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid var(--line)' }}><QRCodeSVG value={text || ' '} size={220} /></div>
      </div>
    </ProjectShell>
  )
}`)

write('uuid-generator', `${h('uuid-generator', `import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { copyText } from '../../lib/utils'
`)}
export default function Page() {
  const [n, setN] = useState(5)
  const [list, setList] = useState<string[]>([])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input className="field" type="number" min={1} max={50} value={n} onChange={(e) => setN(+e.target.value)} style={{ width: 100 }} />
          <button className="btn accent" onClick={() => setList(Array.from({ length: n }, () => uuidv4()))}>產生</button>
          <button className="btn ghost" disabled={!list.length} onClick={() => void copyText(list.join('\\n'))}>複製全部</button>
        </div>
        <ul className="list">{list.map((id) => <li key={id} className="list-item mono">{id}</li>)}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('lorem-ipsum', `${h('lorem-ipsum', `import { useMemo, useState } from 'react'
import { copyText } from '../../lib/utils'
`)}
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ')
export default function Page() {
  const [n, setN] = useState(3)
  const text = useMemo(() => Array.from({ length: n }, (_, pi) => Array.from({ length: 36 }, (__, i) => WORDS[(i + pi * 3) % WORDS.length]).join(' ') + '.').join('\\n\\n'), [n])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="label">段落數 {n}</label>
        <input className="field" type="range" min={1} max={10} value={n} onChange={(e) => setN(+e.target.value)} />
        <textarea className="field" readOnly value={text} style={{ minHeight: 240 }} />
        <button className="btn accent" onClick={() => void copyText(text)}>複製</button>
      </div>
    </ProjectShell>
  )
}`)

write('random-name', `${h('random-name', `import { useState } from 'react'
import { pick, copyText } from '../../lib/utils'
`)}
const FIRST = ['Ava','Noah','Mia','Liam','Zoe','Kai','Ivy','Leo','Nora','Owen']
const LAST = ['Chen','Wang','Lin','Huang','Lee','Wu','Chang','Liu','Yang','Hsu']
export default function Page() {
  const [names, setNames] = useState<string[]>([])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <button className="btn accent" onClick={() => setNames(Array.from({ length: 10 }, () => \`\${pick(FIRST)} \${pick(LAST)}\`))}>產生</button>
          <button className="btn ghost" disabled={!names.length} onClick={() => void copyText(names.join('\\n'))}>複製</button>
        </div>
        <ul className="list">{names.map((n, i) => <li key={n + i} className="list-item">{n}</li>)}</ul>
      </div>
    </ProjectShell>
  )
}`)

write('random-number', `${h('random-number', `import { useState } from 'react'
import { randomInt } from '../../lib/utils'
`)}
export default function Page() {
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(100)
  const [val, setVal] = useState<number | null>(null)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420 }}>
        <div className="grid-2">
          <div><label className="label">Min</label><input className="field" type="number" value={min} onChange={(e) => setMin(+e.target.value)} /></div>
          <div><label className="label">Max</label><input className="field" type="number" value={max} onChange={(e) => setMax(+e.target.value)} /></div>
        </div>
        <button className="btn accent" onClick={() => setVal(randomInt(Math.min(min, max), Math.max(min, max)))}>產生</button>
        {val !== null && <div className="metric">{val}</div>}
      </div>
    </ProjectShell>
  )
}`)

write('color-converter', `${h('color-converter', `import { useState } from 'react'
import { copyText, hexToRgb } from '../../lib/utils'
`)}
export default function Page() {
  const [hex, setHex] = useState('#f0734a')
  const rgb = hexToRgb(hex)
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 420 }}>
        <div style={{ height: 120, borderRadius: 14, background: hex, border: '1px solid var(--line)' }} />
        <input className="field" type="color" value={hex} onChange={(e) => setHex(e.target.value)} />
        <input className="field" value={hex} onChange={(e) => setHex(e.target.value)} />
        <p className="mono">rgb({rgb.r}, {rgb.g}, {rgb.b})</p>
        <button className="btn ghost" onClick={() => void copyText(hex)}>複製 HEX</button>
      </div>
    </ProjectShell>
  )
}`)

write('hex-rgb-hsl', `${h('hex-rgb-hsl', `import { useMemo, useState } from 'react'
import { hexToRgb, rgbToHex, rgbToHsl } from '../../lib/utils'
`)}
export default function Page() {
  const [hex, setHex] = useState('#2a9d8f')
  const rgb = useMemo(() => hexToRgb(hex), [hex])
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb])
  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ maxWidth: 520 }}>
        <div style={{ height: 80, borderRadius: 12, background: hex }} />
        <input className="field" value={hex} onChange={(e) => setHex(e.target.value)} />
        <div className="grid-3">{(['r','g','b'] as const).map((k) => (
          <div key={k}><label className="label">{k.toUpperCase()}</label>
            <input className="field" type="number" value={rgb[k]} onChange={(e) => { const next = { ...rgb, [k]: +e.target.value }; setHex(rgbToHex(next.r, next.g, next.b)) }} /></div>
        ))}</div>
        <p className="mono">hsl({hsl.h}, {hsl.s}%, {hsl.l}%)</p>
      </div>
    </ProjectShell>
  )
}`)

console.log('quick leftovers done')
