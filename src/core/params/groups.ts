import type { DeepPartial, EditParams } from './params'

/** Selectable groups of settings (copy/paste, sync, "save preset"). */
export const SETTING_GROUPS = [
  { id: 'wb', paths: [['basic', 'temp'], ['basic', 'tint']] },
  { id: 'tone', paths: [['basic', 'exposure'], ['basic', 'contrast'], ['basic', 'highlights'], ['basic', 'shadows'], ['basic', 'whites'], ['basic', 'blacks']] },
  { id: 'presence', paths: [['basic', 'texture'], ['basic', 'clarity'], ['basic', 'dehaze'], ['basic', 'vibrance'], ['basic', 'saturation']] },
  { id: 'curve', paths: [['toneCurve']] },
  { id: 'mixer', paths: [['mixer'], ['bw']] },
  { id: 'grading', paths: [['grading']] },
  { id: 'detail', paths: [['detail']] },
  { id: 'lens', paths: [['lens']] },
  { id: 'transform', paths: [['transform']] },
  { id: 'effects', paths: [['effects']] },
  { id: 'crop', paths: [['crop']] },
] as const

export type GroupId = (typeof SETTING_GROUPS)[number]['id']
export const ALL_GROUPS: GroupId[] = SETTING_GROUPS.map((g) => g.id)
/** Everything except geometry that is specific to one photo. */
export const DEFAULT_COPY_GROUPS: GroupId[] = ALL_GROUPS.filter((g) => g !== 'crop')

/** Copy the selected groups out of `params` as a sparse patch. */
export function extractPatch(params: EditParams, groups: readonly GroupId[]): DeepPartial<EditParams> {
  const out: Record<string, unknown> = {}
  for (const g of SETTING_GROUPS) {
    if (!groups.includes(g.id)) continue
    for (const path of g.paths) {
      let src: unknown = params
      for (const k of path) src = (src as Record<string, unknown>)[k]
      let dst = out
      path.slice(0, -1).forEach((k) => (dst = (dst[k] ??= {}) as Record<string, unknown>))
      dst[path[path.length - 1]!] = structuredClone(src)
    }
  }
  return out as DeepPartial<EditParams>
}

/** Which groups a sparse patch touches (for showing what a preset contains). */
export function patchGroups(patch: DeepPartial<EditParams>): GroupId[] {
  const has = (path: readonly string[]) => {
    let cur: unknown = patch
    for (const k of path) {
      if (cur === undefined || cur === null || typeof cur !== 'object') return false
      cur = (cur as Record<string, unknown>)[k]
    }
    return cur !== undefined
  }
  return SETTING_GROUPS.filter((g) => g.paths.some(has)).map((g) => g.id)
}
