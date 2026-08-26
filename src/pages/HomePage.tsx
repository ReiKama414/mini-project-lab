import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  allTags,
  projects,
  tagLabels,
  tiers,
  type Tier,
} from '../projects/registry'
import { clearLabStorage, countLabStorageKeys } from '../lib/storage'

const badge: Record<Tier, string> = {
  quick: 'quick',
  feature: 'feature',
  product: 'product',
  portfolio: 'portfolio',
}

export function HomePage() {
  const ctx = useOutletContext<{ query: string } | null>()
  const query = ctx?.query ?? ''
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [labKeys, setLabKeys] = useState(() => countLabStorageKeys())
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const tags = useMemo(() => allTags(), [])

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (tierFilter !== 'all' && p.tier !== tierFilter) return false
      if (tagFilter && !p.tags.includes(tagFilter)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q) || (tagLabels[t] || '').includes(q))
      )
    })
  }, [q, tierFilter, tagFilter])

  const tierCounts = useMemo(() => {
    const base = projects.filter((p) => {
      if (tagFilter && !p.tags.includes(tagFilter)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q) || (tagLabels[t] || '').includes(q))
      )
    })
    return Object.fromEntries(
      tiers.map((t) => [t.id, base.filter((p) => p.tier === t.id).length]),
    ) as Record<Tier, number>
  }, [q, tagFilter])

  function scrollToTier(id: Tier) {
    setTierFilter('all')
    requestAnimationFrame(() => {
      document.getElementById(`tier-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function requestClearCache() {
    setClearStep(1)
  }

  function confirmClearCache() {
    setClearStep(2)
  }

  function cancelClearCache() {
    setClearStep(0)
  }

  function executeClearCache() {
    clearLabStorage()
    setLabKeys(0)
    setClearStep(0)
    window.location.reload()
  }

  return (
    <div>
      <section className="home-hero">
        <h1>Mini Project Lab</h1>
        <p>
          用搜尋、分類或標籤快速找到你要的工具。目前已收錄 {projects.length}{' '}
          個獨立小專案，之後還能持續新增。
        </p>
        <div className="home-stats">
          <span className="home-stat">{filtered.length} / {projects.length} 個專案</span>
          <span className="home-stat">上方搜尋 · 左側導覽</span>
        </div>
      </section>

      <section className="browse-bar panel">
        <div className="browse-row">
          <span className="browse-label">分類</span>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${tierFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTierFilter('all')}
            >
              全部 {projects.length}
            </button>
            {tiers.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip ${tierFilter === t.id ? 'active' : ''}`}
                style={{ ['--chip' as string]: t.color }}
                onClick={() => setTierFilter(t.id)}
                onDoubleClick={() => scrollToTier(t.id)}
                title={`${t.blurb}（雙擊跳到區塊）`}
              >
                {t.label} {tierCounts[t.id]}
              </button>
            ))}
          </div>
        </div>
        <div className="browse-row">
          <span className="browse-label">標籤</span>
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${!tagFilter ? 'active' : ''}`}
              onClick={() => setTagFilter(null)}
            >
              不限
            </button>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tagFilter === t ? 'active' : ''}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                {tagLabels[t] || t}
              </button>
            ))}
          </div>
        </div>
        {(tierFilter !== 'all' || tagFilter || q) && (
          <div className="row" style={{ marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              目前顯示 {filtered.length} 個
              {q ? ` · 搜尋「${query}」` : ''}
              {tierFilter !== 'all' ? ` · ${tiers.find((t) => t.id === tierFilter)?.label}` : ''}
              {tagFilter ? ` · ${tagLabels[tagFilter] || tagFilter}` : ''}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setTierFilter('all')
                setTagFilter(null)
              }}
            >
              清除篩選
            </button>
          </div>
        )}
      </section>

      {tiers.map((tier, i) => {
        const list = filtered.filter((p) => p.tier === tier.id)
        if (!list.length) return null
        if (tierFilter !== 'all' && tierFilter !== tier.id) return null
        return (
          <section
            key={tier.id}
            id={`tier-${tier.id}`}
            className="tier-block"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="tier-head">
              <div>
                <h2>{tier.label}</h2>
                <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                  {tier.blurb}
                </p>
              </div>
              <span>{list.length} 個專案</span>
            </div>
            <div className="project-grid">
              {list.map((p) => (
                <Link key={p.slug} to={`/p/${p.slug}`} className="project-card">
                  <div className="meta">
                    <span className={`badge ${badge[p.tier]}`}>{tier.label}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {p.tags.map((t) => tagLabels[t] || t).join(' · ')}
                    </span>
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {!filtered.length && (
        <div className="panel">
          <p>找不到符合的專案。試試「todo」「ai」「github」「財務」或清除篩選。</p>
        </div>
      )}

      <section className="panel home-data-panel" aria-label="本機資料">
        <div className="home-data-row">
          <div>
            <h2 className="home-data-title">本機資料</h2>
            <p className="muted home-data-desc">
              各工具會把設定與紀錄存在瀏覽器 localStorage（鍵名以{' '}
              <span className="mono">lab:</span> 開頭）。目前約有 {labKeys} 筆快取鍵。
            </p>
          </div>
          {clearStep === 0 && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={requestClearCache}
              disabled={labKeys === 0}
            >
              清除全部快取
            </button>
          )}
        </div>

        {clearStep === 1 && (
          <div className="home-data-confirm">
            <p>
              將刪除本站所有本機資料（待辦、番茄紀錄、倒數計時器、筆記等），此動作無法復原。
            </p>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={cancelClearCache}>
                取消
              </button>
              <button type="button" className="btn accent sm" onClick={confirmClearCache}>
                我了解，繼續
              </button>
            </div>
          </div>
        )}

        {clearStep === 2 && (
          <div className="home-data-confirm is-danger">
            <p>
              <strong>第二次確認：</strong>確定要立刻清除全部{' '}
              <span className="mono">lab:</span> 快取並重新載入頁面？
            </p>
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={cancelClearCache}>
                取消
              </button>
              <button type="button" className="btn danger sm" onClick={executeClearCache}>
                確定清除
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
