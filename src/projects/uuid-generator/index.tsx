import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('uuid-generator')!

type UuidVersion = 'v4'

function formatUuid(id: string, hyphen: boolean, upper: boolean) {
  let s = hyphen ? id : id.replace(/-/g, '')
  return upper ? s.toUpperCase() : s.toLowerCase()
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-generator:count', 5)
  const [hyphen, setHyphen] = useLocalStorage('lab:uuid-generator:hyphen', true)
  const [upper, setUpper] = useLocalStorage('lab:uuid-generator:upper', false)
  const [version, setVersion] = useLocalStorage<UuidVersion>('lab:uuid-generator:version', 'v4')
  const [history, setHistory] = useLocalStorage<string[]>('lab:uuid-generator:history', [])
  const [list, setList] = useState<string[]>([])
  const [checkInput, setCheckInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedOne, setCopiedOne] = useState<string | null>(null)

  const display = useMemo(
    () => list.map((id) => formatUuid(id, hyphen, upper)),
    [list, hyphen, upper],
  )

  const historyDisplay = useMemo(
    () => history.map((id) => formatUuid(id, hyphen, upper)),
    [history, hyphen, upper],
  )

  const validation = useMemo(() => {
    const raw = checkInput.trim()
    if (!raw) return null
    const ok = uuidValidate(raw)
    if (!ok) return { ok: false as const, message: '不是有效的 UUID' }
    try {
      const ver = uuidVersion(raw)
      return { ok: true as const, message: `有效 · UUID v${ver}` }
    } catch {
      return { ok: true as const, message: '有效 UUID' }
    }
  }, [checkInput])

  function makeOne() {
    if (version === 'v4') return uuidv4()
    return uuidv4()
  }

  function generate(append = false) {
    const n = Math.min(200, Math.max(1, Number.isFinite(count) ? count : 1))
    const next = Array.from({ length: n }, () => makeOne())
    setList((prev) => (append ? [...prev, ...next].slice(-200) : next))
    setHistory((h) => [...next, ...h.filter((x) => !next.includes(x))].slice(0, 40))
    setCopied(false)
  }

  async function copyAll() {
    if (!display.length) return
    await copyText(display.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function copyOne(id: string) {
    await copyText(id)
    setCopiedOne(id)
    setTimeout(() => setCopiedOne(null), 1200)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <div className="grid-2">
            <label className="stack">
              <span className="label">數量（1–200）</span>
              <input
                className="field"
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') generate(false)
                }}
              />
            </label>
            <label className="stack">
              <span className="label">版本</span>
              <select
                className="field"
                value={version}
                onChange={(e) => setVersion(e.target.value as UuidVersion)}
              >
                <option value="v4">UUID v4（隨機）</option>
              </select>
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
              保留連字號
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              大寫
            </label>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn accent" onClick={() => generate(false)}>
              產生 {version}
            </button>
            <button type="button" className="btn teal" onClick={() => generate(true)}>
              追加一批
            </button>
            <button type="button" className="btn ghost" disabled={!display.length} onClick={() => void copyAll()}>
              {copied ? '已複製' : '全部複製'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={!display.length}
              onClick={() => downloadText('uuids.txt', display.join('\n'))}
            >
              下載
            </button>
            <button type="button" className="btn ghost" disabled={!list.length} onClick={() => setList([])}>
              清空結果
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            快捷鍵：在數量欄按 Enter 產生。結果會寫入左側清單與右側歷史。
          </p>
          <ul className="list">
            {display.map((id, i) => (
              <li key={`${list[i]}-${i}`} className="list-item">
                <span className="mono" style={{ flex: 1, wordBreak: 'break-all' }}>
                  {id}
                </span>
                <button type="button" className="btn sm ghost" onClick={() => void copyOne(id)}>
                  {copiedOne === id ? '已複製' : '複製'}
                </button>
              </li>
            ))}
            {!display.length && (
              <p className="muted">尚未產生。設定數量後按「產生 v4」，可一次批次建立多組 UUID。</p>
            )}
          </ul>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel stack">
            <h3 style={{ margin: 0 }}>驗證 UUID</h3>
            <label className="stack">
              <span className="label">貼上要檢查的 UUID</span>
              <input
                className="field mono"
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            {validation && (
              <p className={validation.ok ? 'muted' : ''} style={validation.ok ? undefined : { color: 'var(--rose)' }}>
                {validation.message}
              </p>
            )}
            <p className="muted" style={{ fontSize: 12 }}>
              使用 <code>uuid</code> 套件產生與驗證 RFC 4122 UUID v4。
            </p>
          </div>
          <div className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>歷史（最近 {historyDisplay.length}）</h3>
              <button
                type="button"
                className="btn sm ghost"
                disabled={!history.length}
                onClick={() => setHistory([])}
              >
                清除歷史
              </button>
            </div>
            <ul className="list">
              {historyDisplay.slice(0, 12).map((id, i) => (
                <li key={`${history[i]}-${i}`} className="list-item">
                  <span className="mono" style={{ flex: 1, wordBreak: 'break-all', fontSize: 12 }}>
                    {id}
                  </span>
                  <button type="button" className="btn sm ghost" onClick={() => void copyOne(id)}>
                    複製
                  </button>
                </li>
              ))}
              {!historyDisplay.length && <p className="muted">產生後會自動保存於此（本機）。</p>}
            </ul>
            {historyDisplay.length > 0 && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => void copyText(historyDisplay.join('\n'))}
              >
                複製全部歷史
              </button>
            )}
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
