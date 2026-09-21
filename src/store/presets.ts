import { create } from 'zustand'
import { db, type PresetRow } from '@/catalog/db'
import { extractPatch, type GroupId } from '@/core/params/groups'
import { applyPatch, type DeepPartial, type EditParams } from '@/core/params/params'
import { BUILTIN_PRESETS } from '@/core/presets/builtin'
import { parseXmpPreset } from '@/core/presets/xmp'
import { translate, type Lang } from '@/i18n'
import { targetIds } from './library'
import { usePhotos } from './photos'
import { useToastStore } from './toast'
import { useUiStore } from './ui'

export interface PresetItem {
  id: string
  name: string
  group: string
  patch: DeepPartial<EditParams>
  builtin: boolean
}

const JSON_FORMAT = 'lumina-preset'

interface PresetsState {
  user: PresetRow[]
  load: () => Promise<void>
  add: (name: string, group: string, patch: DeepPartial<EditParams>, source: PresetRow['source']) => Promise<PresetRow>
  saveCurrent: (name: string, group: string, groups: GroupId[]) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Import `.xmp` (Lightroom / Camera Raw) and Lumina `.json` presets. Returns the imported presets. */
  importFiles: (files: File[], opts?: { apply?: boolean }) => Promise<PresetRow[]>
  exportJson: (ids?: string[]) => Blob
}

export const usePresets = create<PresetsState>()((set, get) => ({
  user: [],

  load: async () => {
    const rows = await db.presets.toArray()
    rows.sort((a, b) => a.createdAt - b.createdAt)
    set({ user: rows })
  },

  add: async (name, group, patch, source) => {
    const row: PresetRow = { id: crypto.randomUUID(), name, group, patch, source, createdAt: Date.now() }
    await db.presets.put(row)
    set((s) => ({ user: [...s.user, row] }))
    return row
  },

  saveCurrent: async (name, group, groups) => {
    const id = usePhotos.getState().currentId
    if (!id) return
    await get().add(name, group, extractPatch(usePhotos.getState().params[id]!, groups), 'user')
  },

  remove: async (id) => {
    await db.presets.delete(id)
    set((s) => ({ user: s.user.filter((p) => p.id !== id) }))
  },

  importFiles: async (files, opts) => {
    const lang = useUiStore.getState().lang
    const toast = useToastStore.getState().push
    const out: PresetRow[] = []
    for (const f of files) {
      try {
        const text = await f.text()
        if (/\.xmp$/i.test(f.name)) {
          const r = parseXmpPreset(text)
          if (r.applied === 0) {
            toast(translate(lang, 'preset.noSettings', { name: f.name }), 'error')
            continue
          }
          const name = r.name === 'Imported preset' ? f.name.replace(/\.xmp$/i, '') : r.name
          const row = await get().add(name, r.group, r.patch, 'xmp')
          out.push(row)
          const skipped = r.skipped.length ? translate(lang, 'preset.skipped', { n: r.skipped.length, list: r.skipped.slice(0, 6).join(', ') }) : ''
          if (opts?.apply && targetIds().length) {
            await applyPreset({ id: row.id, name, group: r.group, patch: r.patch, builtin: false })
            toast(`${translate(lang, 'preset.appliedImported', { name, n: r.applied })}${skipped}`)
          } else toast(`${translate(lang, 'preset.imported', { name, n: r.applied })}${skipped}`)
        } else {
          const j = JSON.parse(text) as { format?: string; presets?: { name: string; group?: string; patch: DeepPartial<EditParams> }[] }
          if (j.format !== JSON_FORMAT || !Array.isArray(j.presets)) throw new Error('not a Lumina preset file')
          for (const p of j.presets) out.push(await get().add(String(p.name), String(p.group ?? ''), p.patch, 'json'))
          toast(translate(lang, 'preset.importedMany', { n: j.presets.length }))
        }
      } catch (e) {
        toast(translate(lang, 'preset.importFailed', { name: f.name, msg: (e as Error).message }), 'error')
      }
    }
    return out
  },

  exportJson: (ids) => {
    const rows = get().user.filter((p) => !ids || ids.includes(p.id))
    const doc = { format: JSON_FORMAT, version: 1, presets: rows.map((p) => ({ name: p.name, group: p.group, patch: p.patch })) }
    return new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  },
}))

export function builtinItems(lang: Lang): PresetItem[] {
  return BUILTIN_PRESETS.map((b) => ({ id: b.id, name: b.name[lang], group: b.group[lang], patch: b.patch, builtin: true }))
}

/** Apply a preset to the selection (or current photo) as one undoable step per photo. */
export async function applyPreset(p: PresetItem) {
  const ids = targetIds()
  if (!ids.length) return
  await usePhotos.getState().applyTo(ids, (params) => applyPatch(params, p.patch), p.name)
}
