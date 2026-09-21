import { newComponent, newMask, newStroke } from '@/core/mask/create'
import { MAX_MASKS, MAX_REDEYES, MAX_SPOTS, type EditParams, type Mask, type MaskComponent, type MaskKind, type MaskOp, type RedEye, type Spot } from '@/core/params/params'
import { useDevelop } from '@/store/develop'
import { usePhotos } from '@/store/photos'

/** History labels are localized by the caller through these keys' English defaults. */
const edit = (fn: (p: EditParams) => EditParams) => usePhotos.getState().edit(fn)
const commit = (label: string) => usePhotos.getState().commit(label)

export function currentMasks(): Mask[] {
  const s = usePhotos.getState()
  return s.currentId ? (s.params[s.currentId]?.masks ?? []) : []
}

const mapMask = (id: string, fn: (m: Mask) => Mask) => (p: EditParams): EditParams => ({ ...p, masks: p.masks.map((m) => (m.id === id ? fn(m) : m)) })
const mapComp = (maskId: string, compId: string, fn: (c: MaskComponent) => MaskComponent) =>
  mapMask(maskId, (m) => ({ ...m, components: m.components.map((c) => (c.id === compId ? fn(c) : c)) }))

export function nextMaskName(kind: MaskKind): string {
  const names: Record<MaskKind, string> = { brush: 'Brush', linear: 'Linear Gradient', radial: 'Radial Gradient', luminance: 'Luminance Range', color: 'Color Range' }
  return `${names[kind]} ${currentMasks().length + 1}`
}

/** Create a mask with one component and select it. Returns null when the mask limit is reached. */
export function createMask(kind: MaskKind, comp?: MaskComponent, name?: string): { maskId: string; compId: string } | null {
  if (currentMasks().length >= MAX_MASKS) return null
  const c = comp ?? newComponent(kind)
  const m = newMask(name ?? nextMaskName(kind), c)
  edit((p) => ({ ...p, masks: [...p.masks, m] }))
  useDevelop.getState().selectMask(m.id, c.id)
  return { maskId: m.id, compId: c.id }
}

export function addComponent(maskId: string, kind: MaskKind, op: MaskOp, comp?: MaskComponent): string {
  const c = comp ?? { ...newComponent(kind, op) }
  edit(mapMask(maskId, (m) => ({ ...m, components: [...m.components, { ...c, op }] })))
  useDevelop.getState().selectMask(maskId, c.id)
  return c.id
}

export function updateMask(id: string, patch: Partial<Mask>) {
  edit(mapMask(id, (m) => ({ ...m, ...patch })))
}
export function setAdjust(id: string, key: keyof Mask['adjust'], value: number) {
  edit(mapMask(id, (m) => ({ ...m, adjust: { ...m.adjust, [key]: value } })))
}
export function updateComponent(maskId: string, compId: string, patch: Record<string, unknown>) {
  edit(mapComp(maskId, compId, (c) => ({ ...c, ...patch }) as MaskComponent))
}
export function removeComponent(maskId: string, compId: string) {
  edit(mapMask(maskId, (m) => ({ ...m, components: m.components.filter((c) => c.id !== compId) })))
  const d = useDevelop.getState()
  if (d.compSel === compId) d.selectMask(maskId, null)
}
export function removeMask(id: string) {
  edit((p) => ({ ...p, masks: p.masks.filter((m) => m.id !== id) }))
  const d = useDevelop.getState()
  if (d.maskSel === id) d.selectMask(null, null)
  if (d.maskDraw && 'maskId' in d.maskDraw && d.maskDraw.maskId === id) d.setMaskDraw(null)
  commit('Delete mask')
}
export function duplicateMask(id: string) {
  const m = currentMasks().find((x) => x.id === id)
  if (!m || currentMasks().length >= MAX_MASKS) return
  const copy: Mask = { ...structuredClone(m), id: crypto.randomUUID(), name: `${m.name} copy`, components: m.components.map((c) => ({ ...structuredClone(c), id: crypto.randomUUID() })) }
  edit((p) => ({ ...p, masks: [...p.masks, copy] }))
  useDevelop.getState().selectMask(copy.id, copy.components[0]?.id ?? null)
  commit('Duplicate mask')
}

