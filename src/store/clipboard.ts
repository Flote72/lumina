import { create } from 'zustand'
import { extractPatch, type GroupId } from '@/core/params/groups'
import { applyPatch, type DeepPartial, type EditParams } from '@/core/params/params'
import { targetIds } from './library'
import { usePhotos } from './photos'

interface ClipboardState {
  patch: DeepPartial<EditParams> | null
  /** which dialog is open */
  dialog: null | 'copy' | 'sync' | 'savePreset'
  openDialog: (d: 'copy' | 'sync' | 'savePreset') => void
  closeDialog: () => void
  copy: (groups: GroupId[]) => void
  paste: () => Promise<void>
  /** Apply the current photo's selected settings to every other selected photo. */
  sync: (groups: GroupId[]) => Promise<void>
  /** Apply the previous photo's (in the given order) settings to the current one. */
  applyPrevious: (visible: string[]) => Promise<void>
}

export const useClipboard = create<ClipboardState>()((set, get) => ({
  patch: null,
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),

  copy: (groups) => {
    const { currentId, params } = usePhotos.getState()
    if (!currentId) return
    set({ patch: extractPatch(params[currentId]!, groups), dialog: null })
  },

  paste: async () => {
    const patch = get().patch
    const ids = targetIds()
    if (!patch || !ids.length) return
    await usePhotos.getState().applyTo(ids, (p) => applyPatch(p, patch), 'Paste settings')
  },

  sync: async (groups) => {
    const { currentId, params } = usePhotos.getState()
    if (!currentId) return
    const patch = extractPatch(params[currentId]!, groups)
    const ids = targetIds().filter((id) => id !== currentId)
    set({ dialog: null })
    if (ids.length) await usePhotos.getState().applyTo(ids, (p) => applyPatch(p, patch), 'Sync settings')
  },

  applyPrevious: async (visible) => {
    const { currentId, params } = usePhotos.getState()
    if (!currentId) return
    const i = visible.indexOf(currentId)
    const prev = visible[i - 1]
    if (!prev || !params[prev]) return
    const patch = extractPatch(params[prev]!, ['wb', 'tone', 'presence', 'curve', 'mixer', 'grading', 'detail', 'lens', 'effects'])
    await usePhotos.getState().applyTo([currentId], (p) => applyPatch(p, patch), 'Previous')
  },
}))
