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
  status?: number
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
      lines.push(`**Response ${e.status || 200}**`, '', '```json', e.response, '```', '')
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

function toOpenApiJson(title: string, version: string, baseUrl: string, eps: Ep[]) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const e of eps) {
    if (!paths[e.path]) paths[e.path] = {}
    paths[e.path]![e.method.toLowerCase()] = {
      summary: e.summary,
      description: e.desc,
      operationId: `${e.method.toLowerCase()}${e.path.replace(/\W+/g, '_')}`,
      ...(e.body
        ? {
            requestBody: {
              content: { 'application/json': { example: tryParse(e.body) } },
            },
          }
        : {}),
      responses: {
        [String(e.status || 200)]: {
          description: 'OK',
          content: e.response ? { 'application/json': { example: tryParse(e.response) } } : undefined,
        },
      },
    }
  }
  return {
    openapi: '3.0.3',
    info: { title, version },
    servers: [{ url: baseUrl }],
    paths,
  }
}

function tryParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
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
      response: '{\n  "items": [{ "id": "u_1", "name": "Ada" }]\n}',
      status: 200,
    },
    {
      id: '2',
      method: 'POST',
      path: '/users',
      summary: 'Create user',
      desc: '建立使用者',
      body: '{\n  "name": "Ada"\n}',
      response: '{\n  "id": "u_1",\n  "name": "Ada"\n}',
      status: 201,
    },
    {
      id: '3',
      method: 'GET',
      path: '/users/{id}',
      summary: 'Get user',
      desc: '依 ID 取得使用者',
      response: '{\n  "id": "u_1",\n  "name": "Ada"\n}',
      status: 200,
    },
    {
      id: '4',
      method: 'DELETE',
      path: '/users/{id}',
      summary: 'Delete user',
      desc: '刪除使用者',
      response: '{\n  "ok": true\n}',
      status: 200,
    },
  ])
  const [sel, setSel] = useState(eps[0]?.id || '')
  const [copied, setCopied] = useState(false)
  const [tryResult, setTryResult] = useState<{ status: number; body: string; ms: number } | null>(null)
  const [tryBody, setTryBody] = useState('')

  const md = useMemo(() => toOpenApiMarkdown(title, version, baseUrl, eps), [title, version, baseUrl, eps])
  const openapi = useMemo(() => toOpenApiJson(title, version, baseUrl, eps), [title, version, baseUrl, eps])
  const current = eps.find((e) => e.id === sel) || eps[0]

  async function onCopy() {
    await copyText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  function update(id: string, patch: Partial<Ep>) {
    setEps((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  function tryIt() {
    if (!current) return
    const start = performance.now()
    const status = current.status || 200
    let body = current.response || '{ "ok": true }'
    if (tryBody.trim() && current.method !== 'GET' && current.method !== 'DELETE') {
      try {
        const req = JSON.parse(tryBody)
        const res = tryParse(body)
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          body = JSON.stringify({ ...res, echo: req }, null, 2)
        }
      } catch {
        /* keep default response */
      }
    }
    const ms = Math.round(8 + Math.random() * 40 + (performance.now() - start))
    setTryResult({ status, body, ms })
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" onClick={onCopy}>
            {copied ? '已複製' : '複製 Markdown'}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => downloadText('api-docs.md', md, 'text/markdown;charset=utf-8')}>
            下載 MD
          </button>
          <button
            type="button"
            className="btn sm teal"
            onClick={() => downloadText('openapi.json', JSON.stringify(openapi, null, 2), 'application/json;charset=utf-8')}
          >
            匯出 OpenAPI JSON
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
                setEps((xs) => [...xs, { id, method: 'GET', path: '/new', summary: 'New', desc: '說明', status: 200, response: '{ "ok": true }' }])
                setSel(id)
              }}
            >
              新增 endpoint
            </button>
          </div>
          <ul className="list">
            {eps.map((e) => (
              <li
                key={e.id}
                className="list-item"
                style={{ cursor: 'pointer', outline: current?.id === e.id ? '2px solid var(--accent)' : undefined }}
                onClick={() => {
                  setSel(e.id)
                  setTryBody(e.body || '')
                  setTryResult(null)
                }}
              >
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
                <input
                  className="field"
                  type="number"
                  title="status"
                  style={{ width: 80 }}
                  value={current.status || 200}
                  onChange={(e) => update(current.id, { status: Number(e.target.value) || 200 })}
                />
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
          <div className="label">Try it（模擬回應）</div>
          {current && (
            <>
              <div className="muted mono" style={{ fontSize: 12 }}>
                {current.method} {baseUrl.replace(/\/$/, '')}
                {current.path}
              </div>
              {(current.method === 'POST' || current.method === 'PUT' || current.method === 'PATCH') && (
                <textarea
                  className="field mono"
                  rows={4}
                  value={tryBody}
                  onChange={(e) => setTryBody(e.target.value)}
                  placeholder="request body"
                />
              )}
              <button type="button" className="btn accent" onClick={tryIt}>
                送出模擬請求
              </button>
              {tryResult && (
                <div className="stack" style={{ gap: 4 }}>
                  <div className="row">
                    <span className="tag" style={{ background: tryResult.status < 400 ? 'var(--teal-soft)' : 'var(--rose-soft)' }}>
                      {tryResult.status}
                    </span>
                    <span className="muted">{tryResult.ms} ms（模擬）</span>
                  </div>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, background: 'var(--bg-muted)', padding: 12, borderRadius: 8 }}>
                    {tryResult.body}
                  </pre>
                </div>
              )}
            </>
          )}
          <div className="label">OpenAPI-ish Markdown</div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 320, overflow: 'auto', fontSize: 12 }}>
            {md}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
