import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('ai-tweet')!

type Tone = '專業' | '勵志' | '幽默' | '冷靜'
const LIMIT = 280

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

function singleVariants(topic: string, tone: Tone, tags: string) {
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
  return hooks.map((h) => {
    const text = clip(`${h}\n\n${tag}`)
    return { id: uid('tw'), text, chars: text.length }
  })
}

function thread(topic: string, tone: Tone, tags: string) {
  const t = topic.trim() || '主題'
  const tag = tagLine(tone, tags)
  const parts = [
    `1/ ${t}——先講結論：把目標拆成可驗證的小步。`,
    `2/ 做法：今天只做一件高槓桿任務，其餘進待辦池。`,
    `3/ 檢查：晚上用三句話回顧卡點與下一步。`,
    `4/ 收尾：公開一個小成果，讓自己被節奏拉著走。\n\n${tag}`,
  ]
  return parts.map((p, i) => {
    const text = clip(p)
    return { id: uid('th'), text, chars: text.length, n: i + 1 }
  })
}

export default function Page() {
  const [topic, setTopic] = useLocalStorage('lab:ai-tweet:topic', '側專案上線')
  const [tone, setTone] = useLocalStorage<Tone>('lab:ai-tweet:tone', '專業')
  const [tags, setTags] = useLocalStorage('lab:ai-tweet:tags', 'sideproject')
  const [mode, setMode] = useLocalStorage<'single' | 'thread'>('lab:ai-tweet:mode', 'single')
  const [items, setItems] = useState<{ id: string; text: string; chars: number; n?: number }[]>([])

  const threadFull = useMemo(() => items.map((it) => it.text).join('\n\n'), [items])

  function generate() {
    setItems(mode === 'thread' ? thread(topic, tone, tags) : singleVariants(topic, tone, tags))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="label">主題</label>
        <input className="field" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <label className="label">語氣</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(['專業', '勵志', '幽默', '冷靜'] as Tone[]).map((v) => (
            <button key={v} type="button" className={`btn sm ${tone === v ? 'accent' : 'ghost'}`} onClick={() => setTone(v)}>
              {v}
            </button>
          ))}
        </div>
        <label className="label">額外 Hashtags（空白或逗號分隔）</label>
        <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} />
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
          <button type="button" className="btn accent" onClick={generate}>
            產生
          </button>
          {mode === 'thread' && items.length > 0 && (
            <button type="button" className="btn ghost" onClick={() => copyText(threadFull)}>
              複製整串
            </button>
          )}
        </div>
        <div className="stack">
          {items.map((it) => (
            <div key={it.id} className="list-item stack">
              <div className="row">
                {it.n != null && <span className="tag">#{it.n}</span>}
                <span className={`mono ${it.chars > LIMIT ? 'tag' : 'muted'}`}>
                  {it.chars}/{LIMIT}
                </span>
              </div>
              <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {it.text}
              </pre>
              <button type="button" className="btn sm ghost" onClick={() => copyText(it.text)}>
                複製
              </button>
            </div>
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}
