import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('uptime-monitor')!

const URL_MAX = 2048

type Check = { at: number; ok: boolean; latency: number; note: string }
type Site = {
  id: string
  url: string
  status: 'up' | 'down' | 'checking' | 'unknown'
  latency: number
  lastCheck?: number
  history: Check[]
}

async function probe(url: string): Promise<Check> {
  const at = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    // Use allorigins to bypass CORS for demo checks
    const target = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${at}`
    const t0 = performance.now()
    const res = await fetch(target, { signal: controller.signal })
    const latency = Math.round(performance.now() - t0)
    clearTimeout(timer)
    if (!res.ok) return { at, ok: false, latency, note: `proxy ${res.status}` }
    const data = (await res.json()) as { status?: { http_code?: number }; contents?: string }
    const code = data.status?.http_code ?? (data.contents ? 200 : 0)
    const ok = code >= 200 && code < 400
    return { at, ok, latency, note: `HTTP ${code}` }
  } catch (e) {
    clearTimeout(timer)
    return {
      at,
      ok: false,
      latency: 0,
      note: e instanceof Error ? e.message : 'error',
    }
  }
}

export default function Page() {
  const [sites, setSites] = useLocalStorage<Site[]>('lab:uptime-monitor', [
    {
      id: '1',
      url: 'https://example.com',
      status: 'unknown',
      latency: 0,
      history: [],
    },
    {
      id: '2',
      url: 'https://httpbin.org/status/200',
      status: 'unknown',
      latency: 0,
      history: [],
    },
  ])
  const [url, setUrl] = useState('https://')
  const [checking, setChecking] = useState(false)
  const [auto, setAuto] = useLocalStorage('lab:uptime-monitor:auto', true)
  const [urlErr, setUrlErr] = useState('')
  const normalized = normalizeHttpUrl(url)
  const urlOk = isValidHttpUrl(normalized)
  const canAdd = urlOk && isNonEmpty(url)

  const checkOne = useCallback(async (id: string, targetUrl: string) => {
    setSites((xs) =>
      xs.map((s) => (s.id === id ? { ...s, status: 'checking' } : s)),
    )
    const result = await probe(targetUrl)
    setSites((xs) =>
      xs.map((s) =>
        s.id === id
          ? {
              ...s,
              status: result.ok ? 'up' : 'down',
              latency: result.latency,
              lastCheck: result.at,
              history: [result, ...s.history].slice(0, 20),
            }
          : s,
      ),
    )
  }, [setSites])

  const checkAll = useCallback(async () => {
    setChecking(true)
    await Promise.all(sites.map((s) => checkOne(s.id, s.url)))
    setChecking(false)
  }, [sites, checkOne])

  useEffect(() => {
    if (!auto) return
    void checkAll()
    const id = setInterval(() => void checkAll(), 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  const up = sites.filter((s) => s.status === 'up').length
  const down = sites.filter((s) => s.status === 'down').length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button className="btn ghost sm" onClick={() => void checkAll()} disabled={checking}>
          {checking ? '檢查中…' : '全部檢查'}
        </button>
      }
    >
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">站點 {sites.length}</div>
        <div className="metric panel">在線 {up}</div>
        <div className="metric panel">異常 {down}</div>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        透過公開 CORS proxy 實際請求目標 URL（示範用）。可自動每分鐘檢查。
      </p>
      <label className="row" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={auto} onChange={() => setAuto(!auto)} />
        自動輪詢（60 秒）
      </label>
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row">
          <input
            className={cn('field', !canAdd && 'is-invalid')}
            style={{ flex: 1 }}
            maxLength={URL_MAX}
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(limitText(e.target.value, URL_MAX))
              setUrlErr('')
            }}
            onBlur={() => {
              if (isNonEmpty(url) && urlOk) setUrl(normalized)
            }}
          />
          <button
            type="button"
            className="btn accent"
            disabled={!canAdd}
            onClick={() => {
              if (!urlOk) {
                setUrlErr('請輸入有效的 http(s) URL')
                return
              }
              const target = normalized
              const id = uid('s')
              setSites((xs) => [
                ...xs,
                { id, url: target, status: 'unknown', latency: 0, history: [] },
              ])
              setUrl('https://')
              setUrlErr('')
              void checkOne(id, target)
            }}
          >
            加入並檢查
          </button>
        </div>
        <div className="field-meta">
          <span className={!canAdd ? 'warn' : undefined}>{canAdd ? '可加入' : '需為 http 或 https URL'}</span>
          <span>{charCount(url)}/{URL_MAX}</span>
        </div>
        {urlErr && <p className="field-error">{urlErr}</p>}
      </div>
      <ul className="list panel">
        {sites.map((s) => {
          const uptime =
            s.history.length === 0
              ? '—'
              : `${((s.history.filter((h) => h.ok).length / s.history.length) * 100).toFixed(0)}%`
          return (
            <li key={s.id} className="list-item stack" style={{ alignItems: 'stretch' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <span
                    className="tag"
                    style={{
                      background:
                        s.status === 'up'
                          ? 'var(--teal-soft)'
                          : s.status === 'down'
                            ? 'var(--rose-soft)'
                            : 'var(--bg-muted)',
                    }}
                  >
                    {s.status.toUpperCase()}
                  </span>
                  <span className="mono">{s.url}</span>
                </div>
                <div className="row">
                  <span className="muted">{s.latency ? `${s.latency}ms` : '—'}</span>
                  <span className="tag">近 {s.history.length} 次成功率 {uptime}</span>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => void checkOne(s.id, s.url)}
                  >
                    檢查
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={() => setSites((xs) => xs.filter((x) => x.id !== s.id))}
                  >
                    移除
                  </button>
                </div>
              </div>
              {s.history[0] && (
                <p className="muted" style={{ fontSize: 12 }}>
                  上次：{new Date(s.history[0].at).toLocaleTimeString()} · {s.history[0].note}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </ProjectShell>
  )
}
