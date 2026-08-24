import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText } from '../../lib/utils'

const meta = getProject('uuid-generator')!

function formatUuid(id: string, hyphen: boolean, upper: boolean) {
  let s = hyphen ? id : id.replace(/-/g, '')
  return upper ? s.toUpperCase() : s.toLowerCase()
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:uuid-generator:count', 5)
  const [hyphen, setHyphen] = useLocalStorage('lab:uuid-generator:hyphen', true)
  const [upper, setUpper] = useLocalStorage('lab:uuid-generator:upper', false)
  const [list, setList] = useState<string[]>([])
  const [checkInput, setCheckInput] = useState('')
  const [copied, setCopied] = useState(false)

  const display = useMemo(
    () => list.map((id) => formatUuid(id, hyphen, upper)),
    [list, hyphen, upper],
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

  function generate() {
    const n = Math.min(200, Math.max(1, count))
    setList(Array.from({ length: n }, () => uuidv4()))
    setCopied(false)
  }

  return (
    <ProjectShell meta={meta}>
      <div className="grid-2">
        <div className="panel stack">
          <label className="stack">
            <span className="label">數量（1–200）</span>
            <input
              className="field"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={hyphen} onChange={(e) => setHyphen(e.target.checked)} />
              保留連字號
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              大寫
            </label>
          </div>
          <div className="row">
            <button className="btn accent" onClick={generate}>
              產生 UUID v4
            </button>
            <button
              className="btn ghost"
              disabled={!display.length}
              onClick={async () => {
                await copyText(display.join('\n'))
                setCopied(true)
              }}
            >
              {copied ? '已複製' : '全部複製'}
            </button>
            <button
              className="btn ghost"
              disabled={!display.length}
              onClick={() => downloadText('uuids.txt', display.join('\n'))}
            >
              下載
            </button>
          </div>
          <ul className="list">
            {display.map((id, i) => (
              <li key={`${list[i]}-${i}`} className="list-item">
                <span className="mono" style={{ flex: 1, wordBreak: 'break-all' }}>
                  {id}
                </span>
                <button className="btn sm ghost" onClick={() => void copyText(id)}>
                  複製
                </button>
              </li>
            ))}
            {!display.length && <p className="muted">點擊產生以建立 UUID</p>}
          </ul>
        </div>
        <div className="panel stack">
          <h3>驗證 UUID</h3>
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
      </div>
    </ProjectShell>
  )
}
