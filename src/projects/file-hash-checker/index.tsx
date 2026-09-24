import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { ActionButton } from '../../components/ActionButton'
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, formatBytes, isNonEmpty, limitText } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'file-hash-checker',
  title: '檔案雜湊核對',
  description: '計算檔案 SHA-256 並與預期值比對',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('file-hash-checker') ?? fallback

const FILE_MAX = 64 * 1024 * 1024
const EXPECT_MAX = 256
type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type Encode = 'hex' | 'base64'

const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function normalizeExpect(raw: string, encode: Encode) {
  const t = raw.trim().replace(/\s/g, '')
  if (encode === 'hex') return t.toLowerCase()
  return t
}

async function digestFile(algo: Algo, data: ArrayBuffer, encode: Encode) {
  const dig = await crypto.subtle.digest(algo, data)
  return encode === 'base64' ? toBase64(dig) : toHex(dig)
}

export default function Page() {
  const [algo, setAlgo] = useLocalStorage<Algo>('lab:file-hash-checker:algo', 'SHA-256')
  const [encode, setEncode] = useLocalStorage<Encode>('lab:file-hash-checker:encode', 'hex')
  const [expect, setExpect] = useState('')
  const [hex, setHex] = useState('')
  const [info, setInfo] = useState('')
  const [fileBuf, setFileBuf] = useState<ArrayBuffer | null>(null)
  const [fileLabel, setFileLabel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.removeItem('lab:file-hash-checker:expect')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!fileBuf) return
    let cancelled = false
    void (async () => {
      setBusy(true)
      setError('')
      try {
        const h = await digestFile(algo, fileBuf, encode)
        if (!cancelled) setHex(h)
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
  }, [fileBuf, algo, encode])

  const match = useMemo(() => {
    if (!hex || !isNonEmpty(expect)) return null
    const a = normalizeExpect(hex, encode)
    const b = normalizeExpect(expect, encode)
    return a === b
  }, [hex, expect, encode])

  async function onFile(file: File | null) {
    if (!file) return
    if (file.size > FILE_MAX) {
      setError(`檔案過大（上限 ${formatBytes(FILE_MAX)}）`)
      setHex('')
      setFileBuf(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      setFileBuf(buf)
      setFileLabel(file.name)
      setInfo(`${file.name} · ${formatBytes(file.size)}`)
      setCopied(null)
    } catch {
      setError('讀取失敗')
      setFileBuf(null)
      setHex('')
    } finally {
      setBusy(false)
    }
  }

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const outName = `${fileLabel || 'file'}-${algo.toLowerCase()}.${encode === 'hex' ? 'txt' : 'b64.txt'}`
  const expectPlaceholder = encode === 'hex' ? '貼上預期 Hex（可含空白）' : '貼上預期 Base64'

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
            {copied === 'out' ? '已複製' : '複製雜湊'}
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
              {match === true && <span className="tag">相符</span>}
              {match === false && <span className="tag xc-tag-warn">不符</span>}
              {busy && <span className="tag">計算中…</span>}
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
              <h3 className="pw-panel-title">選擇檔案</h3>
              {fileBuf && (
                <ActionButton
                  className="btn sm ghost"
                  icon="trash"
                  onClick={() => {
                    setFileBuf(null)
                    setHex('')
                    setInfo('')
                    setFileLabel('')
                  }}
                >
                  清除
                </ActionButton>
              )}
            </div>
            <FileDrop
              maxBytes={FILE_MAX}
              disabled={busy}
              label="拖放檔案到此，或點擊選擇"
              hint={`上限 ${formatBytes(FILE_MAX)} · 本機計算不上傳`}
              onFiles={(files) => void onFile(files[0] ?? null)}
            />
            {info && !busy && <p className="field-hint">{info}</p>}
            {busy && <p className="field-hint">計算中，大檔案請稍候…</p>}
            {error && <p className="field-error">{error}</p>}

            <label className="stack" style={{ marginTop: '0.5rem' }}>
              <span className="label">預期雜湊（選填）</span>
              <input
                className="field mono"
                value={expect}
                maxLength={EXPECT_MAX}
                placeholder={expectPlaceholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setExpect(limitText(e.target.value, EXPECT_MAX))}
              />
              <div className="field-meta">
                <span>比對時忽略空白；Hex 不分大小寫</span>
              </div>
            </label>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">計算結果</h3>
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
            {hex ? (
              <>
                <pre className="xc-pre mono">{hex}</pre>
                {match === true && <p className="field-hint">與預期值相符</p>}
                {match === false && <p className="field-error">與預期值不符</p>}
                {match === null && !isNonEmpty(expect) && (
                  <p className="muted" style={{ margin: 0 }}>
                    可於左側貼上預期雜湊以自動比對
                  </p>
                )}
              </>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                選擇檔案後會以所選演算法計算雜湊
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">引擎</span>
              <strong>Web Crypto subtle.digest（SHA-1／256／384／512）</strong>
            </li>
            <li>
              <span className="muted">用途</span>
              <strong>核對下載檔完整性；請與發布方使用相同演算法與編碼</strong>
            </li>
            <li>
              <span className="muted">雜湊 ≠ 加密</span>
              <strong>無法還原檔案；相符只代表內容一致，不保證來源可信</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>檔案 {formatBytes(FILE_MAX)}；預期雜湊最多 {EXPECT_MAX} 字元</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機計算，不上傳；預期值只留在記憶體</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
