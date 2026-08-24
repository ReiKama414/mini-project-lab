import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { downloadText, uid, limitText, isNonEmpty } from '../../lib/utils'

const meta = getProject('feature-flags')!

const KEY_MAX = 64
const USER_MAX = 80

type Env = 'dev' | 'staging' | 'prod'
type Flag = { id: string; key: string; on: boolean; pct: number; desc: string; env: Env }
type Audit = { id: string; at: number; key: string; action: string; detail: string }

const ENVS: Env[] = ['dev', 'staging', 'prod']

function hashUser(userId: string, flagKey: string) {
  const s = `${userId}:${flagKey}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  return h % 100
}

export default function Page() {
  const [flags, setFlags] = useLocalStorage<Flag[]>('lab:feature-flags', [
    { id: '1', key: 'new_checkout', on: true, pct: 100, desc: '新結帳流程', env: 'prod' },
    { id: '2', key: 'ai_suggest', on: false, pct: 20, desc: 'AI 建議面板', env: 'staging' },
    { id: '3', key: 'dark_mode_v2', on: true, pct: 50, desc: '深色主題 v2', env: 'dev' },
    { id: '4', key: 'beta_nav', on: true, pct: 10, desc: '實驗導覽', env: 'dev' },
  ])
  const [audit, setAudit] = useLocalStorage<Audit[]>('lab:feature-flags:audit', [])
  const [envFilter, setEnvFilter] = useLocalStorage<Env | 'all'>('lab:feature-flags:env', 'all')
  const [newKey, setNewKey] = useLocalStorage('lab:feature-flags:draft-key', 'flag_new')
  const [evalUser, setEvalUser] = useLocalStorage('lab:feature-flags:eval-user', 'user_42')
  const [evalEnv, setEvalEnv] = useLocalStorage<Env>('lab:feature-flags:eval-env', 'prod')

  function log(key: string, action: string, detail: string) {
    setAudit((xs) => [{ id: uid('a'), at: Date.now(), key, action, detail }, ...xs].slice(0, 100))
  }

  function addFlag() {
    const key = newKey.trim() || `flag_${flags.length + 1}`
    const f: Flag = { id: uid('f'), key, on: false, pct: 0, desc: '新功能', env: envFilter === 'all' ? 'dev' : envFilter }
    setFlags((xs) => [...xs, f])
    log(key, 'create', `env=${f.env}`)
  }

  function isEnabled(f: Flag, userId: string) {
    if (!f.on) return false
    if (f.pct >= 100) return true
    if (f.pct <= 0) return false
    return hashUser(userId, f.key) < f.pct
  }

  const visible = flags.filter((f) => envFilter === 'all' || f.env === envFilter)

  const evalResults = useMemo(() => {
    return flags
      .filter((f) => f.env === evalEnv)
      .map((f) => ({
        key: f.key,
        bucket: hashUser(evalUser, f.key),
        enabled: isEnabled(f, evalUser),
        pct: f.pct,
        on: f.on,
      }))
  }, [flags, evalEnv, evalUser])

  function exportAudit() {
    downloadText(
      'feature-flags-audit.json',
      JSON.stringify({ exportedAt: new Date().toISOString(), audit }, null, 2),
      'application/json;charset=utf-8',
    )
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm ghost" onClick={exportAudit} disabled={!audit.length}>
          匯出稽核
        </button>
      }
    >
      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>
          環境
        </span>
        {(['all', ...ENVS] as const).map((e) => (
          <button key={e} type="button" className={`btn sm ${envFilter === e ? 'accent' : 'ghost'}`} onClick={() => setEnvFilter(e)}>
            {e}
          </button>
        ))}
        <input className="field mono" maxLength={KEY_MAX}
            value={newKey} onChange={(e) => setNewKey(limitText(e.target.value.replace(/[^a-zA-Z0-9_.:-]/g, ''), KEY_MAX))} style={{ width: 140 }} />
        <button type="button" className="btn accent" onClick={addFlag} disabled={!isNonEmpty(newKey)}>
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
                <label className="label">百分比滾動釋出 {f.pct}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={f.pct}
                  disabled={!f.on}
                  onChange={(e) => {
                    const pct = Number(e.target.value)
                    setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, pct } : x)))
                  }}
                  onMouseUp={(e) => log(f.key, 'rollout', `${(e.target as HTMLInputElement).value}%`)}
                  onTouchEnd={(e) => log(f.key, 'rollout', `${(e.target as HTMLInputElement).value}%`)}
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
          <div className="label">評估模擬</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="field mono" maxLength={USER_MAX}
            value={evalUser} onChange={(e) => setEvalUser(limitText(e.target.value, USER_MAX))} placeholder="user id" style={{ flex: 1 }} />
            <select className="field" value={evalEnv} onChange={(e) => setEvalEnv(e.target.value as Env)} style={{ width: 120 }}>
              {ENVS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <ul className="list">
            {evalResults.map((r) => (
              <li key={r.key} className="list-item row" style={{ justifyContent: 'space-between' }}>
                <span className="mono">{r.key}</span>
                <span>
                  <span className="muted" style={{ marginRight: 8 }}>
                    bucket {r.bucket} / {r.pct}%
                  </span>
                  <span className="tag">{r.enabled ? '啟用' : '關閉'}</span>
                </span>
              </li>
            ))}
            {!evalResults.length && <li className="list-item muted">此環境無 flag</li>}
          </ul>

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
