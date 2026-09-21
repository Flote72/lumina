import { create } from 'zustand'
import { createDefaultParams, type EditParams } from '@/core/params/params'
import { db, type ColorLabel, type Flag, type HistoryEntry, type PhotoRow } from '@/catalog/db'
import { readExif } from '@/catalog/exif'
import { translate } from '@/i18n'
import { deleteOriginal, readOriginal, saveOriginal } from '@/platform/originals'
import { splitFiles } from '@/platform/fileAccess'
import { makeThumbnail } from '@/workers/thumbs'
import { useToastStore } from './toast'
import { useUiStore } from './ui'

export interface Photo extends PhotoRow {
  thumbUrl: string | null
  status: 'loading' | 'ok' | 'error'
  error?: string
}

interface History {
  entries: HistoryEntry[]
  index: number
}

const MAX_HISTORY = 200
const MAX_SAVED_HISTORY = 50
/** Files being imported: readable immediately, before the copy into local storage has finished. */
const pendingFiles = new Map<string, File>()

const clone = <T,>(v: T): T => structuredClone(v)
const isDefault = (p: EditParams) => JSON.stringify(p) === JSON.stringify(createDefaultParams())

interface PhotosState {
  ready: boolean
  photos: Record<string, Photo>
  order: string[]
  currentId: string | null
  params: Record<string, EditParams>
  history: Record<string, History>

  hydrate: () => Promise<void>
  importFiles: (files: File[]) => void
  select: (id: string | null) => void
  getFile: (id: string) => Promise<File>
  update: (ids: string[], patch: Partial<PhotoRow>) => void
  remove: (ids: string[]) => Promise<void>
  /** Live edit of the current photo (no history entry). Call `commit` when the interaction ends. */
  edit: (fn: (p: EditParams) => EditParams) => void
  commit: (label: string) => void
  /** Replace params on several photos as one history step each (paste / sync / presets). */
  applyTo: (ids: string[], fn: (p: EditParams) => EditParams, label: string) => Promise<void>
  undo: () => void
  redo: () => void
  jumpTo: (index: number) => void
  ensureHistory: (id: string) => Promise<void>
  setDims: (id: string, w: number, h: number) => void
}

// ---- debounced persistence -----------------------------------------------------------------------
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const histTimers = new Map<string, ReturnType<typeof setTimeout>>()

function persistParams(id: string) {
  clearTimeout(timers.get(id))
  timers.set(
    id,
    setTimeout(async () => {
      const s = usePhotos.getState()
      const params = s.params[id]
      if (!params) return
      const hasEdits = !isDefault(params)
      await db.edits.put({ photoId: id, params, updatedAt: Date.now() })
      if (s.photos[id] && s.photos[id]!.hasEdits !== hasEdits) {
        usePhotos.setState((st) => ({ photos: { ...st.photos, [id]: { ...st.photos[id]!, hasEdits } } }))
        await db.photos.update(id, { hasEdits })
      }
    }, 400),
  )
}
function persistHistory(id: string) {
  clearTimeout(histTimers.get(id))
  histTimers.set(
    id,
    setTimeout(() => {
      const h = usePhotos.getState().history[id]
      if (!h) return
      const from = Math.max(0, h.entries.length - MAX_SAVED_HISTORY)
      void db.history.put({ photoId: id, entries: h.entries.slice(from), index: h.index - from })
    }, 800),
  )
}

function toRow(p: Photo): PhotoRow {
  const row: Partial<Photo> = { ...p }
  delete row.thumbUrl
  delete row.status
  delete row.error
  return row as PhotoRow
}

const rowToPhoto = (r: PhotoRow, thumb?: Blob): Photo => ({
  ...r,
  thumbUrl: thumb ? URL.createObjectURL(thumb) : null,
  status: 'ok',
})

