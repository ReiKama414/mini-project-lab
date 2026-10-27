export function rateLimitFromHeaders(headers: Headers): { remaining: number | null; reset: number | null } {
  const rem = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  return {
    remaining: rem != null && rem !== '' ? Number(rem) : null,
    reset: reset != null && reset !== '' ? Number(reset) : null,
  }
}

export function friendlyGithubHttpError(status: number, remaining: number | null): string {
  if (status === 404) return '找不到資源'
  if (status === 403 || status === 429) {
    if (remaining === 0) {
      return 'GitHub API 速率已用盡（未登入約每小時 60 次），請稍後再試'
    }
    return '請求被拒絕（可能觸及速率限制），請稍後再試'
  }
  if (status === 422) return '查詢語法無效，請調整關鍵字或篩選'
  return `錯誤 ${status}`
}

export function formatRateLimitHint(remaining: number | null, reset: number | null): string {
  if (remaining == null) return ''
  let s = `API 剩餘額度：${remaining}`
  if (reset != null && remaining === 0) {
    s += ` · 約於 ${new Date(reset * 1000).toLocaleTimeString('zh-TW')} 重置`
  }
  return s
}
