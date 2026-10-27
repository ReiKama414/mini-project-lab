import { getProject } from '../registry'
import { FeatureLayout } from '../../components/FeatureLayout'
import { FtMetric, FtMetricGrid, FtToolHero, FtToolRoot } from '../../components/FeatureToolUI'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import {
  friendlyGithubHttpError,
  formatRateLimitHint,
  rateLimitFromHeaders,
} from '../../lib/githubApi'
import { charCount, clamp, cn, copyText, isNonEmpty, limitText, parseNumber } from '../../lib/utils'

const meta = getProject('github-repo-search')!

const Q_MAX = 200
const LANG_MAX = 40
const MAX_FAVS = 50
const PER_PAGE = 10

const QUERY_SAMPLES = [
  { label: 'React TS', q: 'react typescript' },
  { label: 'Next.js', q: 'next.js app router' },
  { label: 'Rust CLI', q: 'rust cli' },
  { label: 'LLM', q: 'llm inference' },
]

const STAR_PRESETS = [0, 100, 500, 1000, 5000]

const LANGS = ['', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Swift', 'Kotlin']

type Repo = {
  id: number
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  forks_count: number
  open_issues_count: number
  updated_at: string
  created_at: string
  license: { spdx_id: string } | null
  topics?: string[]
}

type FavRepo = {
  full_name: string
  html_url: string
  stargazers: number
}

export default function Page() {
  const [q, setQ] = useLocalStorage('lab:github-repo-search:q', 'react typescript')
  const [language, setLanguage] = useLocalStorage('lab:github-repo-search:lang', '')
  const [minStars, setMinStars] = useLocalStorage('lab:github-repo-search:stars', 100)
  const [sort, setSort] = useLocalStorage<'stars' | 'updated' | 'forks'>(
    'lab:github-repo-search:sort',
    'stars',
  )
  const [favs, setFavs] = useLocalStorage<FavRepo[]>('lab:github-repo-search:favs', [])
  const [repos, setRepos] = useState<Repo[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rateRemaining, setRateRemaining] = useState<number | null>(null)
  const [rateReset, setRateReset] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const builtQuery = useMemo(() => {
    const parts = [q.trim()]
    if (language) parts.push(`language:${language}`)
    if (minStars > 0) parts.push(`stars:>=${minStars}`)
    return parts.filter(Boolean).join(' ')
  }, [q, language, minStars])

  function isFav(fullName: string) {
    return favs.some((f) => f.full_name === fullName)
  }

  function toggleFav(repo: { full_name: string; html_url: string; stargazers_count: number }) {
    setFavs((prev) => {
      const exists = prev.some((f) => f.full_name === repo.full_name)
      if (exists) return prev.filter((f) => f.full_name !== repo.full_name)
      if (prev.length >= MAX_FAVS) return prev
      return [
        { full_name: repo.full_name, html_url: repo.html_url, stargazers: repo.stargazers_count },
        ...prev,
      ]
    })
  }

  async function search(nextPage = 1, append = false) {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const url =
        `https://api.github.com/search/repositories?q=${encodeURIComponent(builtQuery)}` +
        `&sort=${sort}&order=desc&per_page=${PER_PAGE}&page=${nextPage}`
      const res = await fetch(url)
      const rl = rateLimitFromHeaders(res.headers)
      if (rl.remaining != null) setRateRemaining(rl.remaining)
      if (rl.reset != null) setRateReset(rl.reset)
      if (!res.ok) throw new Error(friendlyGithubHttpError(res.status, rl.remaining))
      const data = (await res.json()) as { items: Repo[]; total_count: number }
      setRepos((prev) => (append ? [...prev, ...data.items] : data.items))
      setTotal(data.total_count)
      setPage(nextPage)
    } catch (e) {
      if (!append) {
        setRepos([])
        setTotal(0)
      }
      setError(e instanceof Error ? e.message : '搜尋失敗')
    } finally {
      setLoading(false)
    }
  }

  const canLoadMore = repos.length < total && repos.length > 0

  async function copyQuery() {
    await copyText(builtQuery)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const toolbar = (
    <>
      <div className="pw-panel-head">
        <h3 className="pw-panel-title">搜尋</h3>
        {rateRemaining != null && (
          <span className="tag gh-rate">{formatRateLimitHint(rateRemaining, rateReset)}</span>
        )}
      </div>
      <div className="row gh-search-row">
        <input
          className={cn('field', !isNonEmpty(q) && 'is-invalid')}
          style={{ flex: 1 }}
          placeholder="關鍵字、主題或 owner/repo…"
          maxLength={Q_MAX}
          value={q}
          onChange={(e) => setQ(limitText(e.target.value, Q_MAX))}
          onKeyDown={(e) => e.key === 'Enter' && isNonEmpty(q) && search(1, false)}
        />
        <ActionButton
          className="btn accent"
          onClick={() => search(1, false)}
          disabled={loading || !isNonEmpty(q)}
          icon="search"
        >
          {loading && page === 1 ? '搜尋中…' : '搜尋'}
        </ActionButton>
      </div>
      <div className="field-meta">
        <span className={!isNonEmpty(q) ? 'warn' : undefined}>
          {isNonEmpty(q) ? '可搜尋公開儲存庫' : '請輸入關鍵字'}
        </span>
        <span>{charCount(q)}/{Q_MAX}</span>
      </div>
      <div className="gh-samples">
        <span className="muted">範例：</span>
        {QUERY_SAMPLES.map((s) => (
          <button key={s.label} type="button" className="btn sm ghost" onClick={() => setQ(s.q)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="gh-filters">
        <label className="stack gh-filter">
          <span className="label">語言</span>
          <select
            className="field"
            value={language}
            onChange={(e) => setLanguage(limitText(e.target.value, LANG_MAX))}
          >
            {LANGS.map((l) => (
              <option key={l || 'any'} value={l}>
                {l || '不限'}
              </option>
            ))}
          </select>
        </label>
        <label className="stack gh-filter">
          <span className="label">最少 ★</span>
          <input
            className="field"
            type="number"
            min={0}
            value={minStars}
            onChange={(e) => setMinStars(clamp(parseNumber(e.target.value, 0), 0, 1_000_000))}
          />
          <div className="gh-star-presets">
            {STAR_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={`btn sm ${minStars === n ? 'accent' : 'ghost'}`}
                onClick={() => setMinStars(n)}
              >
                {n === 0 ? '不限' : `≥${n}`}
              </button>
            ))}
          </div>
        </label>
        <label className="stack gh-filter">
          <span className="label">排序</span>
          <select
            className="field"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="stars">Stars</option>
            <option value="updated">最近更新</option>
            <option value="forks">Forks</option>
          </select>
        </label>
      </div>
      <div className="gh-query-preview">
        <span className="muted">實際查詢：</span>
        <code className="mono">{builtQuery || '—'}</code>
        {total > 0 && (
          <span className="tag gh-result-count">
            約 {total.toLocaleString()} 筆 · 已顯示 {repos.length}
          </span>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </>
  )

  return (
    <FeatureLayout
      meta={meta}
      toolbar={toolbar}
      actions={
        <div className="row gh-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!builtQuery}
            onClick={() => void copyQuery()}
            icon="copy"
          >
            {copied ? '已複製' : '複製查詢字串'}
          </ActionButton>
        </div>
      }
      infoItems={[
        { label: 'API', value: 'GitHub Search Repositories' },
        { label: '搜尋限制', value: '約 30 次／分鐘（未認證，依 IP）' },
        { label: '一般 REST', value: '約 60 次／小時（未認證）' },
        { label: '收藏', value: `存於本機，最多 ${MAX_FAVS} 筆` },
      ]}
      faq={[
        {
          title: '查詢語法',
          body: '支援 language:、stars:>=、topic: 等 GitHub 搜尋限定；多關鍵字以空白分隔。',
        },
        { title: '排序', body: '依 stars／forks／updated 排序；總筆數為 GitHub 回傳的近似值。' },
        { title: '隱私', body: '搜尋與收藏設定記在本機；請求由瀏覽器直接送往 api.github.com。' },
      ]}
    >
      <FtToolRoot>
        {total > 0 && (
          <>
            <FtToolHero
              emoji="🔍"
              title={`約 ${total.toLocaleString()} 筆結果`}
              subtitle={`查詢：${builtQuery}`}
              meta={`已顯示 ${repos.length} 筆 · 排序 ${sort}`}
              badge={loading ? <span className="tag">載入中</span> : null}
            />
            <FtMetricGrid>
              <FtMetric label="總筆數（約）" value={total.toLocaleString()} />
              <FtMetric label="已載入" value={repos.length} />
              <FtMetric label="收藏" value={`${favs.length}/${MAX_FAVS}`} />
              <FtMetric label="語言" value={language || '不限'} />
            </FtMetricGrid>
          </>
        )}
        <div className="gh-results-inner">
        {favs.length > 0 && (
          <div className="gh-favs-inline">
            <div className="pw-panel-head">
              <h3 className="pw-panel-title">收藏（{favs.length}/{MAX_FAVS}）</h3>
              <ActionButton className="btn sm ghost" onClick={() => setFavs([])} icon="trash">
                清空
              </ActionButton>
            </div>
            <ul className="gh-fav-list">
              {favs.map((f) => (
                <li key={f.full_name} className="gh-fav-item">
                  <a href={f.html_url} target="_blank" rel="noreferrer">
                    {f.full_name}
                  </a>
                  <span className="tag mono">★ {f.stargazers.toLocaleString()}</span>
                  <ActionButton
                    className="btn sm ghost"
                    onClick={() => setFavs((xs) => xs.filter((x) => x.full_name !== f.full_name))}
                    icon="none"
                  >
                    取消
                  </ActionButton>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h3 className="pw-panel-title">結果</h3>
        {!loading && !repos.length && !error && (
          <p className="muted gh-empty">輸入關鍵字並套用篩選後開始搜尋。</p>
        )}
        <ul className="gh-repo-list gh-repo-list-full">
          {repos.map((r) => (
            <li key={r.id} className="gh-repo-card">
              <div className="gh-repo-head">
                <a href={r.html_url} target="_blank" rel="noreferrer" className="gh-repo-name">
                  {r.full_name}
                </a>
                <span className="tag mono">★ {r.stargazers_count.toLocaleString()}</span>
                <ActionButton
                  className={`btn sm ${isFav(r.full_name) ? 'teal' : 'ghost'}`}
                  onClick={() => toggleFav(r)}
                  disabled={!isFav(r.full_name) && favs.length >= MAX_FAVS}
                  icon={isFav(r.full_name) ? 'check' : 'plus'}
                >
                  {isFav(r.full_name) ? '已收藏' : '收藏'}
                </ActionButton>
              </div>
              <p className="muted gh-repo-desc">{r.description || '（無描述）'}</p>
              {r.topics && r.topics.length > 0 && (
                <div className="gh-topics">
                  {r.topics.slice(0, 6).map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
              )}
              <div className="gh-repo-meta muted">
                <span>{r.language || '—'}</span>
                <span>forks {r.forks_count.toLocaleString()}</span>
                <span>issues {r.open_issues_count}</span>
                {r.license && <span>{r.license.spdx_id}</span>}
                <span>建立 {new Date(r.created_at).toLocaleDateString('zh-TW')}</span>
                <span>更新 {new Date(r.updated_at).toLocaleDateString('zh-TW')}</span>
              </div>
            </li>
          ))}
        </ul>
        {canLoadMore && (
          <ActionButton
            className="btn teal"
            disabled={loading}
            onClick={() => search(page + 1, true)}
          >
            {loading ? '載入中…' : '載入更多'}
          </ActionButton>
        )}
        </div>
      </FtToolRoot>
    </FeatureLayout>
  )
}
