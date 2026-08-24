import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { copyText, uid } from '../../lib/utils'

const meta = getProject('ai-tweet')!

function variants(topic: string, vibe: string) {
  const t = topic.trim() || '今日進度'
  const hooks = [
    `${t}：一步一步來，也是一種速度。`,
    `關於${t}，我學到最重要的一件事——`,
    `別再拖延${t}了。今天先做這 3 件事：`,
    `${t}不是靈感，是系統。建立節奏就贏一半。`,
    `分享一個${t}小技巧：先定義完成定義，再動手。`,
  ]
  const tags = vibe === '專業' ? '#Productivity #BuildInPublic' : vibe === '幽默' ? '#日常吐槽' : '#學習筆記'
  return hooks.map((h, i) => ({
    id: uid('tw'),
    text: `${h}\n\n${i === 2 ? '1) 釐清目標\n2) 設下時限\n3) 公開承諾\n\n' : ''}${tags}`,
  }))
}

export default function Page() {
  const [topic, setTopic] = useLocalStorage('lab:ai-tweet:topic', '側專案上線')
  const [vibe, setVibe] = useLocalStorage('lab:ai-tweet:vibe', '專業')
  const [items, setItems] = useState<{ id: string; text: string }[]>([])

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <label className="label">主題</label>
        <input className="field" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <label className="label">氛圍</label>
        <div className="row">
          {['專業', '勵志', '幽默'].map((v) => (
            <button key={v} type="button" className={`btn sm ${vibe === v ? 'accent' : 'ghost'}`} onClick={() => setVibe(v)}>
              {v}
            </button>
          ))}
        </div>
        <button type="button" className="btn accent" onClick={() => setItems(variants(topic, vibe))}>
          產生貼文變體
        </button>
        <div className="stack">
          {items.map((it) => (
            <div key={it.id} className="list-item stack">
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
