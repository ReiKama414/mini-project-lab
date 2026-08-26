import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { AddButton } from '../../components/AddButton'
import { DeleteButton } from '../../components/DeleteButton'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, limitText, charCount, isNonEmpty, isValidHttpUrl, normalizeHttpUrl, cn } from '../../lib/utils'

const meta = getProject('api-monitor')!

const URL_MAX = 2048
const NAME_MAX = 80

type Probe = { at: number; ok: boolean; latency: number; note: string }
type HistRow = { id: string; targetId: string; name: string; url: string; at: number; ok: boolean; latency: number; note: string }
type Target = {
  id: string
  name: string
  url: string
  ok: boolean
  latency: number
  history: number[]
  lastNote: string
  lastCheck?: number
  checking?: boolean
}

async function probeUrl(url: string): Promise<Probe> {
  const at = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const t0 = performance.now()
    let res: Response | null = null
    let note = ''
    try {
      res = await fetch(url, { signal: controller.signal, mode: 'cors', cache: 'no-store' })
      note = `HTTP ${res.status}`
    } catch {
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
  const [table, setTable] = useLocalStorage<HistRow[]>('lab:api-monitor:table', [])
  const [url, setUrl] = useState('https://httpbin.org/get')
  const [name, setName] = useState('custom')
  const [formErr, setFormErr] = useState('')
  const [auto, setAuto] = useLocalStorage('lab:api-monitor:auto', true)
  const [busy, setBusy] = useState(false)

  const checkOne = useCallback(
    async (id: string, targetUrl: string, targetName: string) => {
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
                lastCheck: result.at,
                history: [...t.history, result.latency || 0].slice(-24),
              }
            : t,
        ),
      )
      setTable((rows) =>
        [
          {
            id: uid('h'),
            targetId: id,
            name: targetName,
            url: targetUrl,
            at: result.at,
            ok: result.ok,
            latency: result.latency,
            note: result.note,
          },
          ...rows,
        ].slice(0, 80),
      )
    },
    [setTargets, setTable],
  )

  const checkAll = useCallback(async () => {
    setBusy(true)
    await Promise.all(targets.map((t) => checkOne(t.id, t.url, t.name)))
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
    const u = normalizeHttpUrl(url)
    if (!isValidHttpUrl(u) || !isNonEmpty(name)) {
      setFormErr(!isNonEmpty(name) ? '請輸入名稱' : '請輸入有效的 http(s) URL')
      return
    }
    setTargets((xs) => [
      ...xs,
      {
        id: uid('t'),
        name: limitText(name.trim(), NAME_MAX),
        url: u,
        ok: true,
        latency: 0,
        history: [],
        lastNote: '尚未探測',
      },
    ])
    setUrl('https://')
    setFormErr('')
  }

  const healthy = targets.filter((t) => t.ok).length
  const normalized = normalizeHttpUrl(url)
  const urlOk = isValidHttpUrl(normalized)
  const canAdd = urlOk && isNonEmpty(name)

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
      <p className="muted panel" style={{ marginBottom: 12, fontSize: 13 }}>
        本機示範／proxy 限制：優先直接 CORS 請求；失敗時改經公開 CORS proxy（allorigins）。延遲可能含代理往返，非正式 API 監控服務。自動探測約 30 秒一次。
      </p>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="metric panel">Targets {targets.length}</div>
        <div className="metric panel">Healthy {healthy}</div>
        <div className="metric panel">Down {targets.length - healthy}</div>
      </div>

      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className={cn('field', !isNonEmpty(name) && 'is-invalid')}
            placeholder="名稱"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => {
              setName(limitText(e.target.value, NAME_MAX))
              setFormErr('')
            }}
            style={{ width: 120 }}
          />
          <input
            className={cn('field mono', !urlOk && 'is-invalid')}
            style={{ flex: 1, minWidth: 200 }}
            maxLength={URL_MAX}
            value={url}
            onChange={(e) => {
              setUrl(limitText(e.target.value, URL_MAX))
              setFormErr('')
            }}
            onBlur={() => {
              if (urlOk) setUrl(normalized)
            }}
          />
          <AddButton type="button"  onClick={add} disabled={!canAdd}>
            新增</AddButton>
        </div>
        <div className="field-meta">
          <span className={!canAdd ? 'warn' : undefined}>{canAdd ? '可新增' : '需名稱與有效 http(s) URL'}</span>
          <span>
            {charCount(name)}/{NAME_MAX} · {charCount(url)}/{URL_MAX}
          </span>
        </div>
        {formErr && <p className="field-error">{formErr}</p>}
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
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
                    <span className="muted">
                      {t.latency ? `${t.latency}ms` : '—'} · {t.lastNote}
                    </span>
                    <button type="button" className="btn sm ghost" onClick={() => void checkOne(t.id, t.url, t.name)}>
                      Probe
                    </button>
                    <DeleteButton onClick={() => setTargets((xs) => xs.filter((x) => x.id !== t.id))} label="刪除" />
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  上次檢查：
                  {t.lastCheck ? new Date(t.lastCheck).toLocaleString('zh-TW') : '尚未探測'}
                </p>
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

      <div className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="label" style={{ margin: 0 }}>
            探測歷史表
          </div>
          <button type="button" className="btn sm ghost" onClick={() => setTable([])}>
            清空
          </button>
        </div>
        <div style={{ overflow: 'auto', maxHeight: 280 }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['時間', '名稱', '狀態', '延遲', '備註'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.slice(0, 40).map((r) => (
                <tr key={r.id}>
                  <td className="mono muted" style={{ padding: '6px 8px' }}>
                    {new Date(r.at).toLocaleTimeString('zh-TW')}
                  </td>
                  <td style={{ padding: '6px 8px' }}>{r.name}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span className="tag" style={{ background: r.ok ? 'var(--teal)' : 'var(--rose)', color: '#fff' }}>
                      {r.ok ? 'OK' : 'FAIL'}
                    </span>
                  </td>
                  <td className="mono" style={{ padding: '6px 8px' }}>
                    {r.latency}ms
                  </td>
                  <td className="muted" style={{ padding: '6px 8px' }}>
                    {r.note}
                  </td>
                </tr>
              ))}
              {!table.length && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 12 }}>
                    尚無紀錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProjectShell>
  )
}
