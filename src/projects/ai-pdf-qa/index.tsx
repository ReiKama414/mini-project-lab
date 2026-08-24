import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid } from '../../lib/utils'

const meta = getProject('ai-pdf-qa')!

type Chunk = { id: string; text: string; index: number }
type Hit = { chunkId: string; sentence: string; score: number }
type QA = { id: string; q: string; a: string; hits: Hit[]; at: number }

const SAMPLES: { name: string; text: string }[] = [
  {
    name: '訂閱方案 FAQ',
    text: '本產品提供訂閱制方案。基本方案每月 299 元，含 5 位成員。專業方案每月 799 元，含 25 位成員與優先支援。企業方案支援 SSO 與審計日誌。客服時間為週一至週五 9:00–18:00。退款政策為購買後 7 天內可申請全額退款。匯出功能支援 CSV 與 Markdown。',
  },
  {
    name: '內部規範摘要',
    text: '所有對外文案需經行銷審核。個資僅可存放於核准區域。密碼需至少 12 字元並啟用 MFA。事故回報時限為發現後 1 小時內通知值班。開源授權使用前需法務確認。部署需通過 staging 驗證後才可上 production。',
  },
  {
    name: '產品路線圖',
    text: 'Q3 重點為儀表板改版與離線草稿。Q4 計畫推出行動版與公開 API。公開 API 預計提供讀取專案與任務的 REST 端點。效能目標為首屏小於 2 秒。無障礙目標為符合 WCAG 2.2 AA。',
  },
]

function chunkDoc(doc: string): Chunk[] {
  const paras = doc
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (paras.length <= 1) {
    const sentences = doc
      .split(/(?<=[。！？.!?])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
    const size = 2
    const chunks: Chunk[] = []
    for (let i = 0; i < sentences.length; i += size) {
      chunks.push({ id: uid('ch'), text: sentences.slice(i, i + size).join(''), index: chunks.length })
    }
    return chunks.length ? chunks : [{ id: uid('ch'), text: doc.trim(), index: 0 }]
  }
  return paras.map((text, index) => ({ id: uid('ch'), text, index }))
}

function search(chunks: Chunk[], q: string): { answer: string; hits: Hit[] } {
  const query = q.trim().toLowerCase()
  if (!query) return { answer: '請輸入問題。', hits: [] }
  if (!chunks.length) return { answer: '請先貼上文件內容。', hits: [] }

  const tokens = query
    .split(/[\s,，?？]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)

  const hits: Hit[] = []
  for (const ch of chunks) {
    const sentences = ch.text
      .split(/(?<=[。！？.!?])|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2)
    for (const sentence of sentences) {
      const sl = sentence.toLowerCase()
      const score = tokens.reduce((n, t) => n + (sl.includes(t) ? 1 : 0), 0) + (tokens.some((t) => sl.includes(t.slice(0, 2))) ? 0.2 : 0)
      if (score > 0) hits.push({ chunkId: ch.id, sentence, score })
    }
  }
  hits.sort((a, b) => b.score - a.score)
  const top = hits.slice(0, 5)
  if (!top.length) {
    return {
      answer: `找不到直接對應句。文件開頭：${chunks[0]!.text.slice(0, 80)}…`,
      hits: [],
    }
  }
  return {
    answer: `依文件片段：${top
      .slice(0, 3)
      .map((h) => h.sentence)
      .join(' ')}`,
    hits: top,
  }
}

function highlight(text: string, query: string) {
  const tokens = query
    .split(/[\s,，?？]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
  if (!tokens.length) return text
  const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${esc.join('|')})`, 'gi')
  const hit = new RegExp(`^(${esc.join('|')})$`, 'i')
  const parts = text.split(re)
  return parts.map((p, i) =>
    hit.test(p) ? (
      <mark key={i} style={{ background: '#fef08a', padding: '0 2px' }}>
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export default function Page() {
  const [doc, setDoc] = useLocalStorage('lab:ai-pdf-qa:doc', SAMPLES[0]!.text)
  const [q, setQ] = useState('退款政策是什麼？')
  const [history, setHistory] = useLocalStorage<QA[]>('lab:ai-pdf-qa:history', [])
  const [lastHits, setLastHits] = useState<Hit[]>([])

  const chunks = useMemo(() => chunkDoc(doc), [doc])

  function ask() {
    const { answer, hits } = search(chunks, q)
    setLastHits(hits)
    setHistory((h) => [{ id: uid('qa'), q, a: answer, hits, at: Date.now() }, ...h].slice(0, 30))
  }

  return (
    <ProjectShell meta={meta}>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="label">範例文件</span>
        {SAMPLES.map((s) => (
          <button
            key={s.name}
            type="button"
            className="btn sm ghost"
            onClick={() => {
              setDoc(s.text)
              setLastHits([])
            }}
          >
            {s.name}
          </button>
        ))}
        <span className="muted">區塊數 {chunks.length}</span>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <label className="label">文件內容（貼上 PDF 文字）</label>
          <textarea className="field" rows={10} value={doc} onChange={(e) => setDoc(e.target.value)} />
          <div className="label">文件區塊預覽</div>
          <ul className="list" style={{ maxHeight: 160, overflow: 'auto' }}>
            {chunks.map((c) => (
              <li key={c.id} className="list-item muted" style={{ fontSize: 13 }}>
                #{c.index + 1} {c.text.slice(0, 80)}
                {c.text.length > 80 ? '…' : ''}
              </li>
            ))}
          </ul>
          <label className="label">問題</label>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button type="button" className="btn accent" onClick={ask}>
            搜尋並回答
          </button>
          {lastHits.length > 0 && (
            <div className="stack">
              <div className="label">命中句子（已標示關鍵字）</div>
              {lastHits.map((h, i) => (
                <div key={i} className="list-item">
                  <span className="tag">分數 {h.score.toFixed(1)}</span>
                  <div style={{ marginTop: 4 }}>{highlight(h.sentence, q)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel stack">
          <div className="row">
            <div className="label">問答紀錄</div>
            <button type="button" className="btn sm ghost" onClick={() => setHistory([])}>
              清空
            </button>
          </div>
          {history.length === 0 && <p className="muted">尚無紀錄</p>}
          <ul className="list">
            {history.map((item) => (
              <li key={item.id} className="list-item stack" style={{ gap: 4 }}>
                <strong>Q: {item.q}</strong>
                <span className="muted">A: {item.a}</span>
                {item.hits?.[0] && (
                  <div style={{ fontSize: 13 }}>{highlight(item.hits[0].sentence, item.q)}</div>
                )}
                <span className="mono muted">{new Date(item.at).toLocaleString('zh-TW')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ProjectShell>
  )
}
