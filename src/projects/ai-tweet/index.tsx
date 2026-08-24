import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, downloadText, uid, limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('ai-tweet')!

type Tone = '專業' | '勵志' | '幽默' | '冷靜'
type Item = { id: string; text: string; chars: number; n?: number; tone: Tone; topic: string; at: number }
type Hist = { id: string; topic: string; tone: Tone; mode: 'single' | 'thread'; items: Item[]; at: number }

const LIMIT = 280
const TOPIC_MAX = 120
const TAGS_MAX = 120

const PRESETS: { label: string; topic: string; tags: string; tone: Tone }[] = [
  { label: '側專案上線', topic: '側專案上線', tags: 'sideproject, BuildInPublic', tone: '專業' },
  { label: '學習筆記', topic: '本週讀完一本技術書', tags: '學習筆記, 持續進步', tone: '勵志' },
  { label: '工程師吐槽', topic: '又在修那個「五分鐘搞定」的 bug', tags: '工程師日常, 日常吐槽', tone: '幽默' },
  { label: '深度思考', topic: '少做一點反而走得更遠', tags: '深度思考, 筆記', tone: '冷靜' },
]

function tagLine(tone: Tone, custom: string) {
  const extra = custom
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('#') ? s : `#${s}`))
  const base =
    tone === '專業'
      ? ['#BuildInPublic', '#Productivity']
      : tone === '勵志'
        ? ['#學習筆記', '#持續進步']
        : tone === '幽默'
          ? ['#日常吐槽', '#工程師日常']
          : ['#深度思考', '#筆記']
  return [...base, ...extra].slice(0, 5).join(' ')
}

function clip(s: string) {
  return s.length <= LIMIT ? s : s.slice(0, LIMIT - 1) + '…'
}

function singleVariants(topic: string, tone: Tone, tags: string): Item[] {
  const t = topic.trim() || '今日進度'
  const hooks =
    tone === '專業'
      ? [
          `${t}：把完成定義寫清楚，交付就穩一半。`,
          `關於${t}，我學到最重要的一件事——先量測再優化。`,
          `${t}不是靈感，是系統。建立節奏就贏一半。`,
        ]
      : tone === '勵志'
        ? [
            `${t}：一步一步來，也是一種速度。`,
            `今天先為${t}完成最小一步，明天會感謝你。`,
            `別等完美。先讓${t}出現第一個可見成果。`,
          ]
        : tone === '幽默'
          ? [
              `${t}進度：理論上很快，實務上很久（經典）。`,
              `當我說「再五分鐘就好」時，${t}通常會再加一小時。`,
              `${t}：我與 deadline 的戀愛故事，結局未定。`,
            ]
          : [
              `${t}的本質是取捨：少做一點，反而走得更遠。`,
              `對${t}保持好奇，對雜訊保持距離。`,
              `${t}：先記錄事實，再下判斷。`,
            ]
  const tag = tagLine(tone, tags)
  const at = Date.now()
  return hooks.map((h) => {
    const text = clip(`${h}\n\n${tag}`)
    return { id: uid('tw'), text, chars: text.length, tone, topic: t, at }
  })
}

function thread(topic: string, tone: Tone, tags: string): Item[] {
  const t = topic.trim() || '主題'
  const tag = tagLine(tone, tags)
  const at = Date.now()
  const parts = [
    `1/ ${t}——先講結論：把目標拆成可驗證的小步。`,
    `2/ 做法：今天只做一件高槓桿任務，其餘進待辦池。`,
    `3/ 檢查：晚上用三句話回顧卡點與下一步。`,
    `4/ 收尾：公開一個小成果，讓自己被節奏拉著走。\n\n${tag}`,
  ]
  return parts.map((p, i) => {
    const text = clip(p)
    return { id: uid('th'), text, chars: text.length, n: i + 1, tone, topic: t, at }
  })
}

