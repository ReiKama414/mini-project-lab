import { getProject } from '../registry'
import { FeatureLayout, ftPrivacyLocal } from '../../components/FeatureLayout'
import { DeleteButton } from '../../components/DeleteButton'
import { ActionButton } from '../../components/ActionButton'
import {
  FtMetric,
  FtMetricGrid,
  FtRowItem,
  FtRowList,
  FtSection,
  FtToolHero,
  FtToolRoot,
} from '../../components/FeatureToolUI'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import {
  charCount,
  isNonEmpty,
  isValidHttpUrl,
  limitText,
  normalizeHttpUrl,
  copyText,
  downloadText,
  uid,
} from '../../lib/utils'

const meta = getProject('url-shortener')!

const URL_MAX = 2048
const CODE_MAX = 32
const NOTE_MAX = 80
const SEARCH_MAX = 80

const URL_SAMPLES = [
  'https://developer.mozilla.org',
  'https://github.com',
  'https://react.dev',
]

type Link = {
  id: string
  code: string
  url: string
  createdAt: number
  clicks: number
  note?: string
}

function makeCode(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len)
}

function shortPath(code: string) {
  return `/s/${code}`
}

function fullShortUrl(code: string) {
  const base = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
  return `${base}${shortPath(code)}`
}

export default function Page() {
  const [links, setLinks] = useLocalStorage<Link[]>('lab:url-shortener', [])
  const [url, setUrl] = useState('https://')
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const normalized = normalizeHttpUrl(url)
  const urlOk = isValidHttpUrl(normalized)
  const canCreate = urlOk && isNonEmpty(url)

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return links
    return links.filter(
      (l) =>
        l.code.toLowerCase().includes(s) ||
        l.url.toLowerCase().includes(s) ||
        (l.note || '').toLowerCase().includes(s),
    )
  }, [links, q])

  const totalClicks = links.reduce((n, l) => n + l.clicks, 0)

  function create() {
    const u = normalizeHttpUrl(url)
    if (!isValidHttpUrl(u)) {
      setError('請輸入有效的 http/https URL')
      setMsg('')
      return
    }
    let code = limitText(custom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''), CODE_MAX) || makeCode()
    if (links.some((l) => l.code === code)) {
      setError(`短碼「${code}」已存在`)
      setMsg('')
      return
    }
    const item: Link = {
      id: uid('url'),
      code,
      url: u,
      createdAt: Date.now(),
      clicks: 0,
      note: note.trim() ? limitText(note.trim(), NOTE_MAX) : undefined,
    }
    setLinks([item, ...links])
    setUrl('https://')
    setCustom('')
    setNote('')
    setError('')
    setMsg(`已建立：${fullShortUrl(code)}`)
  }

  function open(item: Link) {
    setLinks(links.map((l) => (l.id === item.id ? { ...l, clicks: l.clicks + 1 } : l)))
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  function exportLinks() {
    downloadText('url-shortener.json', JSON.stringify(links, null, 2), 'application/json;charset=utf-8')
  }

  return (
    <FeatureLayout
      meta={meta}
      actions={
        <div className="row">
          <ActionButton className="btn sm ghost" disabled={!links.length} onClick={exportLinks}>
            匯出 JSON
          </ActionButton>
          <ActionButton
            className="btn sm ghost"
            disabled={!links.length}
            onClick={() => {
              if (window.confirm('確定清除全部短網址？')) setLinks([])
            }}
          >
            全部清除
          </ActionButton>
        </div>
      }
      toolbar={
        <>
          <div className="stack" style={{ gap: 8 }}>
            <input
              className={`field${!urlOk && isNonEmpty(url) ? ' is-invalid' : ''}`}
              placeholder="原始 URL"
              value={url}
              maxLength={URL_MAX}
              onChange={(e) => {
                setUrl(limitText(e.target.value, URL_MAX))
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && canCreate && create()}
            />
            <div className="field-meta">
              <span>{charCount(url)} / {URL_MAX}</span>
            </div>
            {!urlOk && isNonEmpty(url) && <p className="field-error">請輸入有效的 http/https URL</p>}
            <div className="row">
              <div className="field-wrap" style={{ flex: 1 }}>
                <input
                  className="field"
                  placeholder="自訂短碼（選填）"
                  value={custom}
                  maxLength={CODE_MAX}
                  onChange={(e) => setCustom(limitText(e.target.value, CODE_MAX))}
                />
                <div className="field-meta">
                  <span>{charCount(custom)} / {CODE_MAX}</span>
                </div>
              </div>
              <div className="field-wrap" style={{ flex: 1 }}>
                <input
                  className="field"
                  placeholder="備註（選填）"
                  value={note}
                  maxLength={NOTE_MAX}
                  onChange={(e) => setNote(limitText(e.target.value, NOTE_MAX))}
                />
                <div className="field-meta">
                  <span>{charCount(note)} / {NOTE_MAX}</span>
                </div>
              </div>
              <ActionButton type="button" className="btn accent" onClick={create} disabled={!canCreate}>
                縮短
              </ActionButton>
            </div>
          </div>
          <div className="ft-samples">
            <span className="muted">範例 URL：</span>
            {URL_SAMPLES.map((u) => (
              <button key={u} type="button" className="btn sm ghost" onClick={() => setUrl(u)}>
                {new URL(u).hostname}
              </button>
            ))}
          </div>
          {error && <p className="field-error">{error}</p>}
          <div className="field-wrap">
            <input
              className="field"
              style={{ width: '100%' }}
              placeholder="搜尋短碼 / URL / 備註…"
              value={q}
              maxLength={SEARCH_MAX}
              onChange={(e) => setQ(limitText(e.target.value, SEARCH_MAX))}
            />
            <div className="field-meta">
              <span>{charCount(q)} / {SEARCH_MAX}</span>
            </div>
          </div>
        </>
      }
      infoItems={[
        { label: '儲存位置', value: '本機 localStorage' },
        { label: '轉址路徑', value: '/s/短碼（同站同瀏覽器）' },
        { label: 'URL 上限', value: `${URL_MAX} 字元` },
        { label: '短碼', value: `自訂或隨機 6 碼，${CODE_MAX} 字元內` },
      ]}
      faq={[
        ftPrivacyLocal,
        {
          title: '如何分享',
          body: '複製完整本機 URL 後在同一瀏覽器開啟會轉址；換裝置或清除資料後短碼會失效。',
        },
        {
          title: '點擊計次',
          body: '「開啟（計次）」與直接造訪 /s/ 路徑都會累計點擊次數。',
        },
      ]}
    >
      <FtToolRoot>
        <FtToolHero
          emoji="🔗"
          title={`${links.length} 則短網址`}
          subtitle={
            q.trim()
              ? `搜尋「${q.trim()}」· 顯示 ${visible.length} 則`
              : `總點擊 ${totalClicks} · 平均 ${links.length ? (totalClicks / links.length).toFixed(1) : '0'} 次`
          }
          badge={msg ? <span className="tag">{msg}</span> : null}
        />
        <FtMetricGrid>
          <FtMetric label="連結數" value={links.length} />
          <FtMetric label="總點擊" value={totalClicks} />
          <FtMetric
            label="平均點擊"
            value={links.length ? (totalClicks / links.length).toFixed(1) : '0'}
          />
          <FtMetric label="篩選結果" value={visible.length} />
        </FtMetricGrid>
        <FtSection title="短網址列表">
          <FtRowList>
            {visible.map((l) => (
              <FtRowItem key={l.id}>
                <div className="stack" style={{ flex: 1, gap: 8, minWidth: 0 }}>
                  <div className="row">
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {shortPath(l.code)}
                    </span>
                    <span className="tag">點擊 {l.clicks}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                    {l.url}
                  </span>
                  {l.note && <span className="tag">{l.note}</span>}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {new Date(l.createdAt).toLocaleString('zh-TW')}
                  </span>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <ActionButton type="button" className="btn sm teal" onClick={() => open(l)}>
                      開啟（計次）
                    </ActionButton>
                    <ActionButton
                      type="button"
                      className="btn sm ghost"
                      onClick={() => copyText(l.code)}
                      icon="copy"
                    >
                      複製短碼
                    </ActionButton>
                    <ActionButton
                      type="button"
                      className="btn sm ghost"
                      onClick={() => {
                        void copyText(fullShortUrl(l.code))
                        setMsg('已複製完整本機 URL')
                      }}
                    >
                      複製完整 URL
                    </ActionButton>
                    <DeleteButton onClick={() => setLinks(links.filter((x) => x.id !== l.id))} label="刪除" />
                  </div>
                </div>
              </FtRowItem>
            ))}
          </FtRowList>
          {!visible.length && <p className="muted">尚無短網址</p>}
        </FtSection>
      </FtToolRoot>
    </FeatureLayout>
  )
}
