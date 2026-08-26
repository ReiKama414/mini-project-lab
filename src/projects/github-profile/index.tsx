import { getProject } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useMemo, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { limitText, charCount, isNonEmpty, cn } from '../../lib/utils'

const meta = getProject('github-profile')!

const USER_MAX = 39

type Profile = {
  login: string
  name: string | null
  bio: string | null
  avatar_url: string
  html_url: string
  public_repos: number
  followers: number
  following: number
  location: string | null
  company: string | null
  blog: string | null
  created_at: string
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
}

type GhEvent = {
  id: string
  type: string
  repo: { name: string; url: string }
  created_at: string
  payload?: { action?: string; ref_type?: string }
}

function rateLimitFromHeaders(headers: Headers): { remaining: number | null; reset: number | null } {
  const rem = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  return {
    remaining: rem != null && rem !== '' ? Number(rem) : null,
    reset: reset != null && reset !== '' ? Number(reset) : null,
  }
}

function friendlyHttpError(status: number, remaining: number | null): string {
  if (status === 404) return '找不到此使用者'
  if (status === 403 || status === 429) {
    if (remaining === 0) {
      return 'GitHub API 速率已用盡（未登入約每小時 60 次），請稍後再試。'
    }
    return '請求被拒絕（可能觸及速率限制），請稍後再試。'
  }
  return `錯誤 ${status}`
}

export default function Page() {
  const [user, setUser] = useLocalStorage('lab:github-profile:user', 'octocat')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [events, setEvents] = useState<GhEvent[]>([])
  const [showEvents, setShowEvents] = useLocalStorage('lab:github-profile:events', true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rateRemaining, setRateRemaining] = useState<number | null>(null)
  const [rateReset, setRateReset] = useState<number | null>(null)

  const languages = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of repos) {
      if (!r.language) continue
      map.set(r.language, (map.get(r.language) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  async function load() {
    const q = user.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setProfile(null)
    setRepos([])
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
        throw new Error(friendlyHttpError(userRes.status, rl.remaining))
      }
      if (!repoRes.ok) {
        const repoRl = rateLimitFromHeaders(repoRes.headers)
        if (repoRl.remaining != null) setRateRemaining(repoRl.remaining)
        throw new Error(
          repoRes.status === 403 || repoRes.status === 429
            ? friendlyHttpError(repoRes.status, repoRl.remaining)
            : `儲存庫錯誤 ${repoRes.status}`,
        )
      }

      const p = (await userRes.json()) as Profile
      const allRepos = (await repoRes.json()) as Repo[]
      const top = [...allRepos]
        .sort((a, b) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6)

      setProfile(p)
      setRepos(top)

      if (showEvents) {
        try {
          const evRes = await fetch(
            `https://api.github.com/users/${encodeURIComponent(q)}/events/public?per_page=8`,
          )
          const evRl = rateLimitFromHeaders(evRes.headers)
          if (evRl.remaining != null) setRateRemaining(evRl.remaining)
          if (evRl.reset != null) setRateReset(evRl.reset)
          if (evRes.ok) setEvents((await evRes.json()) as GhEvent[])
        } catch {
          /* 事件為選用，忽略失敗 */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查詢失敗')
    } finally {
      setLoading(false)
    }
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

  return (
    <ProjectShell meta={meta}>
      <div className="panel stack">
        <div className="row">
          <input
            className={cn('field', !isNonEmpty(user) && 'is-invalid')}
            style={{ flex: 1 }}
            placeholder="GitHub 帳號"
            maxLength={USER_MAX}
            value={user}
            onChange={(e) => setUser(limitText(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''), USER_MAX))}
            onKeyDown={(e) => e.key === 'Enter' && isNonEmpty(user) && load()}
          />
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(e) => setShowEvents(e.target.checked)}
            />
            <span className="muted" style={{ fontSize: 13 }}>
              近期動態
            </span>
          </label>
          <button type="button" className="btn accent" onClick={load} disabled={loading || !isNonEmpty(user)}>
            {loading ? '查詢中…' : '查詢'}
          </button>
        </div>
        <div className="field-meta">
          <span className={!isNonEmpty(user) ? 'warn' : undefined}>{isNonEmpty(user) ? '可查詢' : '請輸入帳號'}</span>
          <span>{charCount(user)}/{USER_MAX}</span>
        </div>
        {rateRemaining != null && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            API 剩餘額度：{rateRemaining}
            {rateReset != null && rateRemaining === 0
              ? ` · 約於 ${new Date(rateReset * 1000).toLocaleTimeString('zh-TW')} 重置`
              : ''}
          </p>
        )}

        {error && (
          <p className="tag" style={{ background: '#d6406a', color: '#fff' }}>
            {error}
          </p>
        )}
        {loading && <p className="muted">正在載入個人資料與儲存庫…</p>}

        {profile && (
          <div className="stack">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <img
                src={profile.avatar_url}
                alt=""
                width={80}
                height={80}
                style={{ borderRadius: '50%' }}
              />
              <div className="stack" style={{ flex: 1 }}>
                <strong style={{ fontSize: 20 }}>{profile.name || profile.login}</strong>
                <a href={profile.html_url} target="_blank" rel="noreferrer">
                  @{profile.login}
                </a>
                {profile.bio && <p style={{ margin: 0 }}>{profile.bio}</p>}
                <p className="muted" style={{ margin: 0 }}>
                  {[profile.company, profile.location].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>

            <div className="grid-3">
              <div className="metric">
                <div className="muted">倉庫</div>
                <div style={{ fontSize: 24 }}>{profile.public_repos}</div>
              </div>
              <div className="metric">
                <div className="muted">Followers</div>
                <div style={{ fontSize: 24 }}>{profile.followers}</div>
              </div>
              <div className="metric">
                <div className="muted">Following</div>
                <div style={{ fontSize: 24 }}>{profile.following}</div>
              </div>
            </div>

            {languages.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">語言提示（依倉庫數）</span>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {languages.map(([lang, count]) => (
                    <span key={lang} className="tag">
                      {lang} ×{count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.blog && (
              <a
                href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`}
                target="_blank"
                rel="noreferrer"
              >
                {profile.blog}
              </a>
            )}
            <p className="muted">加入於 {new Date(profile.created_at).toLocaleDateString('zh-TW')}</p>

            <div className="stack" style={{ gap: 8 }}>
              <span className="label">熱門倉庫（依 ★ 取前 6）</span>
              <ul className="list">
                {repos.map((r) => (
                  <li
                    key={r.id}
                    className="list-item"
                    style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}
                  >
                    <div className="row">
                      <a href={r.html_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                        {r.name}
                      </a>
                      <span className="tag">★ {r.stargazers_count.toLocaleString()}</span>
                      {r.language && <span className="tag">{r.language}</span>}
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {r.description || '（無描述）'}
                    </p>
                    <div className="row muted" style={{ fontSize: 13 }}>
                      <span>forks {r.forks_count}</span>
                      <span>更新 {new Date(r.updated_at).toLocaleDateString('zh-TW')}</span>
                    </div>
                  </li>
                ))}
                {!repos.length && <p className="muted">此帳號沒有公開倉庫</p>}
              </ul>
            </div>

            {showEvents && events.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <span className="label">近期公開動態</span>
                <ul className="list">
                  {events.map((ev) => (
                    <li key={ev.id} className="list-item">
                      <span className="tag">{eventLabel(ev)}</span>
                      <span style={{ flex: 1 }}>{ev.repo.name}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {new Date(ev.created_at).toLocaleString('zh-TW')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </ProjectShell>
  )
}
