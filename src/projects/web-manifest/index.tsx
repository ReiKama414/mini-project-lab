import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import type { ProjectMeta } from '../registry'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const meta: ProjectMeta = getProject('web-manifest') ?? {
  slug: 'web-manifest',
  title: 'Web Manifest',
  description: '產生 PWA manifest.json。',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:web-manifest:name', 'My App')
  const [shortName, setShortName] = useLocalStorage('lab:web-manifest:short', 'App')
  const [startUrl, setStartUrl] = useLocalStorage('lab:web-manifest:start', '/')
  const [theme, setTheme] = useLocalStorage('lab:web-manifest:theme', '#2a9d8f')
  const [bg, setBg] = useLocalStorage('lab:web-manifest:bg', '#ffffff')
  const [display, setDisplay] = useLocalStorage('lab:web-manifest:display', 'standalone')
  const [copied, setCopied] = useState(false)

  const json = useMemo(
    () =>
      JSON.stringify(
        {
          name,
          short_name: shortName,
          start_url: startUrl,
          display,
          background_color: bg,
          theme_color: theme,
          icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
        },
        null,
        2,
      ),
    [name, shortName, startUrl, display, bg, theme],
  )

  const invalid = !isNonEmpty(name)

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          產生基本 PWA manifest 草稿。icons 為佔位路徑，請自行替換實際圖示與更多尺寸。
        </p>
        <div className="grid-2">
          <label className="stack">
            <span className="label">名稱</span>
            <input
              className={`field${invalid ? ' is-invalid' : ''}`}
              value={name}
              maxLength={80}
              onChange={(e) => setName(limitText(e.target.value, 80))}
            />
          </label>
          <label className="stack">
            <span className="label">短名稱</span>
            <input className="field" value={shortName} maxLength={24} onChange={(e) => setShortName(limitText(e.target.value, 24))} />
          </label>
          <label className="stack">
            <span className="label">start_url</span>
            <input className="field" value={startUrl} maxLength={120} onChange={(e) => setStartUrl(limitText(e.target.value, 120))} />
          </label>
          <label className="stack">
            <span className="label">display</span>
            <select className="field" value={display} onChange={(e) => setDisplay(e.target.value)}>
              <option value="standalone">standalone</option>
              <option value="fullscreen">fullscreen</option>
              <option value="minimal-ui">minimal-ui</option>
              <option value="browser">browser</option>
            </select>
          </label>
          <label className="stack">
            <span className="label">theme_color</span>
            <input type="color" value={theme} onChange={(e) => setTheme(e.target.value)} />
          </label>
          <label className="stack">
            <span className="label">background_color</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
          </label>
        </div>
        {invalid && <p className="field-error">請輸入名稱</p>}
        <div className="row">
          <button
            type="button"
            className="btn accent"
            disabled={invalid}
            onClick={async () => {
              await copyText(json)
              setCopied(true)
            }}
          >
            {copied ? '已複製' : '複製'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={invalid}
            onClick={() => downloadText('manifest.json', json, 'application/json')}
          >
            下載
          </button>
        </div>
        <pre className="metric mono" style={{ whiteSpace: 'pre-wrap' }}>
          {json}
        </pre>
      </div>
    </ProjectShell>
  )
}
