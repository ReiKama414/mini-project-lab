import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { uid, downloadText, copyText } from '../../lib/utils'

const meta = getProject('ai-pdf-qa')!

type Chunk = { id: string; text: string; index: number }
type Hit = { chunkId: string; sentence: string; score: number }
type QA = { id: string; q: string; a: string; hits: Hit[]; at: number; favorite?: boolean }

const SAMPLES: { name: string; text: string; questions: string[] }[] = [
  {
    name: '訂閱方案 FAQ',
    text: '本產品提供訂閱制方案。基本方案每月 299 元，含 5 位成員。專業方案每月 799 元，含 25 位成員與優先支援。企業方案支援 SSO 與審計日誌。客服時間為週一至週五 9:00–18:00。退款政策為購買後 7 天內可申請全額退款。匯出功能支援 CSV 與 Markdown。',
    questions: ['退款政策是什麼？', '專業方案多少錢？', '客服時間？'],
  },
  {
    name: '內部規範摘要',
    text: '所有對外文案需經行銷審核。個資僅可存放於核准區域。密碼需至少 12 字元並啟用 MFA。事故回報時限為發現後 1 小時內通知值班。開源授權使用前需法務確認。部署需通過 staging 驗證後才可上 production。',
    questions: ['密碼規則？', '事故回報時限？', '部署流程？'],
  },
  {
    name: '產品路線圖',
    text: 'Q3 重點為儀表板改版與離線草稿。Q4 計畫推出行動版與公開 API。公開 API 預計提供讀取專案與任務的 REST 端點。效能目標為首屏小於 2 秒。無障礙目標為符合 WCAG 2.2 AA。',
    questions: ['Q4 有什麼計畫？', '效能目標？', '公開 API 做什麼？'],
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
  const [lastAnswer, setLastAnswer] = useState('')
  const [sampleQs, setSampleQs] = useState(SAMPLES[0]!.questions)
  const [step, setStep] = useState<'doc' | 'ask'>('doc')

  const chunks = useMemo(() => chunkDoc(doc), [doc])
  const favs = history.filter((h) => h.favorite)

  function ask(question = q) {
    const query = question.trim()
    if (!query) return
    setQ(query)
    const { answer, hits } = search(chunks, query)
    setLastHits(hits)
    setLastAnswer(answer)
    setHistory((h) => [{ id: uid('qa'), q: query, a: answer, hits, at: Date.now() }, ...h].slice(0, 40))
    setStep('ask')
  }

  function exportHistory() {
    const body = history
      .map((item) => `Q: ${item.q}\nA: ${item.a}\n— ${new Date(item.at).toLocaleString('zh-TW')}`)
      .join('\n\n')
    downloadText('pdf-qa-history.txt', body || '（尚無紀錄）')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn ghost sm" disabled={!history.length} onClick={exportHistory}>
            匯出問答
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={!history.length}
            onClick={() => {
              setHistory([])
              setLastHits([])
              setLastAnswer('')
            }}
          >
            清空紀錄
          </button>
        </div>
      }
    >
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button type="button" className={`btn sm ${step === 'doc' ? 'accent' : 'ghost'}`} onClick={() => setStep('doc')}>
          1. 文件
        </button>
        <button type="button" className={`btn sm ${step === 'ask' ? 'accent' : 'ghost'}`} onClick={() => setStep('ask')}>
          2. 問答
        </button>
        <span className="muted">區塊 {chunks.length}</span>
        <span className="mono muted">{doc.length} 字</span>
        {favs.length > 0 && <span className="tag">收藏 {favs.length}</span>}
      </div>

      {step === 'doc' && (
        <div className="panel stack">
          <div className="label">範例文件</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {SAMPLES.map((s) => (
              <button
                key={s.name}
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setDoc(s.text)
                  setSampleQs(s.questions)
                  setLastHits([])
                  setLastAnswer('')
                  setQ(s.questions[0] || '')
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className="label">文件內容（貼上 PDF 文字）</label>
          <textarea className="field" rows={10} value={doc} onChange={(e) => setDoc(e.target.value)} />
          {!doc.trim() ? (
            <div className="list-item stack">
              <strong>文件是空的</strong>
              <p className="muted" style={{ margin: 0 }}>
                貼上文字或選範例。本 demo 用關鍵字匹配句子，不呼叫真實 LLM。
              </p>
            </div>
          ) : (
            <>
              <div className="label">文件區塊預覽</div>
              <ul className="list" style={{ maxHeight: 200, overflow: 'auto' }}>
                {chunks.map((c) => (
                  <li key={c.id} className="list-item muted" style={{ fontSize: 13 }}>
                    #{c.index + 1}（{c.text.length} 字）{c.text.slice(0, 80)}
                    {c.text.length > 80 ? '…' : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="btn accent" disabled={!doc.trim()} onClick={() => setStep('ask')}>
            下一步：開始提問 →
          </button>
        </div>
      )}

      {step === 'ask' && (
        <div className="grid-2">
          <div className="panel stack">
            <div className="label">建議問題</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {sampleQs.map((sq) => (
                <button key={sq} type="button" className="btn sm ghost" onClick={() => ask(sq)}>
                  {sq}
                </button>
              ))}
            </div>
            <label className="label">問題</label>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="例如：退款政策是什麼？"
            />
            <div className="row">
              <button type="button" className="btn accent" onClick={() => ask()} disabled={!doc.trim() || !q.trim()}>
                搜尋並回答
              </button>
              <button type="button" className="btn ghost" onClick={() => setStep('doc')}>
                ← 改文件
              </button>
              <span className="mono muted">{q.length} 字</span>
            </div>
            {lastAnswer ? (
              <div className="list-item stack">
                <div className="label">本次回答</div>
                <p style={{ margin: 0 }}>{lastAnswer}</p>
                <button type="button" className="btn sm ghost" onClick={() => void copyText(lastAnswer)}>
                  複製回答
                </button>
              </div>
            ) : (
              <div className="list-item">
                <p className="muted" style={{ margin: 0 }}>
                  輸入問題或點建議問題。會依關鍵字在文件區塊中找命中句子。
                </p>
              </div>
            )}
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
              <button type="button" className="btn sm ghost" onClick={() => setHistory([])} disabled={!history.length}>
                清空
              </button>
            </div>
            {history.length === 0 ? (
              <div className="list-item stack">
                <strong>尚無紀錄</strong>
                <p className="muted" style={{ margin: 0 }}>
                  提問後會出現在這裡，可收藏重要回答。
                </p>
              </div>
            ) : (
              <ul className="list" style={{ maxHeight: 480, overflow: 'auto' }}>
                {history.map((item) => (
                  <li key={item.id} className="list-item stack" style={{ gap: 4 }}>
                    <div className="row">
                      <strong style={{ flex: 1 }}>Q: {item.q}</strong>
                      {item.favorite && <span className="tag">★</span>}
                    </div>
                    <span className="muted">A: {item.a}</span>
                    {item.hits?.[0] && <div style={{ fontSize: 13 }}>{highlight(item.hits[0].sentence, item.q)}</div>}
                    <span className="mono muted">{new Date(item.at).toLocaleString('zh-TW')}</span>
                    <div className="row">
                      <button
                        type="button"
                        className="btn sm ghost"
                        onClick={() => {
                          setQ(item.q)
                          setLastAnswer(item.a)
                          setLastHits(item.hits || [])
                        }}
                      >
                        載入
                      </button>
                      <button type="button" className="btn sm ghost" onClick={() => void copyText(`Q: ${item.q}\nA: ${item.a}`)}>
                        複製
                      </button>
                      <button
                        type="button"
                        className={`btn sm ${item.favorite ? 'accent' : 'ghost'}`}
                        onClick={() => setHistory((xs) => xs.map((x) => (x.id === item.id ? { ...x, favorite: !x.favorite } : x)))}
                      >
                        {item.favorite ? '已收藏' : '收藏'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ProjectShell>
  )
}
