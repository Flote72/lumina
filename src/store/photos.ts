import { create } from 'zustand'
import { createDefaultParams, type EditParams } from '@/core/params/params'
import { splitFiles } from '@/platform/fileAccess'
import { translate } from '@/i18n'
import { makeThumbnail } from '@/workers/thumbs'
import { useToastStore } from './toast'
import { useUiStore } from './ui'

export interface Photo {
  id: string
  name: string
  file: File
  width: number
  height: number
  thumbUrl: string | null
  status: 'loading' | 'ok' | 'error'
  error?: string
}

interface HistoryEntry {
  label: string
  params: EditParams
}
interface History {
  entries: HistoryEntry[]
  index: number
}

const MAX_HISTORY = 200

interface PhotosState {
  photos: Record<string, Photo>
  order: string[]
  currentId: string | null
  params: Record<string, EditParams>
  history: Record<string, History>

  importFiles: (files: File[]) => void
  select: (id: string) => void
  /** Live edit (no history entry). Use `commit` when the interaction ends. */
  edit: (fn: (p: EditParams) => EditParams) => void
  commit: (label: string) => void
  undo: () => void
  redo: () => void
  jumpTo: (index: number) => void
  setDims: (id: string, w: number, h: number) => void
}

const clone = <T,>(v: T): T => structuredClone(v)

export const usePhotos = create<PhotosState>()((set, get) => ({
  photos: {},
  order: [],
  currentId: null,
  params: {},
  history: {},

  importFiles: (files) => {
    const lang = useUiStore.getState().lang
    const toast = useToastStore.getState().push
    const { images, raw, skipped } = splitFiles(files)
    if (raw.length) toast(translate(lang, 'import.rawUnsupported', { n: raw.length }), 'error')
    if (skipped) toast(translate(lang, 'import.skipped', { n: skipped }))
    if (!images.length) return

    const added: Photo[] = images.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      width: 0,
      height: 0,
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
    const first = added[0]!
    if (!get().currentId) set({ currentId: first.id })
    useUiStore.getState().setModule('develop')

    for (const p of added) {
      makeThumbnail(p.id, p.file).then(
        (r) =>
          set((s) => ({
            photos: {
              ...s.photos,
              [p.id]: { ...p, width: r.width, height: r.height, thumbUrl: URL.createObjectURL(r.thumb), status: 'ok' },
            },
          })),
        (err: Error) => {
          set((s) => ({ photos: { ...s.photos, [p.id]: { ...p, status: 'error', error: err.message } } }))
          toast(translate(useUiStore.getState().lang, 'import.failed', { name: p.name }), 'error')
        },
      )
    }
  },

  select: (id) => set({ currentId: id }),

  edit: (fn) => {
    const id = get().currentId
    if (!id) return
    set((s) => ({ params: { ...s.params, [id]: fn(s.params[id]!) } }))
  },

  commit: (label) => {
    const id = get().currentId
    if (!id) return
    const s = get()
    const h = s.history[id]!
    const params = s.params[id]!
    if (JSON.stringify(h.entries[h.index]!.params) === JSON.stringify(params)) return
    const entries = [...h.entries.slice(0, h.index + 1), { label, params: clone(params) }]
    const trimmed = entries.length > MAX_HISTORY ? entries.slice(entries.length - MAX_HISTORY) : entries
    set({ history: { ...s.history, [id]: { entries: trimmed, index: trimmed.length - 1 } } })
  },

  jumpTo: (index) => {
    const id = get().currentId
    if (!id) return
    const s = get()
    const h = s.history[id]!
    if (index < 0 || index >= h.entries.length) return
    set({
      params: { ...s.params, [id]: clone(h.entries[index]!.params) },
      history: { ...s.history, [id]: { ...h, index } },
    })
  },
  undo: () => {
    const id = get().currentId
    if (id) get().jumpTo(get().history[id]!.index - 1)
  },
  redo: () => {
    const id = get().currentId
    if (id) get().jumpTo(get().history[id]!.index + 1)
  },

  setDims: (id, w, h) =>
    set((s) => {
      const p = s.photos[id]
      return p && (p.width !== w || p.height !== h) ? { photos: { ...s.photos, [id]: { ...p, width: w, height: h } } } : s
    }),
}))
