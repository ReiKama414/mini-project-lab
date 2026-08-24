import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('feature-flags')!

type Env = 'dev' | 'staging' | 'prod'
type Flag = {
  id: string
  key: string
  desc: string
  on: boolean
  pct: number
  env: Env
}
type Audit = { id: string; at: number; text: string }

export default function Page() {
  const [flags, setFlags] = useLocalStorage<Flag[]>('lab:feature-flags', [
    { id: '1', key: 'new_checkout', desc: '新結帳流程', on: true, pct: 100, env: 'prod' },
    { id: '2', key: 'ai_suggestions', desc: 'AI 建議面板', on: false, pct: 10, env: 'staging' },
    { id: '3', key: 'dark_mode', desc: '深色模式', on: true, pct: 50, env: 'dev' },
  ])
  const [audit, setAudit] = useLocalStorage<Audit[]>('lab:feature-flags:audit', [])
  const [envFilter, setEnvFilter] = useLocalStorage<Env | 'all'>('lab:feature-flags:env', 'all')
  const [key, setKey] = useLocalStorage('lab:feature-flags:newkey', '')
  const [desc, setDesc] = useLocalStorage('lab:feature-flags:newdesc', '')

  function log(text: string) {
    setAudit((a) => [{ id: uid('a'), at: Date.now(), text }, ...a].slice(0, 40))
  }

  const visible = flags.filter((f) => envFilter === 'all' || f.env === envFilter)

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['all', 'dev', 'staging', 'prod'] as const).map((e) => (
          <button
            key={e}
            type="button"
            className={`btn sm ${envFilter === e ? 'accent' : 'ghost'}`}
            onClick={() => setEnvFilter(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="flag_key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="說明"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <button
              type="button"
              className="btn accent"
              onClick={() => {
                if (!key.trim()) return
                const f: Flag = {
                  id: uid('f'),
                  key: key.trim(),
                  desc: desc.trim() || key.trim(),
                  on: false,
                  pct: 0,
                  env: 'dev',
                }
                setFlags((xs) => [f, ...xs])
                log(`建立 ${f.key}`)
                setKey('')
                setDesc('')
              }}
            >
              新增
            </button>
          </div>
          <ul className="list">
            {visible.map((f) => (
              <li key={f.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <strong className="mono">{f.key}</strong>
                    <div className="muted">{f.desc}</div>
                  </div>
                  <select
                    className="field"
                    style={{ width: 110 }}
                    value={f.env}
                    onChange={(e) => {
                      const env = e.target.value as Env
                      setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, env } : x)))
                      log(`${f.key} → env ${env}`)
                    }}
                  >
                    <option value="dev">dev</option>
                    <option value="staging">staging</option>
                    <option value="prod">prod</option>
                  </select>
                  <button
                    type="button"
                    className={`btn sm ${f.on ? 'teal' : 'ghost'}`}
                    onClick={() => {
                      setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, on: !x.on } : x)))
                      log(`${f.key} ${f.on ? 'OFF' : 'ON'}`)
                    }}
                  >
                    {f.on ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      setFlags((xs) => xs.filter((x) => x.id !== f.id))
                      log(`刪除 ${f.key}`)
                    }}
                  >
                    刪
                  </button>
                </div>
                <label className="label">流量比例 {f.pct}%</label>
                <input
                  className="field"
                  type="range"
                  min={0}
                  max={100}
                  value={f.pct}
                  disabled={!f.on}
                  onChange={(e) => {
                    const pct = +e.target.value
                    setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, pct } : x)))
                  }}
                  onMouseUp={(e) => log(`${f.key} rollout ${(e.target as HTMLInputElement).value}%`)}
                />
                <div className="progress">
                  <span style={{ width: `${f.on ? f.pct : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <h3>操作紀錄</h3>
          <ul className="list">
            {audit.map((a) => (
              <li key={a.id} className="list-item">
                <span className="muted" style={{ width: 90 }}>
                  {new Date(a.at).toLocaleTimeString()}
                </span>
                <span style={{ flex: 1 }}>{a.text}</span>
              </li>
            ))}
            {!audit.length && <p className="muted">尚無紀錄</p>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
