import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'secure-password',
  title: '安全密碼產生',
  description: 'Web Crypto 產生高熵密碼，可調長度與字元集',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('secure-password') ?? fallback

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGIT = '0123456789'
const SYMBOL = '!@#$%^&*-_=+'

const LEN_PRESETS = [16, 24, 32, 48] as const

function make(len: number, useLower: boolean, useUpper: boolean, useDigit: boolean, useSymbol: boolean) {
  const sets: string[] = []
  if (useLower) sets.push(LOWER)
  if (useUpper) sets.push(UPPER)
  if (useDigit) sets.push(DIGIT)
  if (useSymbol) sets.push(SYMBOL)
  if (!sets.length) sets.push(LOWER)
  const pool = sets.join('')
  const out: string[] = []
  const bytes = new Uint32Array(len)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < Math.min(sets.length, len); i++) {
    const set = sets[i]!
    out.push(set[bytes[i]! % set.length]!)
  }
  for (let i = out.length; i < len; i++) out.push(pool[bytes[i]! % pool.length]!)
  const mix = new Uint32Array(out.length)
  crypto.getRandomValues(mix)
  for (let i = out.length - 1; i > 0; i--) {
    const j = mix[i]! % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out.join('')
}

export default function Page() {
  const [len, setLen] = useLocalStorage('lab:secure-password:len', 24)
  const [useLower, setUseLower] = useLocalStorage('lab:secure-password:lower', true)
  const [useUpper, setUseUpper] = useLocalStorage('lab:secure-password:upper', true)
  const [useDigit, setUseDigit] = useLocalStorage('lab:secure-password:digit', true)
  const [useSymbol, setUseSymbol] = useLocalStorage('lab:secure-password:symbol', true)
  const [pwd, setPwd] = useState('')
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const n = clamp(len, 12, 64)
  const charset =
    (useLower ? 26 : 0) + (useUpper ? 26 : 0) + (useDigit ? 10 : 0) + (useSymbol ? SYMBOL.length : 0)
  const entropy = pwd ? pwd.length * Math.log2(Math.max(charset, 1)) : n * Math.log2(Math.max(charset, 1))

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function generate() {
    setPwd(make(n, useLower, useUpper, useDigit, useSymbol))
    setCopied(null)
    setShow(true)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!pwd}
            onClick={() => void copyVal(pwd, 'pwd')}
            icon="copy"
          >
            {copied === 'pwd' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!pwd}
            onClick={() => downloadText('password.txt', pwd)}
            icon="download"
          >
            下載
          </ActionButton>
        </div>
      }
    >
      <div className="xc-calc">
        <div className="panel xc-toolbar">
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">工具</h3>
            <div className="pw-stats">
              <span className="tag">{n} 字元</span>
              <span className="tag">≈ {Math.round(entropy)} bit</span>
            </div>
          </div>
          <div className="pw-block">
            <div className="label">長度預設</div>
            <div className="pw-chips">
              {LEN_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn sm ${n === v ? 'accent' : 'ghost'}`}
                  onClick={() => setLen(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">長度：{n}（12–64）</div>
            <input
              className="field"
              type="range"
              min={12}
              max={64}
              value={n}
              onChange={(e) => setLen(clamp(parseNumber(e.target.value, 24), 12, 64))}
            />
          </div>
          <div className="row xc-options" style={{ flexWrap: 'wrap' }}>
            <label className="xc-check">
              <input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} />
              小寫
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} />
              大寫
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={useDigit} onChange={(e) => setUseDigit(e.target.checked)} />
              數字
            </label>
            <label className="xc-check">
              <input type="checkbox" checked={useSymbol} onChange={(e) => setUseSymbol(e.target.checked)} />
              符號
            </label>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <ActionButton className="btn sm accent" onClick={generate} icon="none">
              產生
            </ActionButton>
            <button type="button" className="btn sm ghost" disabled={!pwd} onClick={() => setShow((v) => !v)}>
              {show ? '隱藏' : '顯示'}
            </button>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">產生結果</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!pwd}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'pwd' ? '已複製' : '複製'}
                  onClick={() => void copyVal(pwd, 'pwd')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!pwd}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('password.txt', pwd)}
                />
              </div>
            </div>
            {pwd ? (
              <pre className="xc-pre mono" style={{ wordBreak: 'break-all' }}>
                {show ? pwd : '•'.repeat(Math.min(pwd.length, 48))}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                調整選項後按「產生」
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">亂數</span>
              <strong>crypto.getRandomValues；盡量保證每類字元至少一個</strong>
            </li>
            <li>
              <span className="muted">儲存</span>
              <strong>密碼只留在記憶體；長度與字元集設定可記住</strong>
            </li>
            <li>
              <span className="muted">建議</span>
              <strong>正式環境請搭配密碼管理器，勿重複使用</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Password Strength、Secret Generator</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
