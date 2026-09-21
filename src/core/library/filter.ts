import type { ColorLabel, Flag } from '@/catalog/db'

export interface PhotoLike {
  name: string
  rating: number
  flag: Flag
  label: ColorLabel
  keywords: string[]
  camera: string
  lens: string
  iso: number | null
  capturedAt: number | null
  addedAt: number
  hasEdits: boolean
}

export interface Filters {
  text: string
  /** minimum star rating */
  minRating: number
  flag: 'any' | Flag
  labels: ColorLabel[]
  camera: string
  lens: string
  isoMin: number | null
  isoMax: number | null
  dateFrom: number | null
  dateTo: number | null
  keyword: string
  edited: 'any' | 'yes' | 'no'
}

export const EMPTY_FILTERS: Filters = {
  text: '',
  minRating: 0,
  flag: 'any',
  labels: [],
  camera: '',
  lens: '',
  isoMin: null,
  isoMax: null,
  dateFrom: null,
  dateTo: null,
  keyword: '',
  edited: 'any',
}

export function filtersActive(f: Filters): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS)
}

export function matches(p: PhotoLike, f: Filters): boolean {
  if (f.minRating > 0 && p.rating < f.minRating) return false
  if (f.flag !== 'any' && p.flag !== f.flag) return false
  if (f.labels.length && !f.labels.includes(p.label)) return false
  if (f.camera && p.camera !== f.camera) return false
  if (f.lens && p.lens !== f.lens) return false
  if (f.isoMin !== null && (p.iso === null || p.iso < f.isoMin)) return false
  if (f.isoMax !== null && (p.iso === null || p.iso > f.isoMax)) return false
  const t = p.capturedAt ?? p.addedAt
  if (f.dateFrom !== null && t < f.dateFrom) return false
  if (f.dateTo !== null && t > f.dateTo) return false
  if (f.keyword && !p.keywords.some((k) => k.toLowerCase() === f.keyword.toLowerCase())) return false
  if (f.edited === 'yes' && !p.hasEdits) return false
  if (f.edited === 'no' && p.hasEdits) return false
  const q = f.text.trim().toLowerCase()
  if (q) {
    const hay = [p.name, p.camera, p.lens, ...p.keywords].join(' ').toLowerCase()
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false
  }
  return true
}

export type SortKey = 'capture' | 'name' | 'rating' | 'added'

export function sortComparator(key: SortKey, dir: 'asc' | 'desc') {
  const s = dir === 'asc' ? 1 : -1
  const byName = (a: PhotoLike, b: PhotoLike) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  return (a: PhotoLike, b: PhotoLike): number => {
    let d: number
    switch (key) {
      case 'name':
        d = byName(a, b)
        break
      case 'rating':
        d = a.rating - b.rating
        break
      case 'added':
        d = a.addedAt - b.addedAt
        break
      default:
        d = (a.capturedAt ?? a.addedAt) - (b.capturedAt ?? b.addedAt)
    }
    return d !== 0 ? d * s : byName(a, b) * s
  }
}

/** Distinct non-empty values, most frequent first (for the filter dropdowns). */
export function distinct(values: string[]): string[] {
  const c = new Map<string, number>()
  for (const v of values) if (v) c.set(v, (c.get(v) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)
}

const INVALID_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])

/** {name}/{seq}/{date}… filename template → filename (no extension). */
export function renderTemplate(
  tpl: string,
  ctx: { name: string; seq: number; date: number | null; rating: number; camera: string },
): string {
  const base = ctx.name.replace(/\.[^.]+$/, '')
  const d = ctx.date ? new Date(ctx.date) : null
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  const date = d ? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` : ''
  const map: Record<string, string> = {
    name: base,
    원본명: base,
    seq: String(ctx.seq),
    순번: String(ctx.seq),
    seq3: pad(ctx.seq, 3),
    seq4: pad(ctx.seq, 4),
    date,
    날짜: date,
    rating: String(ctx.rating),
    camera: ctx.camera.replace(/\s+/g, '-'),
  }
  const filled = tpl.replace(/\{([^}]+)\}/g, (m, k: string) => map[k.trim()] ?? m)
  // strip characters that are invalid in file names
  const clean = [...filled].map((c) => (INVALID_CHARS.has(c) || c.charCodeAt(0) < 32 ? '_' : c)).join('')
  return clean.trim() || base
}
