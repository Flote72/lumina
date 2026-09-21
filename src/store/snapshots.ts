import { create } from 'zustand'
import { db, type SnapshotRow } from '@/catalog/db'
import { usePhotos } from './photos'

interface SnapshotsState {
  photoId: string | null
  items: SnapshotRow[]
  load: (photoId: string | null) => Promise<void>
  add: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  apply: (id: string) => Promise<void>
}

export const useSnapshots = create<SnapshotsState>()((set, get) => ({
  photoId: null,
  items: [],

  load: async (photoId) => {
    if (!photoId) return set({ photoId, items: [] })
    const items = await db.snapshots.where('photoId').equals(photoId).sortBy('createdAt')
    if (usePhotos.getState().currentId === photoId) set({ photoId, items })
  },

  add: async (name) => {
    const { currentId, params } = usePhotos.getState()
    if (!currentId) return
    const row: SnapshotRow = { id: crypto.randomUUID(), photoId: currentId, name: name.trim() || 'Snapshot', params: structuredClone(params[currentId]!), createdAt: Date.now() }
    await db.snapshots.put(row)
    set((s) => ({ items: [...s.items, row] }))
  },

  rename: async (id, name) => {
    await db.snapshots.update(id, { name })
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, name } : i)) }))
  },

  remove: async (id) => {
    await db.snapshots.delete(id)
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },

  apply: async (id) => {
    const snap = get().items.find((i) => i.id === id)
    const cur = usePhotos.getState().currentId
    if (!snap || !cur) return
    await usePhotos.getState().applyTo([cur], () => structuredClone(snap.params), snap.name)
  },
}))
