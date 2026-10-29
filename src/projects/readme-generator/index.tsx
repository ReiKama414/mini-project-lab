import { PortfolioLayout } from '../../components/PortfolioLayout'
import { FtSection } from '../../components/FeatureToolUI'
import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { useLocalStorage } from '../../lib/storage'
import { sanitizeHtml } from '../../lib/sanitize'
import {
  copyText,
  downloadText,
  limitText,
  charCount,
  isNonEmpty,
  cn,
} from '../../lib/utils'
import { ActionButton } from '../../components/ActionButton'

const NAME_MAX = 120
const DESC_MAX = 500
const STACK_MAX = 200
const FEATURES_MAX = 3000
const INSTALL_MAX = 2000
const API_MAX = 3000
const REPO_MAX = 200

type Sections = {
  badges: boolean
  install: boolean
  api: boolean
  license: boolean
  features: boolean
  stack: boolean
}

type TemplateKey = 'lib' | 'app' | 'api' | 'blank'

const TEMPLATES: Record<
  TemplateKey,
  { label: string; hint: string; apply: () => Partial<{
    name: string
    desc: string
    stack: string
    features: string
    install: string
    api: string
    license: string
    sections: Sections
  }> }
> = {
  lib: {
    label: '開源函式庫',
    hint: 'npm 套件 README',
    apply: () => ({
      name: 'my-awesome-lib',
      desc: '輕量工具函式庫，專注單一用途、零設定整合。',
      stack: 'TypeScript, Vitest, tsup',
      features: 'Tree-shakable 匯出\n完整型別定義\n零相依（runtime）',
      install: 'npm install my-awesome-lib\n# 或\npnpm add my-awesome-lib',
      api: 'import { hello } from "my-awesome-lib"\nhello(name: string) => string',
      license: 'MIT',
      sections: { badges: true, stack: true, features: true, install: true, api: true, license: true },
    }),
  },
  app: {
    label: '前端 App',
    hint: 'Vite / React 專案',
    apply: () => ({
      name: 'my-app',
      desc: '以 React 打造的示範應用，含本機開發與正式建置流程。',
      stack: 'React, TypeScript, Vite',
      features: '響應式版面\n本機優先設定\n一鍵部署靜態站',
      install: 'git clone https://github.com/you/my-app.git\ncd my-app\nnpm install\nnpm run dev',
      license: 'MIT',
      sections: { badges: true, stack: true, features: true, install: true, api: false, license: true },
    }),
  },
  api: {
    label: 'API 服務',
    hint: 'REST 端點說明',
    apply: () => ({
      name: 'my-api',
      desc: 'HTTP API 服務，提供健康檢查與資源 CRUD 示範。',
      stack: 'Node.js, Express, PostgreSQL',
      features: 'JWT 驗證（示範）\nOpenAPI 草稿\nDocker Compose 本機環境',
      install: 'cp .env.example .env\nnpm install\nnpm run dev',
      api: 'GET /health — 服務狀態\nGET /v1/items — 列表\nPOST /v1/items — 建立',
      license: 'Apache-2.0',
      sections: { badges: true, stack: true, features: true, install: true, api: true, license: true },
    }),
  },
  blank: {
    label: '空白',
    hint: '只留標題與簡介',
    apply: () => ({
      name: 'project-name',
      desc: '在此寫一句話說明專案。',
      stack: '',
      features: '',
      install: 'npm install',
      api: '',
      license: 'MIT',
      sections: { badges: false, stack: false, features: false, install: true, api: false, license: true },
    }),
  },
}

const SECTION_TOGGLES: { key: keyof Sections; label: string }[] = [
  { key: 'badges', label: '徽章' },
  { key: 'stack', label: '技術棧' },
  { key: 'features', label: '功能' },
  { key: 'install', label: '安裝' },
  { key: 'api', label: 'API' },
  { key: 'license', label: '授權' },
]

