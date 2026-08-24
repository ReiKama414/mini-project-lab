import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('code-editor')!

const snippets: Record<string, string> = {
  html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#e2e8f0">
  <h1>Hello Lab</h1>
  <button onclick="document.body.style.background='#134e4a'">換色</button>
</body>
</html>`,
  css: `body { margin: 0; font-family: Georgia, serif; }
.hero { padding: 48px; background: linear-gradient(120deg,#0ea5e9,#6366f1); color: #fff; }`,
  js: `const el = document.createElement('div')
el.textContent = 'JS 已執行 · ' + new Date().toLocaleTimeString()
el.style.cssText = 'padding:16px;font:16px monospace'
document.body.appendChild(el)`,
}

export default function Page() {
  const [tab, setTab] = useLocalStorage<'html' | 'css' | 'js'>('lab:code-editor:tab', 'html')
  const [code, setCode] = useLocalStorage('lab:code-editor:code', {
    html: snippets.html,
    css: snippets.css,
    js: snippets.js,
  })
  const [runKey, setRunKey] = useState(0)

  const srcDoc = useMemo(() => {
    void runKey
    return `<!DOCTYPE html><html><head><style>${code.css}</style></head><body>${code.html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') || code.html}<script>${code.js}<\/script></body></html>`
  }, [code, runKey])

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 8 }}>
        {(['html', 'css', 'js'] as const).map((t) => (
          <button key={t} type="button" className={`btn sm ${tab === t ? 'accent' : 'ghost'}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
        <button type="button" className="btn teal sm" onClick={() => setRunKey((k) => k + 1)}>
          Run
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setCode((c) => ({ ...c, [tab]: snippets[tab]! }))}>
          載入片段
        </button>
      </div>
      <div className="grid-2">
        <textarea
          className="field mono panel"
          style={{ minHeight: 360, fontSize: 13 }}
          value={code[tab]}
          onChange={(e) => setCode((c) => ({ ...c, [tab]: e.target.value }))}
          spellCheck={false}
        />
        <iframe title="preview" className="panel" style={{ minHeight: 360, width: '100%', background: '#fff', border: 0 }} srcDoc={srcDoc} sandbox="allow-scripts" />
      </div>
    </ProjectShell>
  )
}
