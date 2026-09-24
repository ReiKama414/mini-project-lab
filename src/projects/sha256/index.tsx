import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, formatBytes, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'sha256',
  title: 'SHA-256',
  description: '文字或檔案 SHA-256 雜湊',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('sha256') ?? fallback

const MAX = 200_000
const FILE_MAX = 32 * 1024 * 1024
type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type Encode = 'hex' | 'base64'
type Source = 'text' | 'file'

const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']
const SAMPLES = [
  { label: 'hello', body: 'hello' },
  { label: '空字串', body: '' },
  { label: '中文', body: 'SHA 測試' },
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

async function digestBytes(algo: Algo, data: BufferSource, encode: Encode) {
  const buf = await crypto.subtle.digest(algo, data)
  return encode === 'base64' ? toBase64(buf) : toHex(buf)
}

export default function Page() {
  const [input, setInput] = useState('hello')
  const [algo, setAlgo] = useLocalStorage<Algo>('lab:sha256:algo', 'SHA-256')
  const [encode, setEncode] = useLocalStorage<Encode>('lab:sha256:encode', 'hex')
  const [hex, setHex] = useState('')
  const [info, setInfo] = useState('')
  const [source, setSource] = useState<Source>('text')
  const [fileBuf, setFileBuf] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    try {
      localStorage.removeItem('lab:sha256:input')
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
        let out = ''
        if (source === 'file' && fileBuf) {
          out = await digestBytes(algo, fileBuf, encode)
          if (!cancelled) setInfo(`${fileName} · ${formatBytes(fileBuf.byteLength)}`)
        } else if (source === 'text') {
          out = await digestBytes(algo, new TextEncoder().encode(input), encode)
          if (!cancelled) setInfo(`文字 · ${charCount(input)} 字元`)
        } else {
          if (!cancelled) {
            setHex('')
            setInfo('')
          }
          return
        }
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
  }, [input, algo, encode, source, fileBuf, fileName])

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      setFileBuf(buf)
      setFileName(file.name)
      setSource('file')
      setHint(`已載入「${file.name}」`)
      setCopied(null)
    } catch {
      setError('讀取失敗')
      setFileBuf(null)
    } finally {
      setBusy(false)
    }
  }

  const outName = `${algo.toLowerCase()}.${encode === 'hex' ? 'txt' : 'b64.txt'}`

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
            onClick={() => downloadText(outName, hex)}
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
              <span className="tag">{source === 'file' ? '檔案' : '文字'}</span>
              {busy && <span className="tag">計算中…</span>}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">文字範例</div>
            <div className="pw-chips">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setInput(s.body)
                    setSource('text')
                    setHint(s.label === '空字串' ? '已套用空字串' : `已套用「${s.label}」`)
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
              <h3 className="pw-panel-title">文字輸入</h3>
              <ActionButton
                className="btn sm ghost"
                icon="trash"
                disabled={!input}
                onClick={() => {
                  setInput('')
                  setSource('text')
                }}
              >
                清除
              </ActionButton>
            </div>
            {hint && !error && <p className="field-hint">{hint}</p>}
            <textarea
              className="field mono xc-textarea"
              value={input}
              maxLength={MAX}
              disabled={busy && source === 'file'}
              spellCheck={false}
              onChange={(e) => {
                setInput(limitText(e.target.value, MAX))
                setSource('text')
                setHint('')
              }}
              aria-label="文字"
            />
            <div className="field-meta">
              <span>UTF-8</span>
              <span>
                {charCount(input).toLocaleString()} / {MAX.toLocaleString()}
              </span>
            </div>

            <div className="pw-block" style={{ marginTop: '0.5rem' }}>
              <div className="label">或選擇檔案</div>
              <FileDrop
                maxBytes={FILE_MAX}
                disabled={busy}
                label="拖放檔案到此，或點擊選擇"
                hint={`上限 ${formatBytes(FILE_MAX)}`}
                onFiles={(files) => void onFile(files[0] ?? null)}
              />
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
                  onClick={() => downloadText(outName, hex)}
                />
              </div>
            </div>
            {error && <p className="field-error">{error}</p>}
            {info && !busy && !error && <p className="field-hint">{info}</p>}
            {busy && <p className="field-hint">計算中，大檔案請稍候…</p>}
            {hex ? (
              <pre className="xc-pre mono">{hex}</pre>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                輸入文字或選檔後即時計算
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">引擎</span>
              <strong>Web Crypto subtle.digest；預設 SHA-256，亦可選 SHA-1／384／512</strong>
            </li>
            <li>
              <span className="muted">雜湊 ≠ 加密</span>
              <strong>單向摘要，用於完整性核對；無法還原檔案內容</strong>
            </li>
            <li>
              <span className="muted">編碼</span>
              <strong>Hex 或 Base64；比對時請與來源使用相同編碼與演算法</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>文字 {MAX.toLocaleString()} 字元；檔案 {formatBytes(FILE_MAX)}</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機計算，不上傳；文字輸入不寫入 localStorage</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
