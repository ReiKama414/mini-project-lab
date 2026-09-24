import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { charCount, copyText, downloadText, isNonEmpty, isValidHttpUrl, limitText, normalizeHttpUrl } from '../../lib/utils'

const fallback: ProjectMeta = {
  slug: 'tracking-url-cleaner',
  title: '追蹤參數清理',
  description: '移除 utm／fbclid 等追蹤參數並還原乾淨網址',
  tier: 'quick',
  effort: '幾小時～1 天',
  tags: ['security'],
}
const meta = getProject('tracking-url-cleaner') ?? fallback

const TRACK = /^(utm_|fbclid|gclid|mc_|igshid|ref|ref_src|si$|_hs|yclid|msclkid|twclid)/i
const MAX = 2000

const SAMPLES = [
  {
    label: 'UTM + fbclid',
    body: 'https://example.com/page?id=1&utm_source=tw&utm_medium=social&fbclid=abc&q=hello',
  },
  {
    label: '廣告點擊',
    body: 'https://shop.example.com/item/42?gclid=EAIa&msclkid=xyz&color=red',
  },
  {
    label: '乾淨網址',
    body: 'https://example.com/docs/guide?section=intro',
  },
]

function cleanUrl(url: string) {
  if (!isNonEmpty(url)) return { out: '', removed: [] as string[], error: '請輸入網址' }
  if (!isValidHttpUrl(url)) return { out: '', removed: [] as string[], error: '網址無效（需 http／https）' }
  try {
    const u = new URL(normalizeHttpUrl(url))
    const gone: string[] = []
    ;[...u.searchParams.keys()].forEach((k) => {
      if (TRACK.test(k)) {
        gone.push(k)
        u.searchParams.delete(k)
      }
    })
    return { out: u.toString(), removed: gone, error: '' }
  } catch {
    return { out: '', removed: [] as string[], error: '解析失敗' }
  }
}

export default function Page() {
  const [url, setUrl] = useLocalStorage('lab:tracking-url-cleaner:url', SAMPLES[0]!.body)
  const [copied, setCopied] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const result = useMemo(() => cleanUrl(url), [url])

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
          <ActionButton
            className="btn sm ghost"
            disabled={!result.out}
            onClick={() => void copyVal(result.out, 'out')}
            icon="copy"
          >
            {copied === 'out' ? '已複製' : '複製'}
          </ActionButton>
          <ActionButton
            className="btn sm accent"
            disabled={!result.out}
            onClick={() => downloadText('clean-url.txt', result.out)}
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
              {result.out && !result.error && (
                <span className="tag">
                  {result.removed.length ? `移除 ${result.removed.length}` : '無需清理'}
                </span>
              )}
              {result.error && isNonEmpty(url) && <span className="tag xc-tag-warn">無效</span>}
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
                    setUrl(s.body)
                    setHint(`已套用「${s.label}」`)
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="xc-main xc-view-split">
          <section className="panel xc-editor">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">原始網址</h3>
              <ActionButton className="btn sm ghost" icon="trash" disabled={!url} onClick={() => setUrl('')}>
                清除
              </ActionButton>
            </div>
            {result.error && <p className="field-error">{result.error}</p>}
            {hint && !result.error && <p className="field-hint">{hint}</p>}
            <textarea
              className={`field mono xc-textarea${result.error ? ' is-invalid' : ''}`}
              value={url}
              maxLength={MAX}
              spellCheck={false}
              onChange={(e) => {
                setUrl(limitText(e.target.value, MAX))
                setHint('')
              }}
              aria-label="網址"
            />
            <div className="field-meta">
              <span>即時清理</span>
              <span>
                {charCount(url)} / {MAX}
              </span>
            </div>
          </section>

          <section className="panel xc-out">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">乾淨網址</h3>
              <ActionButton
                className="btn sm ghost"
                disabled={!result.out}
                icon="copy"
                iconOnly
                tooltip={copied === 'out' ? '已複製' : '複製'}
                onClick={() => void copyVal(result.out, 'out')}
              />
            </div>
            {result.out ? (
              <div className="stack" style={{ gap: 12 }}>
                {result.removed.length > 0 ? (
                  <p className="field-hint" style={{ margin: 0 }}>
                    已移除：{result.removed.join(', ')}
                  </p>
                ) : (
                  <p className="field-hint" style={{ margin: 0 }}>
                    未偵測到常見追蹤參數
                  </p>
                )}
                <pre className="xc-pre mono" style={{ wordBreak: 'break-all' }}>
                  {result.out}
                </pre>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                有效 http／https 網址會即時清理
              </p>
            )}
          </section>
        </div>

        <section className="panel xc-info">
          <h3 className="pw-panel-title">更多資訊</h3>
          <ul className="pw-info-list">
            <li>
              <span className="muted">規則</span>
              <strong>啟發式移除 utm_、fbclid、gclid、msclkid、yclid 等常見追蹤參數</strong>
            </li>
            <li>
              <span className="muted">注意</span>
              <strong>非完整清單；業務參數請自行確認後再分享</strong>
            </li>
            <li>
              <span className="muted">相關</span>
              <strong>Privacy Checker、URL 編碼工具</strong>
            </li>
          </ul>
        </section>
      </div>
    </ProjectShell>
  )
}
