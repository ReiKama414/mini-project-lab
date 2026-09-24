import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'ulid-generator',
  title: 'ULID 產生器',
  description: '產生可排序的 ULID',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('ulid-generator') ?? fallback

const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const COUNT_MIN = 1
const COUNT_MAX = 200
const COUNT_PRESETS = [1, 5, 10, 20, 50]

function encodeTime(ms: number) {
  let t = ms
  let out = ''
  for (let i = 0; i < 10; i++) {
    out = ENC[t % 32]! + out
    t = Math.floor(t / 32)
  }
  return out
}

function encodeRandom() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = ''
  let acc = 0
  let bits = 0
  for (const b of bytes) {
    acc = (acc << 8) | b
    bits += 8
    while (bits >= 5 && out.length < 16) {
      bits -= 5
      out += ENC[(acc >> bits) & 31]!
    }
  }
  while (out.length < 16) out += ENC[0]!
  return out.slice(0, 16)
}

function ulid(ms = Date.now()) {
  return encodeTime(ms) + encodeRandom()
}

function decodeTime(id: string): number | null {
  if (id.length < 10) return null
  let t = 0
  for (let i = 0; i < 10; i++) {
    const idx = ENC.indexOf(id[i]!.toUpperCase())
    if (idx < 0) return null
    t = t * 32 + idx
  }
  return t
}

export default function Page() {
  const [count, setCount] = useLocalStorage('lab:ulid-generator:count', 5)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const n = clamp(count, COUNT_MIN, COUNT_MAX)

  const joined = useMemo(() => list.join('\n'), [list])
  const firstTime = list[0] ? decodeTime(list[0]) : null
  const firstLabel =
    firstTime != null
      ? new Date(firstTime).toLocaleString('zh-TW', { hour12: false })
      : ''

  function generate() {
    const base = Date.now()
    setList(Array.from({ length: n }, (_, i) => ulid(base + i)))
    setCopied(null)
  }

  async function copyVal(val: string, key: string) {
    if (!val) return
    await copyText(val)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row xc-shell-actions">
          <ActionButton className="btn sm accent" onClick={generate}>
            產生
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!joined}
            onClick={() => void copyVal(joined, 'all')}
            icon="copy"
          >
            {copied === 'all' ? '已複製' : '複製全部'}
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!joined}
            onClick={() => downloadText('ulids.txt', joined)}
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
              <span className="tag">26 字元</span>
              <span className="tag">{list.length} 組</span>
              {firstLabel && <span className="tag">{firstLabel}</span>}
            </div>
          </div>

          <div className="pw-block">
            <div className="label">數量預設</div>
            <div className="pw-chips">
              {COUNT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn sm ${n === p ? 'accent' : 'ghost'}`}
                  onClick={() => setCount(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <label className="stack">
            <span className="label">
              數量（{COUNT_MIN}–{COUNT_MAX}）
            </span>
            <input
              className="field"
              type="number"
              min={COUNT_MIN}
              max={COUNT_MAX}
              value={n}
              onChange={(e) => setCount(clamp(parseNumber(e.target.value, 5), COUNT_MIN, COUNT_MAX))}
            />
          </label>

          {firstLabel && (
            <p className="field-hint" style={{ margin: 0 }}>
              首筆時間戳：{firstLabel}（同批次以毫秒遞增以利排序）
            </p>
          )}
        </div>

        <div className="xc-main xc-view-out">
          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">輸出</h3>
              <div className="row" style={{ gap: 6 }}>
                <ActionButton
                  className="btn sm ghost"
                  disabled={!joined}
                  icon="copy"
                  iconOnly
                  tooltip={copied === 'all' ? '已複製' : '複製全部'}
                  onClick={() => void copyVal(joined, 'all')}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!joined}
                  icon="download"
                  iconOnly
                  tooltip="下載"
                  onClick={() => downloadText('ulids.txt', joined)}
                />
                <ActionButton
                  className="btn sm ghost"
                  disabled={!list.length}
                  icon="trash"
                  iconOnly
                  tooltip="清除"
                  onClick={() => setList([])}
                />
              </div>
            </div>
            {list.length ? (
              <ul className="list" style={{ margin: 0 }}>
                {list.map((id, i) => (
                  <li key={`${id}-${i}`} className="list-item">
                    <code className="mono" style={{ flex: 1 }}>
                      {id}
                    </code>
                    <ActionButton
                      className="btn sm ghost"
                      icon="copy"
                      iconOnly
                      tooltip={copied === id ? '已複製' : '複製'}
                      onClick={() => void copyVal(id, id)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                按「產生」以 Crockford Base32 時間戳 + Web Crypto 亂數產生 ULID
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">結構</span>
              <strong>10 字元時間戳 + 16 字元亂數（Crockford Base32，共 26 字元）</strong>
            </li>
            <li>
              <span className="muted">實作</span>
              <strong>本機精簡實作；同毫秒批次會遞增時間以利排序，非完整 monotonic ULID 規格</strong>
            </li>
            <li>
              <span className="muted">安全性</span>
              <strong>可排序識別碼，不是密鑰；時間戳可被解讀，勿當 secret</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>單次最多 {COUNT_MAX} 組</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機產生；僅記住數量設定</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
