import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, limitText } from '../../lib/utils'

const meta = getProject('code-editor')!

const CODE_MAX = 50_000

type Tab = 'html' | 'css' | 'js'
type Bundle = { html: string; css: string; js: string }

const samples: Record<string, Bundle> = {
  hello: {
    html: `<div class="wrap">
  <h1>Hello Lab</h1>
  <button id="btn">換色</button>
  <p id="out"></p>
</div>`,
    css: `body { margin: 0; font-family: Georgia, serif; background: #0f172a; color: #e2e8f0; }
.wrap { padding: 32px; }
button { padding: 8px 16px; border-radius: 8px; border: 0; cursor: pointer; }`,
    js: `const btn = document.getElementById('btn')
const out = document.getElementById('out')
btn?.addEventListener('click', () => {
  document.body.style.background = '#134e4a'
  out.textContent = '已執行 · ' + new Date().toLocaleTimeString()
})`,
  },
  card: {
    html: `<article class="card">
  <h2>產品卡</h2>
  <p>瀏覽器即時預覽範例</p>
  <button>了解更多</button>
</article>`,
    css: `body { display:grid; place-items:center; min-height:100vh; margin:0; background:#f3f0e8; font-family:Georgia, serif; }
.card { background:#fff; padding:24px; border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,.08); width:280px; }
button { background:#f0734a; color:#fff; border:0; padding:10px 14px; border-radius:8px; }`,
    js: `document.querySelector('button')?.addEventListener('click', () => alert('Demo CTA'))`,
  },
  counter: {
    html: `<div style="padding:24px;font-family:monospace">
  <h1>Counter</h1>
  <p id="n">0</p>
  <button id="inc">+1</button>
  <button id="reset">重置</button>
</div>`,
    css: `body{background:#1a2e28;color:#fff} button{padding:8px 12px;margin-right:8px}`,
    js: `let n=0; const el=document.getElementById('n');
document.getElementById('inc')?.addEventListener('click',()=>{ n++; el.textContent=String(n) })
document.getElementById('reset')?.addEventListener('click',()=>{ n=0; el.textContent='0' })`,
  },
}

export default function Page() {
  const [tab, setTab] = useLocalStorage<Tab>('lab:code-editor:tab', 'html')
  const [code, setCode] = useLocalStorage<Bundle>('lab:code-editor:code', samples.hello)
  const [live, setLive] = useLocalStorage('lab:code-editor:live', true)
  const [sample, setSample] = useLocalStorage('lab:code-editor:sample', 'hello')
  const [runKey, setRunKey] = useState(0)
  const [frozenDoc, setFrozenDoc] = useState('')

  const liveDoc = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${code.css}</style></head><body>${code.html}<script>${code.js}<\/script></body></html>`,
    [code],
  )

  const srcDoc = live ? liveDoc : frozenDoc || liveDoc

  function run() {
    setFrozenDoc(liveDoc)
    setRunKey((k) => k + 1)
  }

  function loadSample(key: string) {
    setSample(key)
    setCode(samples[key]!)
    setFrozenDoc('')
    setRunKey((k) => k + 1)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={() => void copyText(code[tab])}>
            複製 {tab.toUpperCase()}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => downloadText('preview.html', liveDoc)}>
            下載 HTML
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {(['html', 'css', 'js'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn sm ${tab === t ? 'accent' : 'ghost'}`}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <select
          className="field"
          value={sample}
          style={{ width: 160 }}
          onChange={(e) => loadSample(e.target.value)}
        >
          <option value="hello">範例：Hello</option>
          <option value="card">範例：Card</option>
          <option value="counter">範例：Counter</option>
        </select>
        <button type="button" className={`btn sm ${live ? 'teal' : 'ghost'}`} onClick={() => setLive((v) => !v)}>
          {live ? '即時預覽 ON' : '即時預覽 OFF'}
        </button>
        {!live && (
          <button type="button" className="btn accent sm" onClick={run}>
            Run
          </button>
        )}
        <span className="tag">已持久化</span>
        <span className="muted" style={{ fontSize: 12 }}>
          run #{runKey}
        </span>
      </div>
      <div className="grid-2">
        <textarea
          className="field mono panel"
          style={{ minHeight: 360, fontSize: 13 }}
          value={code[tab]}
          maxLength={CODE_MAX}
          onChange={(e) => setCode((c) => ({ ...c, [tab]: limitText(e.target.value, CODE_MAX) }))}
          spellCheck={false}
        />
        <iframe
          key={live ? liveDoc : `${runKey}-${frozenDoc.slice(0, 20)}`}
          title="preview"
          className="panel"
          style={{ minHeight: 360, width: '100%', background: '#fff', border: 0 }}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
        />
      </div>
      <div className="field-meta" style={{ marginTop: 8 }}>
        <span className="field-hint">{tab.toUpperCase()} 字元上限</span>
        <span>
          {charCount(code[tab])} / {CODE_MAX.toLocaleString()}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        HTML／CSS／JS 分頁編輯，範例可一鍵載入，內容與分頁狀態會存到本機。
      </p>
    </ProjectShell>
  )
}
