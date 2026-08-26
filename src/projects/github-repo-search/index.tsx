import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty, clamp, parseNumber, cn } from '../../lib/utils'

const meta = getProject('github-repo-search')!

const Q_MAX = 200
const LANG_MAX = 40
const MAX_FAVS = 50

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
  license: { spdx_id: string } | null
}

type FavRepo = {
  full_name: string
  html_url: string
  stargazers: number
}

const LANGS = ['', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Swift']
const PER_PAGE = 10

function rateLimitFromHeaders(headers: Headers): { remaining: number | null; reset: number | null } {
  const rem = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  return {
    remaining: rem != null && rem !== '' ? Number(rem) : null,
    reset: reset != null && reset !== '' ? Number(reset) : null,
  }
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

  function buildQuery() {
    const parts = [q.trim()]
    if (language) parts.push(`language:${language}`)
    if (minStars > 0) parts.push(`stars:>=${minStars}`)
    return parts.filter(Boolean).join(' ')
  }

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
    const query = buildQuery()
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const url =
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}` +
        `&sort=${sort}&order=desc&per_page=${PER_PAGE}&page=${nextPage}`
      const res = await fetch(url)
      const rl = rateLimitFromHeaders(res.headers)
      if (rl.remaining != null) setRateRemaining(rl.remaining)
      if (rl.reset != null) setRateReset(rl.reset)
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          throw new Error(
            rl.remaining === 0
              ? 'GitHub API 速率已用盡（搜尋 API 限制較嚴），請稍後再試。'
              : '請求被拒絕（可能觸及速率限制），請稍後再試。',
          )
        }
        throw new Error(`API 錯誤 ${res.status}`)
      }
      const data = (await res.json()) as { items: Repo[]; total_count: number }
      setRepos((prev) => (append ? [...prev, ...data.items] : data.items))
      setTotal(data.total_count)
      setPage(nextPage)
    } catch (e) {
      if (!append) setRepos([])
      setError(e instanceof Error ? e.message : '搜尋失敗')
    } finally {
      setLoading(false)
    }
  }

  const canLoadMore = repos.length < total && repos.length > 0

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input
            className={cn('field', !isNonEmpty(q) && 'is-invalid')}
            style={{ flex: 1 }}
            placeholder="搜尋關鍵字…"
            maxLength={Q_MAX}
            value={q}
            onChange={(e) => setQ(limitText(e.target.value, Q_MAX))}
            onKeyDown={(e) => e.key === 'Enter' && isNonEmpty(q) && search(1, false)}
          />
          <button type="button" className="btn accent" onClick={() => search(1, false)} disabled={loading || !isNonEmpty(q)}>
            {loading && page === 1 ? '搜尋中…' : '搜尋'}
          </button>
        </div>
        <div className="field-meta">
          <span className={!isNonEmpty(q) ? 'warn' : undefined}>{isNonEmpty(q) ? '可搜尋' : '請輸入關鍵字'}</span>
          <span>{charCount(q)}/{Q_MAX}</span>
        </div>
        {rateRemaining != null && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            API 剩餘額度：{rateRemaining}
            {rateReset != null && rateRemaining === 0
              ? ` · 約於 ${new Date(rateReset * 1000).toLocaleTimeString('zh-TW')} 重置`
              : ''}
          </p>
        )}

        <div className="grid-3">
          <label className="stack" style={{ gap: 4 }}>
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
          <label className="stack" style={{ gap: 4 }}>
            <span className="label">最少 ★</span>
            <input
              className="field"
              type="number"
              min={0}
              value={minStars}
              onChange={(e) => setMinStars(clamp(parseNumber(e.target.value, 0), 0, 1000000))}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
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

        <div className="row">
          <span className="muted">
            查詢：<span className="mono">{buildQuery() || '—'}</span>
          </span>
          {total > 0 && (
            <span className="tag" style={{ marginLeft: 'auto' }}>
              約 {total.toLocaleString()} 筆 · 已顯示 {repos.length}
            </span>
          )}
        </div>

        {error && (
          <p className="tag" style={{ background: '#d6406a', color: '#fff' }}>
            {error}
          </p>
        )}

        {favs.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              <span className="label">收藏（{favs.length}/{MAX_FAVS}）</span>
              <button type="button" className="btn sm ghost" onClick={() => setFavs([])}>
                清空收藏
              </button>
            </div>
            <ul className="list">
              {favs.map((f) => (
                <li key={f.full_name} className="list-item">
                  <a href={f.html_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, flex: 1 }}>
                    {f.full_name}
                  </a>
                  <span className="tag">★ {f.stargazers.toLocaleString()}</span>
                  <button type="button" className="btn sm ghost" onClick={() => setFavs((xs) => xs.filter((x) => x.full_name !== f.full_name))}>
                    取消
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="list">
          {repos.map((r) => (
            <li
              key={r.id}
              className="list-item"
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
            >
              <div className="row">
                <a href={r.html_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {r.full_name}
                </a>
                <span className="tag">★ {r.stargazers_count.toLocaleString()}</span>
                <button
                  type="button"
                  className={`btn sm ${isFav(r.full_name) ? 'teal' : 'ghost'}`}
                  onClick={() => toggleFav(r)}
                  disabled={!isFav(r.full_name) && favs.length >= MAX_FAVS}
                >
                  {isFav(r.full_name) ? '已收藏' : '收藏'}
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {r.description || '（無描述）'}
              </p>
              <div className="row muted" style={{ fontSize: 13, flexWrap: 'wrap' }}>
                <span>{r.language || '—'}</span>
                <span>forks {r.forks_count}</span>
                <span>issues {r.open_issues_count}</span>
                {r.license && <span>{r.license.spdx_id}</span>}
                <span>更新 {new Date(r.updated_at).toLocaleDateString('zh-TW')}</span>
              </div>
            </li>
          ))}
        </ul>

        {canLoadMore && (
          <button
            type="button"
            className="btn teal"
            disabled={loading}
            onClick={() => search(page + 1, true)}
          >
            {loading ? '載入中…' : '載入更多'}
          </button>
        )}

        {!loading && !repos.length && !error && (
          <p className="muted">輸入關鍵字並套用篩選後開始搜尋公開儲存庫</p>
        )}
      </div>
    </ProjectShell>
  )
}
