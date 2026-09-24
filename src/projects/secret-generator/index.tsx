import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'secret-generator',
  title: '密鑰／Secret 產生',
  description: '產生 hex／base64／base64url 隨機密鑰',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('secret-generator') ?? fallback

type Fmt = 'hex' | 'base64' | 'base64url'

const BYTE_PRESETS = [16, 32, 48, 64] as const

function encode(arr: Uint8Array, fmt: Fmt) {
  if (fmt === 'hex') return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
  let bin = ''
  arr.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  const b64 = btoa(bin)
  if (fmt === 'base64url') return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64
}

export default function Page() {
  const [bytes, setBytes] = useLocalStorage('lab:secret-generator:bytes', 32)
  const [fmt, setFmt] = useLocalStorage<Fmt>('lab:secret-generator:fmt', 'hex')
  const [out, setOut] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [show, setShow] = useState(true)
  const n = clamp(bytes, 8, 64)

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  function generate() {
    const arr = new Uint8Array(n)
    crypto.getRandomValues(arr)
    setOut(encode(arr, fmt))
    setCopied(null)
  }

  const fileExt = fmt === 'hex' ? 'hex.txt' : fmt === 'base64url' ? 'b64url.txt' : 'b64.txt'

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!out}
            onClick={() => void copyVal(out, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!out}
            onClick={() => downloadText(`secret.${fileExt}`, out)}
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
              <span className="tag">
                {n} B（{n * 8} bit）
              </span>
              <span className="tag">{fmt === 'hex' ? 'Hex' : fmt === 'base64url' ? 'Base64URL' : 'Base64'}</span>
            </div>
          </div>
          <div className="pw-block">
            <div className="label">位元組預設</div>
            <div className="pw-chips">
              {BYTE_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn sm ${n === v ? 'accent' : 'ghost'}`}
                  onClick={() => setBytes(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="pw-block">
            <div className="label">
              位元組：{n}（{n * 8} bit）
            </div>
            <input
              className="field"
              type="range"
              min={8}
              max={64}
              value={n}
              onChange={(e) => setBytes(clamp(parseNumber(e.target.value, 32), 8, 64))}
            />
          </div>
          <div className="pw-block">
            <div className="label">格式</div>
            <div className="pw-chips">
              {(
                [
                  ['hex', 'Hex'],
                  ['base64', 'Base64'],
                  ['base64url', 'Base64URL'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${fmt === id ? 'accent' : 'ghost'}`}
                  onClick={() => {
                    setFmt(id)
                    setOut('')
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <ActionButton className="btn sm accent" onClick={generate} icon="none">
              產生
            </ActionButton>
            <button type="button" className="btn sm ghost" disabled={!out} onClick={() => setShow((v) => !v)}>
              {show ? '隱藏' : '顯示'}
            </button>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">密鑰輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!out}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(out, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!out}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText(`secret.${fileExt}`, out)}
                />
              </div>
            </div>
            {out ? (
              <pre className="xc-pre mono" style={{ wordBreak: 'break-all' }}>
                {show ? out : '•'.repeat(Math.min(out.length, 64))}
              </pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                選擇格式後按「產生」
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">用途</span>
              <strong>API key、Webhook secret、加密金鑰材料等開發用途</strong>
            </li>
            <li>
              <span className="muted">亂數</span>
              <strong>crypto.getRandomValues；輸出只留在記憶體</strong>
            </li>
            <li>
              <span className="muted">格式</span>
              <strong>Hex／Base64／Base64URL（無 padding）</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Secure Password、UUID／NanoID 產生器</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
