export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function copyText(text: string) {
  return navigator.clipboard.writeText(text)
}

export function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Truncate string to at most `max` UTF-16 code units. */
export function limitText(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max)
}

/** Character count (code-point aware for emoji / CJK). */
export function charCount(text: string) {
  return Array.from(text).length
}

/** Parse a finite number; empty / invalid → null. */
export function parseNumber(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const t = String(value).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function isNonEmpty(text: string) {
  return text.trim().length > 0
}

/** Prepend https:// when scheme is missing. */
export function normalizeHttpUrl(raw: string) {
  const t = raw.trim()
  if (!t) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t
  return `https://${t}`
}

export function isValidHttpUrl(raw: string) {
  try {
    const u = new URL(normalizeHttpUrl(raw))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidEmail(raw: string) {
  const t = raw.trim()
  if (!t || t.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** Truncate string to at most `max` characters (UTF-16 code units). */
export function limitText(s: string, max: number) {
  if (max <= 0) return ''
  return s.length <= max ? s : s.slice(0, max)
}

export function charCount(s: string) {
  return s.length
}

export function parseNumber(raw: string, fallback = NaN) {
  const t = raw.trim()
  if (!t) return fallback
  const n = Number(t)
  return Number.isFinite(n) ? n : fallback
}

export function isNonEmpty(s: string) {
  return s.trim().length > 0
}

export function isValidHttpUrl(raw: string) {
  const t = raw.trim()
  if (!t) return false
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Trim and prepend https:// when scheme is missing. */
export function normalizeHttpUrl(raw: string) {
  const t = raw.trim()
  if (!t) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t
  return `https://${t}`
}

export function isValidEmail(raw: string) {
  const t = raw.trim()
  if (!t || t.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}
