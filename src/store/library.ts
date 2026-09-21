import { useMemo } from 'react'
import { create } from 'zustand'
import { db, type CollectionRow, type ColorLabel, type Flag } from '@/catalog/db'
import { EMPTY_FILTERS, matches, sortComparator, type Filters, type SortKey } from '@/core/library/filter'
import { usePhotos } from './photos'

export type ViewMode = 'grid' | 'loupe' | 'compare' | 'survey'

interface LibraryState {
  view: ViewMode
  thumbSize: number
  filters: Filters
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  selection: string[]
  anchor: string | null
  /** null = whole catalog */
  activeCollection: string | null
  collections: CollectionRow[]
  collectionItems: Record<string, string[]>
  compareCandidate: string | null

  setCompareCandidate: (id: string | null) => void
  setView: (v: ViewMode) => void
  setThumbSize: (n: number) => void
  setFilters: (p: Partial<Filters>) => void
  resetFilters: () => void
  setSort: (s: { key: SortKey; dir: 'asc' | 'desc' }) => void
  /** Click semantics: plain = single, ctrl/cmd = toggle, shift = range (uses `visible`). */
  click: (id: string, visible: string[], mods: { shift?: boolean; toggle?: boolean }) => void
  setSelection: (ids: string[]) => void
  loadCollections: () => Promise<void>
  addCollection: (name: string) => Promise<string>
  renameCollection: (id: string, name: string) => Promise<void>
  removeCollection: (id: string) => Promise<void>
  setActiveCollection: (id: string | null) => void
  addToCollection: (id: string, photoIds: string[]) => Promise<void>
  removeFromCollection: (id: string, photoIds: string[]) => Promise<void>
}

export const useLibrary = create<LibraryState>()((set, get) => ({
  view: 'grid',
  thumbSize: 180,
  filters: EMPTY_FILTERS,
  sort: { key: 'capture', dir: 'asc' },
  selection: [],
  anchor: null,
  activeCollection: null,
  collections: [],
  collectionItems: {},
  compareCandidate: null,

  setCompareCandidate: (compareCandidate) => set({ compareCandidate }),
  setView: (view) => set({ view }),
  setThumbSize: (thumbSize) => set({ thumbSize }),
  setFilters: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  resetFilters: () => set({ filters: EMPTY_FILTERS }),
  setSort: (sort) => set({ sort }),

  click: (id, visible, { shift, toggle }) => {
    const s = get()
    if (shift && s.anchor && visible.includes(s.anchor)) {
      const a = visible.indexOf(s.anchor)
      const b = visible.indexOf(id)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      set({ selection: visible.slice(lo, hi + 1) })
    } else if (toggle) {
      set({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id], anchor: id })
    } else {
      set({ selection: [id], anchor: id })
    }
    usePhotos.getState().select(id)
  },
  setSelection: (selection) => set({ selection }),

  loadCollections: async () => {
    const [collections, items] = await Promise.all([db.collections.toArray(), db.collectionItems.toArray()])
    const map: Record<string, string[]> = {}
    for (const c of collections) map[c.id] = []
    for (const i of items) (map[i.collectionId] ??= []).push(i.photoId)
    collections.sort((a, b) => a.createdAt - b.createdAt)
    set({ collections, collectionItems: map })
  },
  addCollection: async (name) => {
    const row: CollectionRow = { id: crypto.randomUUID(), name: name.trim() || 'Collection', createdAt: Date.now() }
    await db.collections.put(row)
    set((s) => ({ collections: [...s.collections, row], collectionItems: { ...s.collectionItems, [row.id]: [] } }))
    return row.id
  },
  renameCollection: async (id, name) => {
    await db.collections.update(id, { name })
    set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)) }))
  },
  removeCollection: async (id) => {
    await db.collections.delete(id)
    await db.collectionItems.where('collectionId').equals(id).delete()
    set((s) => {
      const items = { ...s.collectionItems }
      delete items[id]
      return { collections: s.collections.filter((c) => c.id !== id), collectionItems: items, activeCollection: s.activeCollection === id ? null : s.activeCollection }
    })
  },
  setActiveCollection: (activeCollection) => set({ activeCollection }),
  addToCollection: async (id, photoIds) => {
    const have = new Set(get().collectionItems[id] ?? [])
    const add = photoIds.filter((p) => !have.has(p))
    if (!add.length) return
    await db.collectionItems.bulkPut(add.map((photoId) => ({ collectionId: id, photoId })))
    set((s) => ({ collectionItems: { ...s.collectionItems, [id]: [...(s.collectionItems[id] ?? []), ...add] } }))
  },
  removeFromCollection: async (id, photoIds) => {
    await db.collectionItems.bulkDelete(photoIds.map((p) => [id, p]) as never)
    const drop = new Set(photoIds)
    set((s) => ({ collectionItems: { ...s.collectionItems, [id]: (s.collectionItems[id] ?? []).filter((p) => !drop.has(p)) } }))
  },
}))

