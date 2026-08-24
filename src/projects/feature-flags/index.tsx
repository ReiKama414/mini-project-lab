import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('feature-flags')!

type Env = 'dev' | 'staging' | 'prod'
type Flag = { id: string; key: string; on: boolean; pct: number; desc: string; env: Env }
type Audit = { id: string; at: number; key: string; action: string; detail: string }

const ENVS: Env[] = ['dev', 'staging', 'prod']

export default function Page() {
  const [flags, setFlags] = useLocalStorage<Flag[]>('lab:feature-flags', [
    { id: '1', key: 'new_checkout', on: true, pct: 100, desc: '新結帳流程', env: 'prod' },
    { id: '2', key: 'ai_suggest', on: false, pct: 20, desc: 'AI 建議面板', env: 'staging' },
    { id: '3', key: 'dark_mode_v2', on: true, pct: 50, desc: '深色主題 v2', env: 'dev' },
  ])
  const [audit, setAudit] = useLocalStorage<Audit[]>('lab:feature-flags:audit', [])
  const [envFilter, setEnvFilter] = useLocalStorage<Env | 'all'>('lab:feature-flags:env', 'all')
  const [newKey, setNewKey] = useLocalStorage('lab:feature-flags:draft-key', 'flag_new')

  function log(key: string, action: string, detail: string) {
    setAudit((xs) => [{ id: uid('a'), at: Date.now(), key, action, detail }, ...xs].slice(0, 80))
  }

  function addFlag() {
    const key = newKey.trim() || `flag_${flags.length + 1}`
    const f: Flag = { id: uid('f'), key, on: false, pct: 0, desc: '新功能', env: envFilter === 'all' ? 'dev' : envFilter }
    setFlags((xs) => [...xs, f])
    log(key, 'create', `env=${f.env}`)
  }

  const visible = flags.filter((f) => envFilter === 'all' || f.env === envFilter)

  return (
    <ProjectShell meta={meta}>
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>
          環境
        </span>
        {(['all', ...ENVS] as const).map((e) => (
          <button key={e} type="button" className={`btn sm ${envFilter === e ? 'accent' : 'ghost'}`} onClick={() => setEnvFilter(e)}>
            {e}
          </button>
        ))}
        <input className="field mono" value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ width: 140 }} />
        <button type="button" className="btn accent" onClick={addFlag}>
          新增 Flag
        </button>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <ul className="list">
            {visible.map((f) => (
              <li key={f.id} className="list-item stack">
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div>
                    <strong className="mono">{f.key}</strong> <span className="tag">{f.env}</span>
                    <div className="muted">{f.desc}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn sm ${f.on ? 'teal' : 'ghost'}`}
                    onClick={() => {
                      setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, on: !x.on } : x)))
                      log(f.key, f.on ? 'disable' : 'enable', `env=${f.env}`)
                    }}
                  >
                    {f.on ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="row">
                  <select
                    className="field"
                    value={f.env}
                    onChange={(e) => {
                      const env = e.target.value as Env
                      setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, env } : x)))
                      log(f.key, 'env', env)
                    }}
                    style={{ width: 120 }}
                  >
                    {ENVS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    value={f.desc}
                    onChange={(e) => setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, desc: e.target.value } : x)))}
                    style={{ flex: 1 }}
                  />
                </div>
                <label className="label">滾動釋出 {f.pct}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={f.pct}
                  disabled={!f.on}
                  onChange={(e) => {
                    const pct = Number(e.target.value)
                    setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, pct } : x)))
                    log(f.key, 'rollout', `${pct}%`)
                  }}
                />
                <div className="progress">
                  <div style={{ width: `${f.on ? f.pct : 0}%`, height: 6, borderRadius: 4, background: 'var(--accent)' }} />
                </div>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => {
                    setFlags((xs) => xs.filter((x) => x.id !== f.id))
                    log(f.key, 'delete', '')
                  }}
                >
                  刪除
                </button>
              </li>
            ))}
            {!visible.length && <li className="list-item muted">此環境尚無 flag</li>}
          </ul>
        </div>
        <div className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="label" style={{ margin: 0 }}>
              稽核紀錄
            </div>
            <button type="button" className="btn sm ghost" onClick={() => setAudit([])}>
              清空
            </button>
          </div>
          <ul className="list">
            {audit.map((a) => (
              <li key={a.id} className="list-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong className="mono">{a.key}</strong>
                  <span className="tag">{a.action}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.detail} · {new Date(a.at).toLocaleString('zh-TW')}
                </div>
              </li>
            ))}
            {!audit.length && <li className="list-item muted">尚無操作紀錄</li>}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
