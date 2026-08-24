import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'

const meta = getProject('code-editor')!

const SAMPLES: Record<string, { html: string; css: string; js: string }> = {
  hello: {
    html: '<h1 id="title">Hello Lab</h1>\n<button id="btn">點我</button>',
    css: 'body{font-family:system-ui;padding:24px}\nh1{color:#f0734a}\nbutton{padding:8px 14px;border-radius:8px;border:0;background:#1a2e28;color:#fff}',
    js: 'document.getElementById("btn").onclick=()=>{\n  document.getElementById("title").textContent="Clicked!"\n}',
  },
  card: {
    html: '<div class="card"><h2>Card</h2><p>預覽即時更新</p></div>',
    css: '.card{max-width:280px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#d4f0eb,#ffe0d4);box-shadow:0 8px 24px rgba(0,0,0,.08)}',
    js: '',
  },
}

export default function Page() {
  const [tab, setTab] = useLocalStorage<'html' | 'css' | 'js'>('lab:code-editor:tab', 'html')
  const [html, setHtml] = useLocalStorage('lab:code-editor:html', SAMPLES.hello!.html)
  const [css, setCss] = useLocalStorage('lab:code-editor:css', SAMPLES.hello!.css)
  const [js, setJs] = useLocalStorage('lab:code-editor:js', SAMPLES.hello!.js)

  const srcDoc = useMemo(
    () => `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}<\\/script></body></html>`,
    [html, css, js],
  )

  const value = tab === 'html' ? html : tab === 'css' ? css : js
  const setValue = tab === 'html' ? setHtml : tab === 'css' ? setCss : setJs

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['html', 'css', 'js'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn sm ${tab === t ? 'accent' : 'ghost'}`}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
        {Object.entries(SAMPLES).map(([k, s]) => (
          <button
            key={k}
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setHtml(s.html)
              setCss(s.css)
              setJs(s.js)
            }}
          >
            範例：{k}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <textarea
          className="field panel mono"
          style={{ minHeight: 380 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <iframe
          title="preview"
          className="panel"
          style={{ minHeight: 380, width: '100%', background: '#fff', border: 0 }}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
        />
      </div>
    </ProjectShell>
  )
}
