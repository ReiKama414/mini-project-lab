import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid } from '../../lib/utils'

const meta = getProject('api-docs-gen')!

type Ep = { id: string; method: string; path: string; desc: string; body?: string }

function toMarkdown(title: string, eps: Ep[]) {
  return `# ${title}\n\n${eps
    .map(
      (e) => `## \`${e.method} ${e.path}\`\n\n${e.desc}\n\n${e.body ? `\`\`\`json\n${e.body}\n\`\`\`\n` : ''}`,
    )
    .join('\n')}`
}

export default function Page() {
  const [title, setTitle] = useLocalStorage('lab:api-docs-gen:title', 'Demo API')
  const [eps, setEps] = useLocalStorage<Ep[]>('lab:api-docs-gen', [
    { id: '1', method: 'GET', path: '/users', desc: '取得使用者列表' },
    { id: '2', method: 'POST', path: '/users', desc: '建立使用者', body: '{\n  "name": "Ada"\n}' },
  ])

  const md = useMemo(() => toMarkdown(title, eps), [title, eps])

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setEps((xs) => [...xs, { id: uid('e'), method: 'GET', path: '/new', desc: '說明' }])}
          >
            新增 endpoint
          </button>
          {eps.map((e) => (
            <div key={e.id} className="list-item stack">
              <div className="row">
                <select className="field" value={e.method} onChange={(ev) => setEps((xs) => xs.map((x) => (x.id === e.id ? { ...x, method: ev.target.value } : x)))}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input className="field" style={{ flex: 1 }} value={e.path} onChange={(ev) => setEps((xs) => xs.map((x) => (x.id === e.id ? { ...x, path: ev.target.value } : x)))} />
              </div>
              <input className="field" value={e.desc} onChange={(ev) => setEps((xs) => xs.map((x) => (x.id === e.id ? { ...x, desc: ev.target.value } : x)))} />
              <textarea className="field mono" rows={3} placeholder="請求 body（可空）" value={e.body || ''} onChange={(ev) => setEps((xs) => xs.map((x) => (x.id === e.id ? { ...x, body: ev.target.value } : x)))} />
            </div>
          ))}
        </div>
        <div className="panel stack">
          <div className="row">
            <button type="button" className="btn sm ghost" onClick={() => copyText(md)}>
              複製
            </button>
            <button type="button" className="btn sm ghost" onClick={() => downloadText('api.md', md)}>
              下載
            </button>
          </div>
          <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {md}
          </pre>
        </div>
      </div>
    </ProjectShell>
  )
}
