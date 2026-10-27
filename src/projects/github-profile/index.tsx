import { getProject } from '../registry'
import { FeatureLayout } from '../../components/FeatureLayout'
import { ActionButton } from '../../components/ActionButton'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import {
  friendlyGithubHttpError,
  formatRateLimitHint,
  rateLimitFromHeaders,
} from '../../lib/githubApi'
import { charCount, cn, copyText, isNonEmpty, limitText } from '../../lib/utils'

const meta = getProject('github-profile')!

const USER_MAX = 39

const SAMPLES = ['octocat', 'vercel', 'facebook', 'microsoft']

type Profile = {
  login: string
  name: string | null
  bio: string | null
  avatar_url: string
  html_url: string
  public_repos: number
  public_gists: number
  followers: number
  following: number
  location: string | null
  company: string | null
  blog: string | null
  twitter_username: string | null
  created_at: string
  updated_at: string
}

type Repo = {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  forks_count: number
  language: string | null
  updated_at: string
  fork: boolean
  archived: boolean
}

type GhEvent = {
  id: string
  type: string
  repo: { name: string; url: string }
  created_at: string
}

function languageCounts(repos: Repo[]) {
  const map = new Map<string, number>()
  for (const r of repos) {
    if (!r.language) continue
    map.set(r.language, (map.get(r.language) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

function eventLabel(ev: GhEvent) {
  const map: Record<string, string> = {
    PushEvent: 'Push',
    WatchEvent: 'Star',
    ForkEvent: 'Fork',
    IssuesEvent: 'Issue',
    PullRequestEvent: 'PR',
    CreateEvent: '建立',
    PublicEvent: '公開',
  }
  return map[ev.type] || ev.type.replace(/Event$/, '')
}

function blogHref(blog: string) {
  return blog.startsWith('http') ? blog : `https://${blog}`
}

export default function Page() {
  const [user, setUser] = useLocalStorage('lab:github-profile:user', 'octocat')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reposTop, setReposTop] = useState<Repo[]>([])
  const [reposRecent, setReposRecent] = useState<Repo[]>([])
  const [repoSampleSize, setRepoSampleSize] = useState(0)
  const [events, setEvents] = useState<GhEvent[]>([])
  const [showEvents, setShowEvents] = useLocalStorage('lab:github-profile:events', true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rateRemaining, setRateRemaining] = useState<number | null>(null)
  const [rateReset, setRateReset] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const allReposForLang = useMemo(() => {
    const ids = new Set<number>()
    const merged: Repo[] = []
    for (const r of [...reposTop, ...reposRecent]) {
      if (ids.has(r.id)) continue
      ids.add(r.id)
      merged.push(r)
    }
    return merged
  }, [reposTop, reposRecent])

  const languagesFromSample = useMemo(() => languageCounts(allReposForLang), [allReposForLang])

  const summary = useMemo(() => {
    if (!profile) return ''
    const lines = [
      `${profile.name || profile.login} (@${profile.login})`,
      profile.bio || '',
      `倉庫 ${profile.public_repos} · Gists ${profile.public_gists} · Followers ${profile.followers} · Following ${profile.following}`,
      profile.company || profile.location
        ? [profile.company, profile.location].filter(Boolean).join(' · ')
        : '',
      `加入 ${new Date(profile.created_at).toLocaleDateString('zh-TW')}`,
      profile.html_url,
    ].filter(Boolean)
    return lines.join('\n')
  }, [profile])

  async function copyVal(text: string, key: string) {
    await copyText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function load() {
    const q = user.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setProfile(null)
    setReposTop([])
    setReposRecent([])
    setRepoSampleSize(0)
    setEvents([])
    try {
      const [userRes, repoRes] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(q)}`),
        fetch(
          `https://api.github.com/users/${encodeURIComponent(q)}/repos?per_page=100&sort=updated`,
        ),
      ])
      const rl = rateLimitFromHeaders(userRes.headers)
      if (rl.remaining != null) setRateRemaining(rl.remaining)
      if (rl.reset != null) setRateReset(rl.reset)

      if (!userRes.ok) {
        throw new Error(friendlyGithubHttpError(userRes.status, rl.remaining))
      }
      if (!repoRes.ok) {
        const repoRl = rateLimitFromHeaders(repoRes.headers)
        if (repoRl.remaining != null) setRateRemaining(repoRl.remaining)
        throw new Error(
          repoRes.status === 403 || repoRes.status === 429
            ? friendlyGithubHttpError(repoRes.status, repoRl.remaining)
            : `儲存庫錯誤 ${repoRes.status}`,
        )
      }

      const p = (await userRes.json()) as Profile
      const allRepos = (await repoRes.json()) as Repo[]
      setRepoSampleSize(allRepos.length)

      const top = [...allRepos]
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 8)
      const recent = [...allRepos]
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 6)

      setProfile(p)
      setReposTop(top)
      setReposRecent(recent)

      if (showEvents) {
        try {
          const evRes = await fetch(
            `https://api.github.com/users/${encodeURIComponent(q)}/events/public?per_page=10`,
          )
          const evRl = rateLimitFromHeaders(evRes.headers)
          if (evRl.remaining != null) setRateRemaining(evRl.remaining)
          if (evRl.reset != null) setRateReset(evRl.reset)
          if (evRes.ok) setEvents((await evRes.json()) as GhEvent[])
        } catch {
          /* 事件為選用 */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查詢失敗')
    } finally {
      setLoading(false)
    }
  }

  function RepoCard({ r }: { r: Repo }) {
    return (
      <li className="gh-repo-card">
        <div className="gh-repo-head">
          <a href={r.html_url} target="_blank" rel="noreferrer" className="gh-repo-name">
            {r.name}
          </a>
          <span className="tag mono">★ {r.stargazers_count.toLocaleString()}</span>
          {r.language && <span className="tag">{r.language}</span>}
          {r.fork && <span className="tag">fork</span>}
          {r.archived && <span className="tag">archived</span>}
        </div>
        <p className="muted gh-repo-desc">{r.description || '（無描述）'}</p>
        <div className="gh-repo-meta muted">
          <span>forks {r.forks_count.toLocaleString()}</span>
          <span>更新 {new Date(r.updated_at).toLocaleDateString('zh-TW')}</span>
        </div>
      </li>
    )
  }

  return (
    <FeatureLayout
      meta={meta}
      infoItems={[
        { label: '資料來源', value: 'GitHub REST API（公開資料）' },
        { label: '速率限制', value: '未登入約 60 次／小時／IP' },
        { label: '倉庫列表', value: '單次最多取 100 筆公開倉庫' },
        { label: '語言統計', value: '依本次載入的倉庫計數，非全帳號掃描' },
      ]}
      faq={[
        {
          title: '私人倉庫',
          body: '無 Token 時僅能看公開欄位；私人倉庫數量不會出現在列表中。',
        },
        { title: '近期動態', body: '來自 events/public，部分帳號可能為空或延遲。' },
        { title: '隱私', body: '帳號與選項記在本機；請求由瀏覽器直接送往 api.github.com。' },
      ]}
      actions={
        <div className="row gh-shell-actions">
          <ActionButton
            className="btn sm ghost"
            disabled={!profile}
            onClick={() => void copyVal(summary, 'sum')}
            icon="copy"
          >
            {copied === 'sum' ? '已複製' : '複製摘要'}
          </ActionButton>
          {profile && (
            <ActionButton
              className="btn sm accent"
              onClick={() => window.open(profile.html_url, '_blank', 'noopener,noreferrer')}
              icon="download"
            >
              在 GitHub 開啟
            </ActionButton>
          )}
        </div>
      }
      toolbar={
        <>
          <div className="pw-panel-head">
            <h3 className="pw-panel-title">查詢</h3>
            {rateRemaining != null && (
              <span className="tag gh-rate">{formatRateLimitHint(rateRemaining, rateReset)}</span>
            )}
          </div>
          <div className="row gh-search-row">
            <input
              className={cn('field', !isNonEmpty(user) && 'is-invalid')}
              style={{ flex: 1 }}
              placeholder="GitHub 帳號（不含 @）"
              maxLength={USER_MAX}
              value={user}
              onChange={(e) =>
                setUser(limitText(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''), USER_MAX))
              }
              onKeyDown={(e) => e.key === 'Enter' && isNonEmpty(user) && load()}
            />
            <label className="row gh-check">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
              />
              <span className="muted">近期動態</span>
            </label>
            <ActionButton
              className="btn accent"
              onClick={load}
              disabled={loading || !isNonEmpty(user)}
              icon="search"
            >
              {loading ? '查詢中…' : '查詢'}
            </ActionButton>
          </div>
          <div className="field-meta">
            <span className={!isNonEmpty(user) ? 'warn' : undefined}>
              {isNonEmpty(user) ? '可查詢公開資料' : '請輸入帳號'}
            </span>
            <span>
              {charCount(user)}/{USER_MAX}
            </span>
          </div>
          <div className="gh-samples">
            <span className="muted">範例：</span>
            {SAMPLES.map((s) => (
              <button key={s} type="button" className="btn sm ghost" onClick={() => setUser(s)}>
                {s}
              </button>
            ))}
          </div>
          {error && <p className="field-error">{error}</p>}
          {loading && <p className="muted">正在載入個人資料與儲存庫…</p>}
        </>
      }
    >
      <div className="gh-calc">
        <div className="gh-main">
          <section className="panel gh-profile-panel">
            {!profile && !loading && (
              <p className="muted gh-empty">輸入帳號後查詢，會顯示公開個人檔與倉庫摘要。</p>
            )}
            {profile && (
              <div className="gh-profile-body">
                <div className="gh-profile-head">
                  <img
                    className="gh-avatar"
                    src={profile.avatar_url}
                    alt=""
                    width={88}
                    height={88}
                  />
                  <div className="gh-profile-text">
                    <h3 className="pw-panel-title">{profile.name || profile.login}</h3>
                    <a href={profile.html_url} target="_blank" rel="noreferrer" className="gh-login">
                      @{profile.login}
                    </a>
                    {profile.bio && <p className="gh-bio">{profile.bio}</p>}
                    <p className="muted gh-meta-line">
                      {[profile.company, profile.location].filter(Boolean).join(' · ') || '—'}
                    </p>
                    {profile.blog && (
                      <a href={blogHref(profile.blog)} target="_blank" rel="noreferrer">
                        {profile.blog}
                      </a>
                    )}
                    {profile.twitter_username && (
                      <a
                        href={`https://twitter.com/${profile.twitter_username}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{profile.twitter_username}
                      </a>
                    )}
                  </div>
                </div>

                <div className="gh-stats">
                  <div className="gh-stat">
                    <span className="muted">公開倉庫</span>
                    <strong className="mono">{profile.public_repos}</strong>
                  </div>
                  <div className="gh-stat">
                    <span className="muted">Gists</span>
                    <strong className="mono">{profile.public_gists}</strong>
                  </div>
                  <div className="gh-stat">
                    <span className="muted">追蹤者</span>
                    <strong className="mono">{profile.followers}</strong>
                  </div>
                  <div className="gh-stat">
                    <span className="muted">正在追蹤</span>
                    <strong className="mono">{profile.following}</strong>
                  </div>
                </div>

                <ul className="pw-info-list gh-dates">
                  <li>
                    <span className="muted">加入 GitHub</span>
                    <strong>{new Date(profile.created_at).toLocaleDateString('zh-TW')}</strong>
                  </li>
                  <li>
                    <span className="muted">檔案更新</span>
                    <strong>{new Date(profile.updated_at).toLocaleDateString('zh-TW')}</strong>
                  </li>
                  <li>
                    <span className="muted">倉庫樣本</span>
                    <strong>
                      已載入 {repoSampleSize} 筆
                      {profile.public_repos > repoSampleSize ? `（共 ${profile.public_repos}）` : ''}
                    </strong>
                  </li>
                </ul>

                {languagesFromSample.length > 0 && (
                  <div className="gh-lang">
                    <div className="label">
                      語言分布（依已載入的 {allReposForLang.length} 筆公開倉庫）
                    </div>
                    <div className="gh-lang-tags">
                      {languagesFromSample.slice(0, 12).map(([lang, count]) => (
                        <span key={lang} className="tag">
                          {lang} ×{count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel gh-repos-panel">
            <h3 className="pw-panel-title">倉庫</h3>
            {!profile && <p className="muted">—</p>}
            {profile && (
              <div className="gh-repos-body">
                <div className="gh-repo-section">
                  <div className="label">熱門（依 ★ 前 8）</div>
                  <ul className="gh-repo-list">
                    {reposTop.map((r) => <RepoCard key={r.id} r={r} />)}
                    {!reposTop.length && <li className="muted">沒有公開倉庫</li>}
                  </ul>
                </div>
                <div className="gh-repo-section">
                  <div className="label">最近更新（前 6）</div>
                  <ul className="gh-repo-list">
                    {reposRecent.map((r) => <RepoCard key={`r-${r.id}`} r={r} />)}
                  </ul>
                </div>
                {showEvents && events.length > 0 && (
                  <div className="gh-repo-section">
                    <div className="label">近期公開動態</div>
                    <ul className="gh-event-list">
                      {events.map((ev) => (
                        <li key={ev.id} className="gh-event">
                          <span className="tag">{eventLabel(ev)}</span>
                          <span className="gh-event-repo">{ev.repo.name}</span>
                          <span className="muted gh-event-time">
                            {new Date(ev.created_at).toLocaleString('zh-TW')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

      </div>
    </FeatureLayout>
  )
}