function buildMarkdown(
  name: string,
  desc: string,
  stack: string,
  features: string,
  install: string,
  api: string,
  license: string,
  repoUrl: string,
  sections: Sections,
): string {
  const lines: string[] = [`# ${name}`, '']
  if (isNonEmpty(repoUrl)) {
    lines.push(`[Repository](${repoUrl.trim()})`, '')
  }
  if (sections.badges) {
    const lic = encodeURIComponent(license)
    const stackBadge = encodeURIComponent(stack.slice(0, 40) || 'stack')
    lines.push(
      `![license](https://img.shields.io/badge/license-${lic}-blue)`,
      `![stack](https://img.shields.io/badge/stack-${stackBadge}-teal)`,
      '',
    )
  }
  lines.push(desc, '')
  if (sections.stack && isNonEmpty(stack)) {
    lines.push('## 技術棧', '', stack, '')
  }
  if (sections.features) {
    const feats = features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => `- ${f}`)
      .join('\n')
    lines.push('## 功能', '', feats || '- （尚未填寫）', '')
  }
  if (sections.install) {
    lines.push('## 快速開始', '', '```bash', install, '```', '')
  }
  if (sections.api) {
    const apiLines = api
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith('-') ? l : `- ${l}`))
      .join('\n')
    lines.push('## API', '', apiLines || '- （尚未填寫）', '')
  }
  if (sections.license) {
    lines.push('## 授權', '', license, '')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export default function Page() {
  const [name, setName] = useLocalStorage('lab:readme:name', 'awesome-project')
  const [desc, setDesc] = useLocalStorage('lab:readme:desc', 'A tiny tool that does one thing well.')
  const [repoUrl, setRepoUrl] = useLocalStorage('lab:readme:repo', '')
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
  const [previewMode, setPreviewMode] = useState<'source' | 'render'>('render')
  const [copied, setCopied] = useState(false)

  const md = useMemo(
    () => buildMarkdown(name, desc, stack, features, install, api, license, repoUrl, sections),
    [name, desc, stack, features, install, api, license, repoUrl, sections],
  )

  const html = useMemo(() => sanitizeHtml(marked.parse(md, { async: false, gfm: true, breaks: false }) as string), [md])

  const enabledSections = useMemo(() => Object.values(sections).filter(Boolean).length, [sections])
  const lineCount = md.split('\n').length

  function toggle(key: keyof Sections) {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  function applyTemplate(key: TemplateKey) {
    const t = TEMPLATES[key].apply()
    if (t.name != null) setName(t.name)
    if (t.desc != null) setDesc(t.desc)
    if (t.stack != null) setStack(t.stack)
    if (t.features != null) setFeatures(t.features)
    if (t.install != null) setInstall(t.install)
    if (t.api != null) setApi(t.api)
    if (t.license != null) setLicense(t.license)
    if (t.sections != null) setSections(t.sections)
  }

  async function onCopy() {
    await copyText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <PortfolioLayout
      slug="readme-generator"
      heroSubtitle="表單組裝 GitHub 風格 README，可複製或下載"
      footerHint="徽章為 shields.io 範本，上線前請改成真實 repo · 表單存本機"
      extraInfo={[
        { label: '輸出', value: `${charCount(md)} 字 · ${lineCount} 行` },
        { label: '啟用區塊', value: `${enabledSections} / ${SECTION_TOGGLES.length}` },
      ]}
      metrics={[
        { label: '專案名', value: isNonEmpty(name) ? name : '（未填）', mono: true },
        { label: '字數', value: charCount(md) },
        { label: '區塊', value: enabledSections },
        { label: '授權', value: license },
      ]}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" onClick={onCopy} icon="copy">
            {copied ? '已複製' : '複製 Markdown'}
          </ActionButton>
          <button
            type="button"
            className="btn sm teal"
            onClick={() => downloadText('README.md', md, 'text/markdown;charset=utf-8')}
          >
            下載 README.md
          </button>
        </div>
      }
    >
      <FtSection title="範本" hint="一鍵帶入常見結構，仍可再改欄位。">
        <div className="panel rdg-templates">
          {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="btn sm ghost rdg-template-btn"
              onClick={() => applyTemplate(key)}
            >
              <span className="rdg-template-label">{TEMPLATES[key].label}</span>
              <span className="muted rdg-template-hint">{TEMPLATES[key].hint}</span>
            </button>
          ))}
        </div>
      </FtSection>

      <div className="rdg-layout">
        <FtSection title="內容" hint="關閉區塊後對應欄位會隱藏，預覽同步更新。">
          <div className="panel stack rdg-form">
            <div className="rdg-section-bar">
              <span className="rdg-section-bar-label">區塊</span>
              {SECTION_TOGGLES.map((t) => (
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

            <label className="label" htmlFor="rdg-name">
              專案名稱
            </label>
            <input
              id="rdg-name"
              className={cn('field', !isNonEmpty(name) && 'is-invalid')}
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(limitText(e.target.value, NAME_MAX))}
            />
            <div className="field-meta">
              <span className={!isNonEmpty(name) ? 'warn' : undefined}>
                {isNonEmpty(name) ? '作為 H1 標題' : '請填專案名稱'}
              </span>
              <span>
                {charCount(name)}/{NAME_MAX}
              </span>
            </div>

            <label className="label" htmlFor="rdg-desc">
              簡介
            </label>
            <textarea
              id="rdg-desc"
              className="field"
              rows={3}
              maxLength={DESC_MAX}
              value={desc}
              onChange={(e) => setDesc(limitText(e.target.value, DESC_MAX))}
            />
            <div className="field-meta">
              <span className="field-hint">一段話，放在標題下方</span>
              <span>
                {charCount(desc)}/{DESC_MAX}
              </span>
            </div>

            <label className="label" htmlFor="rdg-repo">
              Repository 連結（選填）
            </label>
            <input
              id="rdg-repo"
              className="field mono"
              maxLength={REPO_MAX}
              placeholder="https://github.com/you/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(limitText(e.target.value, REPO_MAX))}
            />
            <div className="field-meta">
              <span className="field-hint">顯示在標題下，不影響徽章 URL</span>
              <span>
                {charCount(repoUrl)}/{REPO_MAX}
              </span>
            </div>

            {sections.stack && (
              <>
                <label className="label" htmlFor="rdg-stack">
                  技術棧
                </label>
                <input
                  id="rdg-stack"
                  className="field"
                  maxLength={STACK_MAX}
                  value={stack}
                  onChange={(e) => setStack(limitText(e.target.value, STACK_MAX))}
                />
                <div className="field-meta">
                  <span className="field-hint">逗號或自然語句皆可</span>
                  <span>
                    {charCount(stack)}/{STACK_MAX}
                  </span>
                </div>
              </>
            )}

            {sections.features && (
              <>
                <label className="label" htmlFor="rdg-features">
                  功能（每行一項）
                </label>
                <textarea
                  id="rdg-features"
                  className="field"
                  rows={4}
                  maxLength={FEATURES_MAX}
                  value={features}
                  onChange={(e) => setFeatures(limitText(e.target.value, FEATURES_MAX))}
                />
                <div className="field-meta">
                  <span className="field-hint">輸出為 Markdown 清單</span>
                  <span>
                    {charCount(features)}/{FEATURES_MAX}
                  </span>
                </div>
              </>
            )}

            {sections.install && (
              <>
                <label className="label" htmlFor="rdg-install">
                  安裝／啟動指令
                </label>
                <textarea
                  id="rdg-install"
                  className="field mono"
                  rows={4}
                  maxLength={INSTALL_MAX}
                  value={install}
                  onChange={(e) => setInstall(limitText(e.target.value, INSTALL_MAX))}
                />
                <div className="field-meta">
                  <span className="field-hint">包在 bash 程式碼區塊</span>
                  <span>
                    {charCount(install)}/{INSTALL_MAX}
                  </span>
                </div>
              </>
            )}

            {sections.api && (
              <>
                <label className="label" htmlFor="rdg-api">
                  API 說明（每行一項）
                </label>
                <textarea
                  id="rdg-api"
                  className="field mono"
                  rows={4}
                  maxLength={API_MAX}
                  value={api}
                  onChange={(e) => setApi(limitText(e.target.value, API_MAX))}
                />
                <div className="field-meta">
                  <span className="field-hint">可寫 method path — 說明</span>
                  <span>
                    {charCount(api)}/{API_MAX}
                  </span>
                </div>
              </>
            )}

            {sections.license && (
              <>
                <label className="label" htmlFor="rdg-license">
                  授權
                </label>
                <select
                  id="rdg-license"
                  className="field"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                >
                  {['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'Unlicense'].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </FtSection>

        <FtSection title="預覽" hint="「渲染」近似 GitHub 閱讀效果；「原始」為將複製的 Markdown。">
          <div className="panel stack rdg-preview">
            <div className="rdg-preview-tabs">
              <button
                type="button"
                className={`btn sm ${previewMode === 'render' ? 'accent' : 'ghost'}`}
                onClick={() => setPreviewMode('render')}
              >
                渲染
              </button>
              <button
                type="button"
                className={`btn sm ${previewMode === 'source' ? 'accent' : 'ghost'}`}
                onClick={() => setPreviewMode('source')}
              >
                原始 Markdown
              </button>
            </div>
            <div className="rdg-preview-body panel">
              {previewMode === 'source' ? (
                <pre className="mono rdg-source">{md}</pre>
              ) : (
                <div className="mdp-prose" dangerouslySetInnerHTML={{ __html: html }} />
              )}
            </div>
          </div>
        </FtSection>
      </div>
    </PortfolioLayout>
  )
}
