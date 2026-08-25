/** RFC4180-ish CSV parse / stringify (handles quotes, commas, newlines). */

export function parseCsv(text: string, delimiter = ','): string[][] {
  const delim = delimiter || ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let i = 0
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')

  while (i < s.length) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delim) {
      row.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.length) || rows.length === 0) rows.push(row)
      row = []
      i++
      continue
    }
    cell += ch
    i++
  }
  row.push(cell)
  if (row.length > 1 || row[0] !== '' || rows.length === 0) rows.push(row)

  const width = Math.max(1, ...rows.map((r) => r.length))
  return rows.map((r) => {
    const copy = r.slice()
    while (copy.length < width) copy.push('')
    return copy
  })
}

export function stringifyCsv(rows: string[][], delimiter = ','): string {
  const delim = delimiter || ','
  const esc = (v: string) => {
    if (/["\r\n]/.test(v) || v.includes(delim)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  return rows.map((r) => r.map(esc).join(delim)).join('\n')
}
