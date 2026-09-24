import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, copyText, downloadText, parseNumber } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'nanoid-generator',
  title: 'NanoID 產生器',
  description: '本機產生 URL 安全短 ID',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['dev'],
}
const meta = getProject('nanoid-generator') ?? fallback

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const SIZE_MIN = 4
const SIZE_MAX = 64
const COUNT_MIN = 1
const COUNT_MAX = 200
const SIZE_PRESETS = [8, 12, 16, 21, 32]
const COUNT_PRESETS = [1, 5, 10, 20, 50]

function nanoid(size: number) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < size; i++) id += ALPHA[bytes[i]! & 63]!
  return id
}

/** Approximate collision bits for URL-safe 64-char alphabet */
function entropyBits(size: number) {
  return Math.floor(size * Math.log2(64))
}

export default function Page() {
  const [size, setSize] = useLocalStorage('lab:nanoid-generator:size', 21)
  const [count, setCount] = useLocalStorage('lab:nanoid-generator:count', 5)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const s = clamp(size, SIZE_MIN, SIZE_MAX)
  const n = clamp(count, COUNT_MIN, COUNT_MAX)

  const joined = useMemo(() => list.join('\n'), [list])
  const bits = entropyBits(s)

  function generate() {
    setList(Array.from({ length: n }, () => nanoid(s)))
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
            onClick={() => downloadText('nanoids.txt', joined)}
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
              <span className="tag">長度 {s}</span>
              <span className="tag">≈ {bits} bit</span>
              <span className="tag">{list.length} 組</span>
            </div>
          </div>

          <div className="pw-block">
            <div className="label">長度預設</div>
            <div className="pw-chips">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn sm ${s === p ? 'accent' : 'ghost'}`}
                  onClick={() => setSize(p)}
                >
                  {p}
                  {p === 21 ? '（預設）' : ''}
                </button>
              ))}
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

          <div className="grid-2">
            <label className="stack">
              <span className="label">
                長度（{SIZE_MIN}–{SIZE_MAX}）
              </span>
              <input
                className="field"
                type="number"
                min={SIZE_MIN}
                max={SIZE_MAX}
                value={s}
                onChange={(e) => setSize(clamp(parseNumber(e.target.value, 21), SIZE_MIN, SIZE_MAX))}
              />
            </label>
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
          </div>
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
                  onClick={() => downloadText('nanoids.txt', joined)}
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
                按「產生」以 Web Crypto 亂數產生 URL 安全 ID
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">演算法</span>
              <strong>crypto.getRandomValues + 64 字元 URL 安全集（A–Z a–z 0–9 _-）</strong>
            </li>
            <li>
              <span className="muted">實作</span>
              <strong>非官方 nanoid 套件；字元集與取樣方式相近，長度預設 21</strong>
            </li>
            <li>
              <span className="muted">安全性</span>
              <strong>適合公開 ID／slug；勿當加密金鑰。熵約 {bits} bit（長度 {s}）</strong>
            </li>
            <li>
              <span className="muted">上限</span>
              <strong>長度 {SIZE_MIN}–{SIZE_MAX}；單次最多 {COUNT_MAX} 組</strong>
            </li>
            <li>
              <span className="muted">隱私</span>
              <strong>本機產生；僅記住長度／數量設定</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
