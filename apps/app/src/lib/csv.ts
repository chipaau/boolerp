/** Rows of cells as CSV text: every cell quoted, quotes doubled, CRLF between rows (what spreadsheets expect). */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

/** Downloads rows as a CSV file. A blocked download fails quietly; callers still log the intent. */
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  try {
    const a = document.createElement('a')
    // the BOM keeps Excel reading Thaana and accents as UTF-8
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  } catch {
    // a blocked download still logs the intent
  }
}

/**
 * Parses CSV text into rows of cells: quoted fields (with doubled quotes and embedded commas or
 * line breaks), LF or CRLF line endings, a leading BOM. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  row.push(cell); rows.push(row)
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}