export const usePhotos = create<PhotosState>()((set, get) => ({
  ready: false,
  photos: {},
  order: [],
  currentId: null,
  params: {},
  history: {},

  hydrate: async () => {
    const [rows, thumbs, edits] = await Promise.all([db.photos.toArray(), db.thumbs.toArray(), db.edits.toArray()])
    const tmap = new Map(thumbs.map((t) => [t.id, t.blob]))
    const photos: Record<string, Photo> = {}
    const params: Record<string, EditParams> = {}
    rows.sort((a, b) => a.addedAt - b.addedAt)
    for (const r of rows) photos[r.id] = rowToPhoto(r, tmap.get(r.id))
    const { mergeDefaults } = await import('@/core/params/params')
    for (const r of rows) params[r.id] = createDefaultParams()
    for (const e of edits) if (photos[e.photoId]) params[e.photoId] = mergeDefaults(e.params)
    set({ photos, params, order: rows.map((r) => r.id), ready: true })
    try {
      const last = localStorage.getItem('lumina.current')
      if (last && photos[last]) get().select(last)
      else if (rows[0]) get().select(rows[0].id)
    } catch {
      /* storage unavailable */
    }
  },

  importFiles: (files) => {
    const lang = useUiStore.getState().lang
    const toast = useToastStore.getState().push
    const { images, raw, skipped } = splitFiles(files)
    if (raw.length) toast(translate(lang, 'import.rawUnsupported', { n: raw.length }), 'error')
    if (skipped) toast(translate(lang, 'import.skipped', { n: skipped }))
    if (!images.length) return

    const now = Date.now()
    const added: Photo[] = images.map((file, i) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mime: file.type,
      width: 0,
      height: 0,
      addedAt: now + i,
      capturedAt: null,
      rating: 0,
      flag: 'none',
      label: 'none',
      keywords: [],
      camera: '',
      lens: '',
      iso: null,
      exposureTime: null,
      fNumber: null,
      focalLength: null,
      hasEdits: false,
      exif: null,
      thumbUrl: null,
      status: 'loading',
    }))
    set((s) => {
      const photos = { ...s.photos }
      const params = { ...s.params }
      const history = { ...s.history }
      for (const p of added) {
        photos[p.id] = p
        const d = createDefaultParams()
        params[p.id] = d
        history[p.id] = { entries: [{ label: 'import', params: clone(d) }], index: 0 }
      }
      return { photos, params, history, order: [...s.order, ...added.map((p) => p.id)] }
    })
    if (!get().currentId) get().select(added[0]!.id)
    useUiStore.getState().setModule('develop')

    // Process a few at a time: copy original → EXIF → decode/thumbnail → catalog row
    added.forEach((p, i) => pendingFiles.set(p.id, images[i]!))
    const queue = added.map((p, i) => ({ p, file: images[i]! }))
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { p, file } = job
        try {
          const [exif, thumb] = await Promise.all([readExif(file), makeThumbnail(p.id, file)])
          await saveOriginal(p.id, file)
          pendingFiles.delete(p.id)
          const row: PhotoRow = {
            ...toRow(p),
            width: thumb.width,
            height: thumb.height,
            capturedAt: exif.capturedAt,
            camera: exif.camera,
            lens: exif.lens,
            iso: exif.iso,
            exposureTime: exif.exposureTime,
            fNumber: exif.fNumber,
            focalLength: exif.focalLength,
            exif: exif.raw,
          }
          await db.photos.put(row)
          await db.thumbs.put({ id: p.id, blob: thumb.thumb })
          set((s) => ({ photos: { ...s.photos, [p.id]: { ...row, thumbUrl: URL.createObjectURL(thumb.thumb), status: 'ok' } } }))
        } catch (err) {
          set((s) => ({ photos: { ...s.photos, [p.id]: { ...p, status: 'error', error: (err as Error).message } } }))
          toast(translate(useUiStore.getState().lang, 'import.failed', { name: p.name }), 'error')
        }
      }
    }
    void Promise.all([worker(), worker(), worker()])
  },

  select: (id) => {
    set({ currentId: id })
    try {
      if (id) localStorage.setItem('lumina.current', id)
    } catch {
      /* storage unavailable */
    }
    if (id) void get().ensureHistory(id)
  },

  getFile: async (id) => {
    const p = get().photos[id]
    if (!p) throw new Error('Unknown photo')
    const pending = pendingFiles.get(id)
    if (pending) return pending
    return readOriginal(id, p.name, p.mime)
  },

  update: (ids, patch) => {
    set((s) => {
      const photos = { ...s.photos }
      for (const id of ids) if (photos[id]) photos[id] = { ...photos[id]!, ...patch }
      return { photos }
    })
    void db.photos.bulkUpdate(ids.map((key) => ({ key, changes: patch })))
  },

  remove: async (ids) => {
    const set_ = new Set(ids)
    for (const id of ids) {
      const u = get().photos[id]?.thumbUrl
      if (u) URL.revokeObjectURL(u)
      await deleteOriginal(id)
    }
    await db.transaction('rw', ['photos', 'thumbs', 'edits', 'history', 'snapshots', 'collectionItems'], async () => {
      await db.photos.bulkDelete(ids)
      await db.thumbs.bulkDelete(ids)
      await db.edits.bulkDelete(ids)
      await db.history.bulkDelete(ids)
      await db.snapshots.where('photoId').anyOf(ids).delete()
      await db.collectionItems.where('photoId').anyOf(ids).delete()
    })
    set((s) => {
      const photos = { ...s.photos }
      const params = { ...s.params }
      const history = { ...s.history }
      for (const id of ids) {
        delete photos[id]
        delete params[id]
        delete history[id]
      }
      const order = s.order.filter((id) => !set_.has(id))
      const currentId = s.currentId && set_.has(s.currentId) ? (order[0] ?? null) : s.currentId
      return { photos, params, history, order, currentId }
    })
  },

  ensureHistory: async (id) => {
    if (get().history[id]) return
    const saved = await db.history.get(id)
    if (get().history[id]) return
    const params = get().params[id] ?? createDefaultParams()
    const h: History =
      saved && saved.entries.length
        ? { entries: saved.entries, index: Math.min(saved.index, saved.entries.length - 1) }
        : { entries: [{ label: 'import', params: clone(params) }], index: 0 }
    // saved history may be stale relative to autosaved params: make the head match what is on screen
    if (JSON.stringify(h.entries[h.index]!.params) !== JSON.stringify(params)) {
      h.entries = [...h.entries.slice(0, h.index + 1), { label: 'restore', params: clone(params) }]
      h.index = h.entries.length - 1
    }
    set((s) => ({ history: { ...s.history, [id]: h } }))
  },

  edit: (fn) => {
    const id = get().currentId
    if (!id) return
    set((s) => ({ params: { ...s.params, [id]: fn(s.params[id]!) } }))
    persistParams(id)
  },

  commit: (label) => {
    const id = get().currentId
    if (!id) return
    const s = get()
    const h = s.history[id]
    if (!h) return
    const params = s.params[id]!
    if (JSON.stringify(h.entries[h.index]!.params) === JSON.stringify(params)) return
    const entries = [...h.entries.slice(0, h.index + 1), { label, params: clone(params) }]
    const trimmed = entries.length > MAX_HISTORY ? entries.slice(entries.length - MAX_HISTORY) : entries
    set({ history: { ...s.history, [id]: { entries: trimmed, index: trimmed.length - 1 } } })
    persistHistory(id)
  },

  applyTo: async (ids, fn, label) => {
    for (const id of ids) await get().ensureHistory(id)
    set((s) => {
      const params = { ...s.params }
      const history = { ...s.history }
      for (const id of ids) {
        const next = fn(params[id]!)
        params[id] = next
        const h = history[id]!
        const entries = [...h.entries.slice(0, h.index + 1), { label, params: clone(next) }].slice(-MAX_HISTORY)
        history[id] = { entries, index: entries.length - 1 }
      }
      return { params, history }
    })
    for (const id of ids) {
      persistParams(id)
      persistHistory(id)
    }
  },

  jumpTo: (index) => {
    const id = get().currentId
    if (!id) return
    const s = get()
    const h = s.history[id]
    if (!h || index < 0 || index >= h.entries.length) return
    set({
      params: { ...s.params, [id]: clone(h.entries[index]!.params) },
      history: { ...s.history, [id]: { ...h, index } },
    })
    persistParams(id)
    persistHistory(id)
  },
  undo: () => {
    const id = get().currentId
    const h = id ? get().history[id] : undefined
    if (h) get().jumpTo(h.index - 1)
  },
  redo: () => {
    const id = get().currentId
    const h = id ? get().history[id] : undefined
    if (h) get().jumpTo(h.index + 1)
  },

  setDims: (id, w, h) =>
    set((s) => {
      const p = s.photos[id]
      return p && (p.width !== w || p.height !== h) ? { photos: { ...s.photos, [id]: { ...p, width: w, height: h } } } : s
    }),
}))

export type { ColorLabel, Flag }
