import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'hash-generator',
  title: '雜湊產生器',
  description: '以 Web Crypto 計算 SHA 雜湊',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('hash-generator') ?? fallback

const MAX = 200_000
type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type Encode = 'hex' | 'base64'

const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']
const SAMPLES = [
  { label: 'hello', body: 'hello' },
  { label: '空字串', body: '' },
  { label: '中文', body: '雜湊測試' },
  { label: '多行', body: 'line1\nline2\nline3' },
]

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function digest(algo: Algo, text: string, encode: Encode) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text))
  return encode === 'base64' ? toBase64(buf) : toHex(buf)
}

export default function Page() {
  const [input, setInput] = useState('hello')
  const [algo, setAlgo] = useLocalStorage<Algo>('lab:hash-generator:algo', 'SHA-256')
  const [encode, setEncode] = useLocalStorage<Encode>('lab:hash-generator:encode', 'hex')
  const [hex, setHex] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    try {
      localStorage.removeItem('lab:hash-generator:input')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const out = await digest(algo, input, encode)
        if (!cancelled) setHex(out)
      } catch {
        if (!cancelled) {
          setError('計算失敗（瀏覽器可能不支援此演算法）')
          setHex('')
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [input, algo, encode])

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const fileName = `hash-${algo.toLowerCase()}.${encode === 'hex' ? 'txt' : 'b64.txt'}`

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!hex}
            onClick={() => void copyVal(hex, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!hex}
            onClick={() => downloadText(fileName, hex)}
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
              <span className="tag">{algo}</span>
              <span className="tag">{encode === 'hex' ? 'Hex' : 'Base64'}</span>
              {busy && <span className="tag">計算中…</span>}
              {hex && <span className="tag">{hex.length} 字元</span>}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setInput(s.body)
                    setHint(s.label === '空字串' ? '已套用空字串（仍可計算雜湊）' : `已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">演算法</div>
            <div className="pw-chips">
              {ALGOS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`btn sm ${algo === a ? 'accent' : 'ghost'}`}
                  onClick={() => setAlgo(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">編碼</div>
            <div className="pw-chips">
              {(
                [
                  ['hex', 'Hex'],
                  ['base64', 'Base64'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn sm ${encode === id ? 'accent' : 'ghost'}`}
                  onClick={() => setEncode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">輸入文字</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!input} onClick={() => setInput('')}>
                清除
              </ActionButton>
            </div>
            {error && <p className="field-error">{error}</p>}
            {hint && !error && <p className="field-hint">{hint}</p>}
            <textarea
              className="field mono xc-textarea"
              value={input}
              maxLength={MAX}
              spellCheck={false}
              onChange={(e) => {
                setInput(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="雜湊輸入"
            />
            <div className="field-meta">
              <span>UTF-8 → Web Crypto</span>
              <span>
                {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">雜湊輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!hex}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'out' ? '已複製' : '複製'}
                  onClick={() => void copyVal(hex, 'out')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!hex}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText(fileName, hex)}
                />
              </div>
            </div>
            {hex ? (
              <pre className="xc-pre mono">{hex}</pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {busy ? '計算中…' : '輸入文字後即時計算'}
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">引擎</span>
              <strong>瀏覽器 Web Crypto subtle.digest（SHA-1／256／384／512）</strong>
            </li>
            <li>
              <span className="muted">雜湊 ≠ 加密</span>
              <strong>單向摘要，無法還原原文；不是加密或簽章</strong>
            </li>
            <li>
              <span className="muted">SHA-1</span>
              <strong>僅供相容舊系統，不建議用於安全性用途</strong>
            </li>
            <li>
              <span className="muted">編碼</span>
              <strong>Hex 小寫十六進位，或 Base64（二進位摘要）</strong>
            </li>
            <li>
              <span className="muted">上限／隱私</span>
              <strong>文字上限 {MAX.toLocaleString()} 字元；輸入不寫入 localStorage，不上傳</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
