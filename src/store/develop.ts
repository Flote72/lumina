import { create } from 'zustand'
import type { ZoomMode } from '@/core/geometry/crop'
import type { CompareMode } from '@/render/protocol'
export type { MaskKind }
import type { DeepPartial, EditParams, MaskKind, MaskOp } from '@/core/params/params'
import { DEFAULT_BRUSH, type BrushSettings } from '@/core/mask/create'

export type GuideKind = 'none' | 'thirds' | 'golden' | 'grid' | 'diagonal'
const GUIDES: GuideKind[] = ['thirds', 'golden', 'grid', 'diagonal', 'none']

export type LocalTool = 'mask' | 'spot' | 'redeye'
/** What the next drag / click on the image creates. */
export type MaskDraw =
  | { kind: 'brush' | 'linear' | 'radial'; op: MaskOp; maskId: string | null }
  | { kind: 'colorpick'; maskId: string; compId: string }

interface DevelopState {
  /** local-adjustment / retouch tool currently active (crop is `cropEdit`) */
  tool: LocalTool | null
  maskDraw: MaskDraw | null
  /** status text while an AI mask is being computed */
  aiBusy: string | null
  setAiBusy: (v: string | null) => void
  maskSel: string | null
  compSel: string | null
  /** show the selected mask as a red overlay */
  overlay: boolean
  brush: BrushSettings & { erase: boolean }
  spotSel: string | null
  spot: { mode: 'heal' | 'clone'; radius: number; feather: number; opacity: number }
  redSel: string | null
  red: { pupil: number; darken: number }
  setTool: (t: LocalTool | null) => void
  setMaskDraw: (d: MaskDraw | null) => void
  selectMask: (maskId: string | null, compId?: string | null) => void
  setOverlay: (v: boolean) => void
  setBrush: (p: Partial<BrushSettings & { erase: boolean }>) => void
  setSpotSel: (id: string | null) => void
  setSpot: (p: Partial<DevelopState['spot']>) => void
  setRedSel: (id: string | null) => void
  setRed: (p: Partial<DevelopState['red']>) => void

  zoomMode: ZoomMode
  customZoom: number
  pan: { x: number; y: number }
  /** true → tween the next view change (button/mode changes), false → snap (wheel/drag) */
  smooth: boolean
  compare: { mode: CompareMode; pos: number }
  lastSplit: 'lr' | 'tb'
  clipping: boolean
  cropEdit: boolean
  cropSnapshot: EditParams['crop'] | null
  guide: GuideKind
  picking: boolean
  /** colour-mixer target tool: which channel a drag on the image edits */
  mixerTarget: 'hue' | 'sat' | 'lum' | null
  /** displayed colour under the cursor (0..255) */
  readout: [number, number, number] | null
  /** id of the photo currently loaded in the renderer */
  loadedId: string | null
  /** preset hover preview (not committed) */
  preview: DeepPartial<EditParams> | null
  setPreview: (p: DeepPartial<EditParams> | null) => void

  setReadout: (v: [number, number, number] | null) => void
  setLoadedId: (id: string | null) => void
  setZoomMode: (m: ZoomMode) => void
  setView: (zoom: number, pan: { x: number; y: number }) => void
  setCompare: (mode: CompareMode) => void
  setSplitPos: (pos: number) => void
  cycleCompare: () => void
  toggleClipping: () => void
  enterCrop: (snapshot: EditParams['crop']) => void
  exitCrop: () => void
  cycleGuide: () => void
  setPicking: (v: boolean) => void
  setMixerTarget: (m: 'hue' | 'sat' | 'lum' | null) => void
}

export const useDevelop = create<DevelopState>()((set, get) => ({
  tool: null,
  maskDraw: null,
  aiBusy: null,
  setAiBusy: (aiBusy) => set({ aiBusy }),
  maskSel: null,
  compSel: null,
  overlay: false,
  brush: { ...DEFAULT_BRUSH, erase: false },
  spotSel: null,
  spot: { mode: 'heal', radius: 0.02, feather: 50, opacity: 100 },
  redSel: null,
  red: { pupil: 50, darken: 50 },
  setTool: (tool) => set((s) => ({ tool, maskDraw: null, picking: false, mixerTarget: null, overlay: tool === 'mask' ? s.overlay : false, cropEdit: tool ? false : s.cropEdit })),
  setMaskDraw: (maskDraw) => set({ maskDraw }),
  selectMask: (maskSel, compId) => set((s) => ({ maskSel, compSel: compId === undefined ? (maskSel === s.maskSel ? s.compSel : null) : compId })),
  setOverlay: (overlay) => set({ overlay }),
  setBrush: (p) => set((s) => ({ brush: { ...s.brush, ...p } })),
  setSpotSel: (spotSel) => set({ spotSel }),
  setSpot: (p) => set((s) => ({ spot: { ...s.spot, ...p } })),
  setRedSel: (redSel) => set({ redSel }),
  setRed: (p) => set((s) => ({ red: { ...s.red, ...p } })),

  zoomMode: 'fit',
  customZoom: 1,
  pan: { x: 0, y: 0 },
  smooth: false,
  compare: { mode: 'off', pos: 0.5 },
  lastSplit: 'lr',
  clipping: false,
  cropEdit: false,
  cropSnapshot: null,
  guide: 'thirds',
  picking: false,
  mixerTarget: null,
  readout: null,
  loadedId: null,
  preview: null,
  setPreview: (preview) => set({ preview }),

  setReadout: (readout) => set({ readout }),
  setLoadedId: (loadedId) => set({ loadedId }),
  setZoomMode: (zoomMode) => set({ zoomMode, pan: { x: 0, y: 0 }, smooth: true }),
  setView: (customZoom, pan) => set({ zoomMode: 'custom', customZoom, pan, smooth: false }),
  setCompare: (mode) => set((s) => ({ compare: { ...s.compare, mode }, lastSplit: mode === 'lr' || mode === 'tb' ? mode : s.lastSplit })),
  setSplitPos: (pos) => set((s) => ({ compare: { ...s.compare, pos: Math.min(0.98, Math.max(0.02, pos)) } })),
  // \  toggles Before ⇄ After
  cycleCompare: () => set((s) => ({ compare: { ...s.compare, mode: s.compare.mode === 'off' ? 'before' : 'off' } })),
  toggleClipping: () => set((s) => ({ clipping: !s.clipping })),
  enterCrop: (cropSnapshot) => set({ tool: null, maskDraw: null, cropEdit: true, cropSnapshot, zoomMode: 'fit', pan: { x: 0, y: 0 }, smooth: true, picking: false }),
  exitCrop: () => set({ cropEdit: false, cropSnapshot: null, zoomMode: 'fit', pan: { x: 0, y: 0 }, smooth: true }),
  cycleGuide: () => set({ guide: GUIDES[(GUIDES.indexOf(get().guide) + 1) % GUIDES.length]! }),
  setPicking: (picking) => set({ picking, mixerTarget: picking ? null : get().mixerTarget }),
  setMixerTarget: (mixerTarget) => set({ mixerTarget, picking: mixerTarget ? false : get().picking }),
}))
