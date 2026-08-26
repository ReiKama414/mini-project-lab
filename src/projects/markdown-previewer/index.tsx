import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { marked } from 'marked'
import { useLocalStorage } from '../../lib/storage'
import { charCount, limitText, copyText, downloadText } from '../../lib/utils'
import { sanitizeHtml } from '../../lib/sanitize'

const meta = getProject('markdown-previewer')!

const MD_MAX = 50_000

const TEMPLATES: Record<string, { label: string; body: string }> = {
  basic: {
    label: '基礎',
    body: `# Markdown 預覽

這是 **粗體** 與 *斜體*，還有 \`inline code\`。

## 清單
- 第一點
- 第二點

[連結範例](https://example.com)

---

> 引用區塊
`,
  },
  readme: {
    label: 'README',
    body: `# 專案名稱

簡短說明這個專案做什麼。

## 安裝

\`\`\`bash
npm install
npm run dev
\`\`\`

## 功能
1. 功能 A
2. 功能 B

## 授權
MIT
`,
  },
  note: {
    label: '筆記',
    body: `# 會議筆記

## 今日重點
- [ ] 待辦事項
- [x] 已完成

### 連結
請見 [文件](https://example.com/docs)

\`\`\`ts
const hello = 'world'
\`\`\`
`,
  },
}

function mdToHtml(src: string) {
  const raw = marked.parse(src, { async: false })
  return typeof raw === 'string' ? raw : String(raw)
}

export default function Page() {
  const [md, setMd] = useLocalStorage('lab:markdown-previewer:md', TEMPLATES.basic!.body)
  const html = useMemo(() => sanitizeHtml(mdToHtml(md)), [md])

  function exportHtml() {
    const doc = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"/><title>markdown-preview</title></head><body>${html}</body></html>`
    downloadText('preview.html', doc, 'text/html;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm ghost" onClick={exportHtml} disabled={!html}>
          匯出 HTML
        </button>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">範本</span>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button key={key} type="button" className="btn sm ghost" onClick={() => setMd(t.body)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="btn sm ghost" onClick={() => void copyText(md)}>
            複製 Markdown
          </button>
          <button type="button" className="btn sm ghost" onClick={exportHtml} disabled={!html}>
            匯出 HTML
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setMd('')}>
            清空
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          內容會自動儲存在本機。以 Marked 解析，輸出經消毒。
        </p>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <span className="label">編輯</span>
          <textarea
            className="field mono"
            rows={18}
            value={md}
            maxLength={MD_MAX}
            onChange={(e) => setMd(limitText(e.target.value, MD_MAX))}
            style={{ minHeight: 360 }}
          />
          <div className="field-meta">
            <span>{charCount(md).toLocaleString()} / {MD_MAX.toLocaleString()}</span>
          </div>
        </div>
        <div className="panel stack">
          <span className="label">預覽</span>
          <div
            className="stack"
            style={{ minHeight: 360, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </ProjectShell>
  )
}
