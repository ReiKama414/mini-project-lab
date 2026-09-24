import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'web-manifest',
  title: 'Web Manifest',
  description: '產生基本 PWA manifest.json 草稿',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['design'],
}
const meta = getProject('web-manifest') ?? fallback

const SAMPLES = [
  {
    label: '本站',
    name: 'Mini Project Lab',
    shortName: 'Lab',
    startUrl: '/',
    theme: '#2a9d8f',
    bg: '#ffffff',
    display: 'standalone',
  },
  {
    label: '閱讀 App',
    name: '閱讀器',
    shortName: 'Read',
    startUrl: '/reader',
    theme: '#1d3557',
    bg: '#f1faee',
    display: 'standalone',
  },
  {
    label: '全螢幕遊戲',
    name: 'Demo Game',
    shortName: 'Game',
    startUrl: '/play',
    theme: '#e76f51',
    bg: '#264653',
    display: 'fullscreen',
  },
]

const DISPLAYS = ['standalone', 'fullscreen', 'minimal-ui', 'browser'] as const

export default function Page() {
  const [name, setName] = useLocalStorage('lab:web-manifest:name', SAMPLES[0]!.name)
  const [shortName, setShortName] = useLocalStorage('lab:web-manifest:short', SAMPLES[0]!.shortName)
  const [startUrl, setStartUrl] = useLocalStorage('lab:web-manifest:start', SAMPLES[0]!.startUrl)
  const [theme, setTheme] = useLocalStorage('lab:web-manifest:theme', SAMPLES[0]!.theme)
  const [bg, setBg] = useLocalStorage('lab:web-manifest:bg', SAMPLES[0]!.bg)
  const [display, setDisplay] = useLocalStorage('lab:web-manifest:display', SAMPLES[0]!.display)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

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

  async function copyVal(val: string, key: string) {
    if (invalid) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm ghost" disabled={invalid} onClick={() => void copyVal(json, 'out')} icon="copy">
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={invalid}
            onClick={() => downloadText('manifest.json', json, 'application/json')}
            icon="download"
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">{display}</span>
              {invalid && <span className="tag xc-tag-warn">需名稱</span>}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setName(s.name)
                    setShortName(s.shortName)
                    setStartUrl(s.startUrl)
                    setTheme(s.theme)
                    setBg(s.bg)
                    setDisplay(s.display)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">display</div>
            <div className="pw-chips">
              {DISPLAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`btn sm ${display === d ? 'accent' : 'ghost'}`}
                  onClick={() => setDisplay(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">欄位</h3>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
            {invalid && <p className="field-error">請輸入名稱</p>}
            <div className="grid-2">
              <label className="stack">
                <span className="label">名稱</span>
                <input
                  className={`field${invalid ? ' is-invalid' : ''}`}
                  value={name}
                  maxLength={80}
                  onChange={(e) => {
                    setName(limitText(e.target.value, 80))
                    setHint('')
                  }}
                />
              </label>
              <label className="stack">
                <span className="label">短名稱</span>
                <input
                  className="field"
                  value={shortName}
                  maxLength={24}
                  onChange={(e) => setShortName(limitText(e.target.value, 24))}
                />
              </label>
              <label className="stack">
                <span className="label">start_url</span>
                <input
                  className="field"
                  value={startUrl}
                  maxLength={120}
                  onChange={(e) => setStartUrl(limitText(e.target.value, 120))}
                />
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
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">manifest.json</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={invalid}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(json, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={invalid}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('manifest.json', json, 'application/json')}
                />
              </div>
            </div>
            <pre className="xc-pre mono" style={{ whiteSpace: 'pre-wrap' }}>
              {json}
            </pre>
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">用途</span>
              <strong>基本 PWA Web App Manifest 草稿，可放於站台根目錄並以 link rel=&quot;manifest&quot; 引用</strong>
            </li>
            <li>
              <span className="muted">icons</span>
              <strong>為佔位路徑；請自行替換實際圖示與更多尺寸（192／512 等）</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Favicon 產生器、Meta Tags、robots.txt</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
