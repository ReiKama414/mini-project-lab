import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('api-monitor')!

type Probe = { at: number; ok: boolean; latency: number; note: string }
type Target = {
  id: string
  name: string
  url: string
  ok: boolean
  latency: number
  history: number[]
  lastNote: string
  checking?: boolean
}

async function probeUrl(url: string): Promise<Probe> {
  const at = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const t0 = performance.now()
    // Direct fetch first (works for CORS-friendly endpoints like httpbin)
    let res: Response | null = null
    let note = ''
    try {
      res = await fetch(url, { signal: controller.signal, mode: 'cors', cache: 'no-store' })
      note = `HTTP ${res.status}`
    } catch {
      // Fallback via allorigins proxy for demos
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${at}`
      res = await fetch(proxy, { signal: controller.signal, cache: 'no-store' })
      note = res.ok ? 'proxy OK' : `proxy ${res.status}`
    }
    const latency = Math.round(performance.now() - t0)
    clearTimeout(timer)
    return { at, ok: !!res && res.ok, latency, note }
  } catch (e) {
    clearTimeout(timer)
    return { at, ok: false, latency: 0, note: e instanceof Error ? e.message : 'error' }
  }
}

export default function Page() {
  const [targets, setTargets] = useLocalStorage<Target[]>('lab:api-monitor', [
    {
      id: '1',
      name: 'httpbin 200',
      url: 'https://httpbin.org/status/200',
      ok: true,
      latency: 0,
      history: [],
      lastNote: '尚未探測',
    },
    {
      id: '2',
      name: 'httpbin delay',
      url: 'https://httpbin.org/delay/1',
      ok: true,
      latency: 0,
      history: [],
      lastNote: '尚未探測',
    },
    {
      id: '3',
      name: 'example.com',
      url: 'https://example.com',
      ok: true,
      latency: 0,
      history: [],
      lastNote: '尚未探測',
    },
  ])
  const [url, setUrl] = useState('https://httpbin.org/get')
  const [name, setName] = useState('custom')
  const [auto, setAuto] = useLocalStorage('lab:api-monitor:auto', true)
  const [busy, setBusy] = useState(false)

  const checkOne = useCallback(
    async (id: string, targetUrl: string) => {
      setTargets((xs) => xs.map((t) => (t.id === id ? { ...t, checking: true } : t)))
      const result = await probeUrl(targetUrl)
      setTargets((xs) =>
        xs.map((t) =>
          t.id === id
            ? {
                ...t,
                checking: false,
                ok: result.ok,
                latency: result.latency,
                lastNote: result.note,
                history: [...t.history, result.latency || 0].slice(-24),
              }
            : t,
        ),
      )
    },
    [setTargets],
  )

  const checkAll = useCallback(async () => {
    setBusy(true)
    await Promise.all(targets.map((t) => checkOne(t.id, t.url)))
    setBusy(false)
  }, [targets, checkOne])

  useEffect(() => {
    if (!auto) return
    void checkAll()
    const id = setInterval(() => void checkAll(), 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  function add() {
    const u = url.trim()
    if (!u) return
    setTargets((xs) => [
      ...xs,
      { id: uid('t'), name: name.trim() || u, url: u, ok: true, latency: 0, history: [], lastNote: '尚未探測' },
    ])
    setUrl('https://')
  }

  const healthy = targets.filter((t) => t.ok).length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className={`btn sm ${auto ? 'teal' : 'ghost'}`} onClick={() => setAuto((v) => !v)}>
            {auto ? '自動探測 ON' : '自動探測 OFF'}
          </button>
          <button type="button" className="btn sm accent" disabled={busy} onClick={() => void checkAll()}>
            {busy ? '探測中…' : '立即探測'}
          </button>
        </div>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">Targets {targets.length}</div>
        <div className="metric panel">Healthy {healthy}</div>
        <div className="metric panel">Down {targets.length - healthy}</div>
      </div>

      <div className="panel row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="field" placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 120 }} />
        <input className="field mono" style={{ flex: 1, minWidth: 200 }} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn accent" onClick={add}>
          新增
        </button>
      </div>

      <div className="panel">
        <ul className="list">
          {targets.map((t) => {
            const max = Math.max(1, ...t.history, t.latency)
            return (
              <li key={t.id} className="list-item stack">
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{t.name}</strong>{' '}
                    <span className="tag" style={{ background: t.ok ? 'var(--teal)' : 'var(--rose)', color: '#fff' }}>
                      {t.checking ? '…' : t.ok ? 'OK' : 'FAIL'}
                    </span>
                    <div className="mono muted" style={{ fontSize: 12 }}>
                      {t.url}
                    </div>
                  </div>
                  <div className="row">
                    <span className="muted">{t.latency}ms · {t.lastNote}</span>
                    <button type="button" className="btn sm ghost" onClick={() => void checkOne(t.id, t.url)}>
                      Probe
                    </button>
                    <button type="button" className="btn sm danger" onClick={() => setTargets((xs) => xs.filter((x) => x.id !== t.id))}>
                      刪除
                    </button>
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'flex-end', height: 40, gap: 2 }}>
                  {t.history.map((v, i) => (
                    <div
                      key={i}
                      title={`${v}ms`}
                      style={{
                        flex: 1,
                        height: `${(v / max) * 100}%`,
                        minHeight: 2,
                        background: v === 0 ? 'var(--rose)' : 'var(--sky)',
                        borderRadius: 2,
                      }}
                    />
                  ))}
                  {!t.history.length && <span className="muted">尚無延遲歷史</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </ProjectShell>
  )
}