// ---- brush ---------------------------------------------------------------------------------------------
export function beginStroke(maskId: string, compId: string, x: number, y: number, erase: boolean) {
  const b = useDevelop.getState().brush
  edit(mapComp(maskId, compId, (c) => (c.kind === 'brush' ? { ...c, strokes: [...c.strokes, newStroke(b, erase, x, y)] } : c)))
}
export function extendStroke(maskId: string, compId: string, x: number, y: number) {
  edit(
    mapComp(maskId, compId, (c) => {
      if (c.kind !== 'brush' || !c.strokes.length) return c
      const strokes = c.strokes.slice()
      const last = strokes[strokes.length - 1]!
      strokes[strokes.length - 1] = { ...last, points: [...last.points, x, y] }
      return { ...c, strokes }
    }),
  )
}

// ---- spots / red-eye ------------------------------------------------------------------------------------
export function addSpot(s: Omit<Spot, 'id'>): string | null {
  const st = usePhotos.getState()
  if (!st.currentId || (st.params[st.currentId]?.spots.length ?? 0) >= MAX_SPOTS) return null
  const spot: Spot = { ...s, id: crypto.randomUUID() }
  edit((p) => ({ ...p, spots: [...p.spots, spot] }))
  useDevelop.getState().setSpotSel(spot.id)
  return spot.id
}
export function updateSpot(id: string, patch: Partial<Spot>) {
  edit((p) => ({ ...p, spots: p.spots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
}
export function removeSpot(id: string) {
  edit((p) => ({ ...p, spots: p.spots.filter((s) => s.id !== id) }))
  if (useDevelop.getState().spotSel === id) useDevelop.getState().setSpotSel(null)
  commit('Delete spot')
}
export function addRedEye(r: Omit<RedEye, 'id'>): string | null {
  const st = usePhotos.getState()
  if (!st.currentId || (st.params[st.currentId]?.redEyes.length ?? 0) >= MAX_REDEYES) return null
  const eye: RedEye = { ...r, id: crypto.randomUUID() }
  edit((p) => ({ ...p, redEyes: [...p.redEyes, eye] }))
  useDevelop.getState().setRedSel(eye.id)
  return eye.id
}
export function updateRedEye(id: string, patch: Partial<RedEye>) {
  edit((p) => ({ ...p, redEyes: p.redEyes.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
}
export function removeRedEye(id: string) {
  edit((p) => ({ ...p, redEyes: p.redEyes.filter((r) => r.id !== id) }))
  if (useDevelop.getState().redSel === id) useDevelop.getState().setRedSel(null)
  commit('Delete red-eye')
}

export { commit as commitEdit }

/** Start creating a mask of `kind`: drags on the image create it (range masks are created immediately). */
export function startMask(kind: MaskKind, op: MaskOp = 'add', maskId: string | null = null) {
  const d = useDevelop.getState()
  d.setTool('mask')
  if (kind === 'brush' || kind === 'linear' || kind === 'radial') {
    if (kind === 'brush') d.setOverlay(true)
    d.setMaskDraw({ kind, op, maskId })
    return
  }
  // luminance / colour range: no shape to draw
  if (maskId) {
    const cid = addComponent(maskId, kind, op)
    if (kind === 'color') d.setMaskDraw({ kind: 'colorpick', maskId, compId: cid })
  } else {
    const made = createMask(kind)
    if (made && kind === 'color') d.setMaskDraw({ kind: 'colorpick', maskId: made.maskId, compId: made.compId })
  }
  commit(kind === 'color' ? 'Color range' : 'Luminance range')
}

