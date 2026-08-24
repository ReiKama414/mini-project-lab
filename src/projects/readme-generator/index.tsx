import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('readme-generator')!

type Sections = {
  badges: boolean
  install: boolean
  api: boolean
  license: boolean
  features: boolean
  stack: boolean
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:readme:name', 'awesome-project')
  const [desc, setDesc] = useLocalStorage('lab:readme:desc', 'A tiny tool that does one thing well.')
  const [stack, setStack] = useLocalStorage('lab:readme:stack', 'React, TypeScript, Vite')
  const [features, setFeatures] = useLocalStorage('lab:readme:features', '快速啟動\n本機儲存\n零設定')
  const [install, setInstall] = useLocalStorage('lab:readme:install', 'npm install\nnpm run dev')
  const [api, setApi] = useLocalStorage(
    'lab:readme:api',
    'GET /health — 健康檢查\nPOST /items — 建立項目',
  )
  const [license, setLicense] = useLocalStorage('lab:readme:license', 'MIT')
  const [sections, setSections] = useLocalStorage<Sections>('lab:readme:sections', {
    badges: true,
    install: true,
    api: false,
    license: true,
    features: true,
    stack: true,
  })
  const [copied, setCopied] = useState(false)

  const md = useMemo(() => {
    const lines: string[] = [`# ${name}`, '']
    if (sections.badges) {
      const enc = encodeURIComponent(name)
      lines.push(
        `![license](https://img.shields.io/badge/license-${encodeURIComponent(license)}-blue)`,
        `![stack](https://img.shields.io/badge/stack-${enc}-teal)`,
        '',
      )
    }
    lines.push(desc, '')
    if (sections.stack) {
      lines.push('## Stack', '', stack, '')
    }
    if (sections.features) {
      const feats = features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
        .map((f) => `- ${f}`)
        .join('\n')
      lines.push('## Features', '', feats || '- （尚未填寫）', '')
    }
    if (sections.install) {
      lines.push('## Getting Started', '', '```bash', install, '```', '')
    }
    if (sections.api) {
      const apiLines = api
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join('\n')
      lines.push('## API', '', apiLines || '- （尚未填寫）', '')
    }
    if (sections.license) {
      lines.push('## License', '', `${license}`, '')
    }
    return lines.join('\n')
  }, [name, desc, stack, features, install, api, license, sections])

  function toggle(key: keyof Sections) {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  async function onCopy() {
    await copyText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const sectionToggles: { key: keyof Sections; label: string }[] = [
    { key: 'badges', label: 'Badges' },
    { key: 'stack', label: 'Stack' },
    { key: 'features', label: 'Features' },
    { key: 'install', label: 'Install' },
    { key: 'api', label: 'API' },
    { key: 'license', label: 'License' },
  ]

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={onCopy}>
            {copied ? '已複製' : '複製'}
          </button>
          <button type="button" className="btn sm teal" onClick={() => downloadText('README.md', md, 'text/markdown;charset=utf-8')}>
            下載 README.md
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>
          區塊開關
        </span>
        {sectionToggles.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn sm ${sections[t.key] ? 'accent' : 'ghost'}`}
            onClick={() => toggle(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">專案名稱</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">簡介</label>
          <textarea className="field" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          {sections.stack && (
            <>
              <label className="label">技術棧</label>
              <input className="field" value={stack} onChange={(e) => setStack(e.target.value)} />
            </>
          )}
          {sections.features && (
            <>
              <label className="label">功能（每行一項）</label>
              <textarea className="field" rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} />
            </>
          )}
          {sections.install && (
            <>
              <label className="label">安裝指令</label>
              <textarea className="field mono" rows={3} value={install} onChange={(e) => setInstall(e.target.value)} />
            </>
          )}
          {sections.api && (
            <>
              <label className="label">API 說明（每行一項）</label>
              <textarea className="field mono" rows={3} value={api} onChange={(e) => setApi(e.target.value)} />
            </>
          )}
          {sections.license && (
            <>
              <label className="label">授權</label>
              <select className="field" value={license} onChange={(e) => setLicense(e.target.value)}>
                {['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'Unlicense'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="panel stack">
          <div className="label">即時預覽</div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 560, overflow: 'auto' }}>
            {md}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
