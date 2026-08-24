import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText } from '../../lib/utils'

const meta = getProject('markdown-previewer')!

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

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function mdToHtml(src: string) {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  let inUl = false
  let inOl = false
  let inCode = false
  let codeLang = ''
  let codeBuf: string[] = []

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
  }

  const inline = (t: string) =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  while (i < lines.length) {
    const line = lines[i]!

    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre class="mono"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        inCode = false
        codeBuf = []
        codeLang = ''
      } else {
        closeLists()
        inCode = true
        codeLang = line.slice(3).trim()
        void codeLang
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    if (/^---+$/.test(line.trim())) {
      closeLists()
      out.push('<hr/>')
      i++
      continue
    }

    const h = /^(#{1,3})\s+(.+)$/.exec(line)
    if (h) {
      closeLists()
      const level = h[1]!.length
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`)
      i++
      continue
    }

    if (/^>\s?/.test(line)) {
      closeLists()
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
      i++
      continue
    }

    const ul = /^[-*]\s+(.+)$/.exec(line)
    if (ul) {
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        out.push('<ul>')
        inUl = true
      }
      out.push(`<li>${inline(ul[1]!)}</li>`)
      i++
      continue
    }

    const ol = /^\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li>${inline(ol[1]!)}</li>`)
      i++
      continue
    }

    if (!line.trim()) {
      closeLists()
      i++
      continue
    }

    closeLists()
    out.push(`<p>${inline(line)}</p>`)
    i++
  }
  closeLists()
  if (inCode) {
    out.push(`<pre class="mono"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  return out.join('\n')
}

export default function Page() {
  const [md, setMd] = useLocalStorage('lab:markdown-previewer:md', TEMPLATES.basic!.body)
  const html = useMemo(() => mdToHtml(md), [md])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">範本</span>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <button key={key} className="btn sm ghost" onClick={() => setMd(t.body)}>
              {t.label}
            </button>
          ))}
          <button className="btn sm ghost" onClick={() => void copyText(md)}>
            複製 Markdown
          </button>
          <button className="btn sm ghost" onClick={() => setMd('')}>
            清空
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          內容會自動儲存在本機。支援標題、清單、程式碼區塊、連結、分隔線、引用。
        </p>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <span className="label">編輯</span>
          <textarea
            className="field mono"
            rows={18}
            value={md}
            onChange={(e) => setMd(e.target.value)}
            style={{ minHeight: 360 }}
          />
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