type PhotoMap = ReturnType<typeof usePhotos.getState>['photos']

function computeVisible(photos: PhotoMap, order: string[], l: Pick<LibraryState, 'filters' | 'sort' | 'activeCollection' | 'collectionItems'>): string[] {
  const inColl = l.activeCollection ? new Set(l.collectionItems[l.activeCollection] ?? []) : null
  const cmp = sortComparator(l.sort.key, l.sort.dir)
  return order.filter((id) => photos[id] && (!inColl || inColl.has(id)) && matches(photos[id]!, l.filters)).sort((a, b) => cmp(photos[a]!, photos[b]!))
}

/** Photo ids after collection + filters + sort. */
export function useVisibleIds(): string[] {
  const photos = usePhotos((s) => s.photos)
  const order = usePhotos((s) => s.order)
  const filters = useLibrary((s) => s.filters)
  const sort = useLibrary((s) => s.sort)
  const activeCollection = useLibrary((s) => s.activeCollection)
  const collectionItems = useLibrary((s) => s.collectionItems)
  return useMemo(() => computeVisible(photos, order, { filters, sort, activeCollection, collectionItems }), [photos, order, filters, sort, activeCollection, collectionItems])
}

/** Non-hook version for event handlers. */
export function getVisibleIds(): string[] {
  const p = usePhotos.getState()
  return computeVisible(p.photos, p.order, useLibrary.getState())
}

/** Photos an action (rating, preset, paste…) should apply to: the selection, else the current photo. */
export function targetIds(): string[] {
  const sel = useLibrary.getState().selection.filter((id) => usePhotos.getState().photos[id])
  if (sel.length) return sel
  const cur = usePhotos.getState().currentId
  return cur ? [cur] : []
}

export const LABELS: ColorLabel[] = ['red', 'yellow', 'green', 'blue', 'purple']

export function setRating(ids: string[], rating: number) {
  usePhotos.getState().update(ids, { rating })
}
export function setFlag(ids: string[], flag: Flag) {
  const photos = usePhotos.getState().photos
  // pressing the same flag again clears it (like Lightroom's toggle)
  const all = ids.every((id) => photos[id]?.flag === flag)
  usePhotos.getState().update(ids, { flag: all ? 'none' : flag })
}
export function toggleLabel(ids: string[], label: ColorLabel) {
  const photos = usePhotos.getState().photos
  const all = ids.every((id) => photos[id]?.label === label)
  usePhotos.getState().update(ids, { label: all ? 'none' : label })
}
export function addKeywords(ids: string[], kws: string[]) {
  const photos = usePhotos.getState().photos
  const clean = kws.map((k) => k.trim()).filter(Boolean)
  for (const id of ids) {
    const cur = photos[id]?.keywords ?? []
    const next = [...cur, ...clean.filter((k) => !cur.some((c) => c.toLowerCase() === k.toLowerCase()))]
    if (next.length !== cur.length) usePhotos.getState().update([id], { keywords: next })
  }
}
export function removeKeyword(ids: string[], kw: string) {
  const photos = usePhotos.getState().photos
  for (const id of ids) {
    const cur = photos[id]?.keywords ?? []
    if (cur.includes(kw)) usePhotos.getState().update([id], { keywords: cur.filter((k) => k !== kw) })
  }
}
