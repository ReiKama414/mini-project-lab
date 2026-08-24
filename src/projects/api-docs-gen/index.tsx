import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid } from '../../lib/utils'

const meta = getProject('api-docs-gen')!

type Ep = {
  id: string
  method: string
  path: string
  summary: string
  desc: string
  body?: string
  response?: string
}

function toOpenApiMarkdown(title: string, version: string, baseUrl: string, eps: Ep[]) {
  const lines = [
    `# ${title}`,
    '',
    `> OpenAPI-ish Markdown · version \`${version}\` · base \`${baseUrl}\``,
    '',
    '## Endpoints',
    '',
  ]
  for (const e of eps) {
    lines.push(`### \`${e.method} ${e.path}\``, '', `**Summary:** ${e.summary}`, '', e.desc, '')
    if (e.body) {
      lines.push('**Request body**', '', '```json', e.body, '```', '')
    }
    if (e.response) {
      lines.push('**Response 200**', '', '```json', e.response, '```', '')
    }
    lines.push('---', '')
  }
  lines.push('## Paths (YAML sketch)', '', '```yaml')
  for (const e of eps) {
    lines.push(`${e.path}:`)
    lines.push(`  ${e.method.toLowerCase()}:`)
    lines.push(`    summary: ${JSON.stringify(e.summary)}`)
    lines.push(`    operationId: ${e.method.toLowerCase()}${e.path.replace(/\W+/g, '_')}`)
  }
  lines.push('```', '')
  return lines.join('\n')
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:api-docs-gen:title', 'Demo API')
  const [version, setVersion] = useLocalStorage('lab:api-docs-gen:ver', '1.0.0')
  const [baseUrl, setBaseUrl] = useLocalStorage('lab:api-docs-gen:base', 'https://api.example.com')
  const [eps, setEps] = useLocalStorage<Ep[]>('lab:api-docs-gen', [
    {
      id: '1',
      method: 'GET',
      path: '/users',
      summary: 'List users',
      desc: '取得使用者列表',
      response: '{\n  "items": []\n}',
    },
    {
      id: '2',
      method: 'POST',
      path: '/users',
      summary: 'Create user',
      desc: '建立使用者',
      body: '{\n  "name": "Ada"\n}',
      response: '{\n  "id": "u_1"\n}',
    },
    {
      id: '3',
      method: 'GET',
      path: '/users/{id}',
      summary: 'Get user',
      desc: '依 ID 取得使用者',
      response: '{\n  "id": "u_1",\n  "name": "Ada"\n}',
    },
  ])
  const [sel, setSel] = useState(eps[0]?.id || '')
  const [copied, setCopied] = useState(false)

  const md = useMemo(() => toOpenApiMarkdown(title, version, baseUrl, eps), [title, version, baseUrl, eps])
  const current = eps.find((e) => e.id === sel) || eps[0]

  async function onCopy() {
    await copyText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  function update(id: string, patch: Partial<Ep>) {
    setEps((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={onCopy}>
            {copied ? '已複製' : '複製 Markdown'}
          </button>
          <button type="button" className="btn sm teal" onClick={() => downloadText('api-docs.md', md, 'text/markdown;charset=utf-8')}>
            下載
          </button>
        </div>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="API 標題" style={{ flex: 1 }} />
        <input className="field" value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: 100 }} />
        <input className="field mono" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <button
              type="button"
              className="btn accent sm"
              onClick={() => {
                const id = uid('e')
                setEps((xs) => [...xs, { id, method: 'GET', path: '/new', summary: 'New', desc: '說明' }])
                setSel(id)
              }}
            >
              新增 endpoint
            </button>
          </div>
          <ul className="list">
            {eps.map((e) => (
              <li key={e.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setSel(e.id)}>
                <span className="tag">{e.method}</span> <strong className="mono">{e.path}</strong>
                <div className="muted">{e.summary}</div>
              </li>
            ))}
          </ul>
          {current && (
            <div className="stack list-item">
              <div className="row">
                <select className="field" value={current.method} onChange={(e) => update(current.id, { method: e.target.value })} style={{ width: 110 }}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input className="field mono" style={{ flex: 1 }} value={current.path} onChange={(e) => update(current.id, { path: e.target.value })} />
              </div>
              <input className="field" value={current.summary} onChange={(e) => update(current.id, { summary: e.target.value })} placeholder="summary" />
              <textarea className="field" rows={2} value={current.desc} onChange={(e) => update(current.id, { desc: e.target.value })} />
              <textarea className="field mono" rows={3} placeholder="request body" value={current.body || ''} onChange={(e) => update(current.id, { body: e.target.value })} />
              <textarea className="field mono" rows={3} placeholder="response" value={current.response || ''} onChange={(e) => update(current.id, { response: e.target.value })} />
              <button type="button" className="btn sm danger" onClick={() => setEps((xs) => xs.filter((x) => x.id !== current.id))}>
                刪除
              </button>
            </div>
          )}
        </div>
        <div className="panel stack">
          <div className="label">OpenAPI-ish Markdown</div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 560, overflow: 'auto', fontSize: 12 }}>
            {md}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
