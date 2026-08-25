/** Minimal HTML sanitizer for trusted-structure markdown/SVG previews (client-side). */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr',
  'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'ul', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

const ALLOWED_ATTR: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  code: new Set(['class']),
  pre: new Set(['class']),
  span: new Set(['class']),
  div: new Set(['class', 'style']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
}

function isSafeHref(href: string) {
  const t = href.trim()
  if (!t) return false
  if (/^\s*javascript:/i.test(t)) return false
  if (/^\s*data:/i.test(t) && !/^data:image\//i.test(t)) return false
  if (/^\s*vbscript:/i.test(t)) return false
  return /^(https?:|mailto:|tel:|#|\/)/i.test(t)
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip scripts/events; keep a small allowlist of tags. */
export function sanitizeHtml(dirty: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${dirty}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return ''

  const walk = (node: Node) => {
    const children = [...node.childNodes]
    for (const child of children) {
      if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child)
        continue
      }
      if (child.nodeType === Node.TEXT_NODE) continue
      if (child.nodeType !== Node.ELEMENT_NODE) {
        node.removeChild(child)
        continue
      }
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'link' || tag === 'meta') {
        node.removeChild(el)
        continue
      }
      if (!ALLOWED_TAGS.has(tag)) {
        // unwrap unknown tags: keep children
        while (el.firstChild) node.insertBefore(el.firstChild, el)
        node.removeChild(el)
        continue
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on') || name === 'srcdoc') {
          el.removeAttribute(attr.name)
          continue
        }
        const allow = ALLOWED_ATTR[tag]
        if (!allow || !allow.has(name)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (name === 'href' && !isSafeHref(attr.value)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (name === 'style') {
          // only allow simple color/size; drop urls
          if (/url\s*\(|expression|javascript/i.test(attr.value)) el.removeAttribute('style')
        }
      }
      if (tag === 'a') {
        el.setAttribute('rel', 'noopener noreferrer')
        if (el.getAttribute('target') === '_blank') el.setAttribute('target', '_blank')
      }
      walk(el)
    }
  }

  walk(root)
  return root.innerHTML
}

/** Validate SVG and return Blob URL, or empty string if unsafe/invalid. */
export function svgToSafeObjectUrl(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return ''
  const root = doc.documentElement
  if (!root || root.localName.toLowerCase() !== 'svg') return ''
  // strip scripts / event handlers
  root.querySelectorAll('script, foreignObject').forEach((n) => n.remove())
  const all = root.querySelectorAll('*')
  all.forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith('on') || /javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
  })
  const xml = new XMLSerializer().serializeToString(root)
  return URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
}