export default function Page() {
  const [topic, setTopic] = useLocalStorage('lab:ai-tweet:topic', '側專案上線')
  const [tone, setTone] = useLocalStorage<Tone>('lab:ai-tweet:tone', '專業')
  const [tags, setTags] = useLocalStorage('lab:ai-tweet:tags', 'sideproject')
  const [mode, setMode] = useLocalStorage<'single' | 'thread'>('lab:ai-tweet:mode', 'single')
  const [items, setItems] = useState<Item[]>([])
  const [history, setHistory] = useLocalStorage<Hist[]>('lab:ai-tweet:history', [])
  const [favs, setFavs] = useLocalStorage<Item[]>('lab:ai-tweet:favs', [])
  const [copied, setCopied] = useState('')

  const threadFull = useMemo(() => items.map((it) => it.text).join('\n\n'), [items])
  const overLimit = items.filter((it) => it.chars > LIMIT).length
  const canGenerate = isNonEmpty(topic)

  function generate() {
    if (!canGenerate) return
    const t = limitText(topic, TOPIC_MAX)
    const tagStr = limitText(tags, TAGS_MAX)
    const next = mode === 'thread' ? thread(t, tone, tagStr) : singleVariants(t, tone, tagStr)
    setItems(next)
    setHistory((h) =>
      [{ id: uid('h'), topic: t.trim() || '今日進度', tone, mode, items: next, at: Date.now() }, ...h].slice(0, 20),
    )
  }

  function toggleFav(it: Item) {
    setFavs((xs) => (xs.some((f) => f.text === it.text) ? xs.filter((f) => f.text !== it.text) : [it, ...xs].slice(0, 40)))
  }

  async function copy(text: string, id: string) {
    await copyText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 1200)
  }

  function exportAll() {
    const body = [
      `# AI Tweet 匯出`,
      `主題：${topic}`,
      `語氣：${tone}｜模式：${mode}`,
      '',
      '## 本次結果',
      ...items.map((it, i) => `### ${it.n != null ? `#${it.n}` : `變體 ${i + 1}`}（${it.chars}/${LIMIT}）\n${it.text}`),
      '',
      '## 收藏',
      ...(favs.length ? favs.map((f) => `- [${f.tone}] ${f.text.replace(/\n/g, ' ')}`) : ['（無）']),
    ].join('\n')
    downloadText('ai-tweet-export.md', body, 'text/markdown;charset=utf-8')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!items.length && !favs.length} onClick={exportAll}>
            匯出
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!history.length && !favs.length}
            onClick={() => {
              setHistory([])
              setFavs([])
              setItems([])
            }}
          >
            清空紀錄
          </button>
        </div>
      }
    >
      <div className="panel stack" style={{ marginBottom: 12 }}>
        <div className="label">快速預設</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn sm ghost"
              onClick={() => {
                setTopic(p.topic)
                setTags(p.tags)
                setTone(p.tone)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <div className="row">
            <label className="label">主題</label>
            <span className="mono muted">{charCount(topic)}/{TOPIC_MAX}</span>
          </div>
          <input
            className={cn('field', !canGenerate && 'is-invalid')}
            maxLength={TOPIC_MAX}
            value={topic}
            onChange={(e) => setTopic(limitText(e.target.value, TOPIC_MAX))}
            placeholder="今天想發什麼？"
          />
          <div className="field-meta">
            <span className={!canGenerate ? 'warn' : undefined}>{canGenerate ? '可產生' : '請輸入主題'}</span>
            <span className="field-hint">單則結果仍會截斷至 {LIMIT} 字</span>
          </div>
          {!canGenerate && <p className="field-error">主題不可空白</p>}
          <label className="label">語氣</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(['專業', '勵志', '幽默', '冷靜'] as Tone[]).map((v) => (
              <button key={v} type="button" className={`btn sm ${tone === v ? 'accent' : 'ghost'}`} onClick={() => setTone(v)}>
                {v}
              </button>
            ))}
          </div>
          <div className="row">
            <label className="label">額外 Hashtags</label>
            <span className="mono muted">{charCount(tags)}/{TAGS_MAX}</span>
          </div>
          <input
            className="field"
            maxLength={TAGS_MAX}
            value={tags}
            onChange={(e) => setTags(limitText(e.target.value, TAGS_MAX))}
            placeholder="空白或逗號分隔"
          />
          <div className="field-meta">
            <span className="field-hint">最多約 5 個標籤會寫入貼文</span>
            <span>{charCount(tags)}/{TAGS_MAX}</span>
          </div>
          <label className="label">模式</label>
          <div className="row">
            <button type="button" className={`btn sm ${mode === 'single' ? 'accent' : 'ghost'}`} onClick={() => setMode('single')}>
              單則變體
            </button>
            <button type="button" className={`btn sm ${mode === 'thread' ? 'accent' : 'ghost'}`} onClick={() => setMode('thread')}>
              Thread 串文
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn accent" onClick={generate} disabled={!canGenerate}>
              產生
            </button>
            {mode === 'thread' && items.length > 0 && (
              <button type="button" className="btn ghost" onClick={() => void copy(threadFull, 'thread')}>
                {copied === 'thread' ? '已複製' : '複製整串'}
              </button>
            )}
          </div>
          {items.length > 0 && (
            <div className="muted">
              共 {items.length} 則 · 上限 {LIMIT} 字
              {overLimit > 0 ? ` · ${overLimit} 則超限已截斷` : ''}
            </div>
          )}
        </div>

        <div className="panel stack">
          <div className="label">結果</div>
          {items.length === 0 ? (
            <div className="list-item stack" style={{ gap: 6 }}>
              <strong>尚未產生貼文</strong>
              <p className="muted" style={{ margin: 0 }}>
                選一個預設或輸入主題，再按「產生」。單則會給 3 個變體；Thread 會拆成 4 則串文。
              </p>
            </div>
          ) : (
            items.map((it) => {
              const isFav = favs.some((f) => f.text === it.text)
              return (
                <div key={it.id} className="list-item stack">
                  <div className="row">
                    {it.n != null && <span className="tag">#{it.n}</span>}
                    <span className={`mono ${it.chars > LIMIT ? 'tag' : 'muted'}`}>
                      {it.chars}/{LIMIT}
                    </span>
                    <span className="tag">{it.tone}</span>
                  </div>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {it.text}
                  </pre>
                  <div className="row">
                    <button type="button" className="btn sm ghost" onClick={() => void copy(it.text, it.id)}>
                      {copied === it.id ? '已複製' : '複製'}
                    </button>
                    <button type="button" className={`btn sm ${isFav ? 'accent' : 'ghost'}`} onClick={() => toggleFav(it)}>
                      {isFav ? '已收藏' : '收藏'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="panel stack">
          <div className="row">
            <div className="label">產生歷史</div>
            <span className="muted">{history.length}</span>
            <button type="button" className="btn sm ghost" disabled={!history.length} onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          {history.length === 0 ? (
            <p className="muted">產生後會留在這裡，方便還原設定。</p>
          ) : (
            <ul className="list" style={{ maxHeight: 260, overflow: 'auto' }}>
              {history.map((h) => (
                <li key={h.id} className="list-item row">
                  <div style={{ flex: 1 }}>
                    <strong>{h.topic}</strong>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {h.tone} · {h.mode === 'thread' ? '串文' : '單則'} · {new Date(h.at).toLocaleString('zh-TW')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => {
                      setTopic(h.topic)
                      setTone(h.tone)
                      setMode(h.mode)
                      setItems(h.items)
                    }}
                  >
                    還原
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel stack">
          <div className="row">
            <div className="label">收藏</div>
            <span className="muted">{favs.length}</span>
            <button type="button" className="btn sm ghost" disabled={!favs.length} onClick={() => setFavs([])}>
              清空
            </button>
          </div>
          {favs.length === 0 ? (
            <p className="muted">把喜歡的變體按「收藏」，之後可一鍵複製。</p>
          ) : (
            <ul className="list" style={{ maxHeight: 260, overflow: 'auto' }}>
              {favs.map((f) => (
                <li key={f.id} className="list-item stack" style={{ gap: 4 }}>
                  <div className="row">
                    <span className="tag">{f.tone}</span>
                    <span className="mono muted">
                      {f.chars}/{LIMIT}
                    </span>
                  </div>
                  <span style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{f.text}</span>
                  <button type="button" className="btn sm ghost" onClick={() => void copy(f.text, `fav-${f.id}`)}>
                    {copied === `fav-${f.id}` ? '已複製' : '複製'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ProjectShell>
  )
}
