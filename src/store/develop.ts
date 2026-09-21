import { create } from 'zustand'
import type { ZoomMode } from '@/core/geometry/crop'
import type { CompareMode } from '@/render/protocol'
import type { EditParams } from '@/core/params/params'

export type GuideKind = 'none' | 'thirds' | 'golden' | 'grid' | 'diagonal'
const GUIDES: GuideKind[] = ['thirds', 'golden', 'grid', 'diagonal', 'none']

interface DevelopState {
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

  setReadout: (readout) => set({ readout }),
  setLoadedId: (loadedId) => set({ loadedId }),
  setZoomMode: (zoomMode) => set({ zoomMode, pan: { x: 0, y: 0 }, smooth: true }),
  setView: (customZoom, pan) => set({ zoomMode: 'custom', customZoom, pan, smooth: false }),
  setCompare: (mode) => set((s) => ({ compare: { ...s.compare, mode }, lastSplit: mode === 'lr' || mode === 'tb' ? mode : s.lastSplit })),
  setSplitPos: (pos) => set((s) => ({ compare: { ...s.compare, pos: Math.min(0.98, Math.max(0.02, pos)) } })),
  // \  toggles Before ⇄ After
  cycleCompare: () => set((s) => ({ compare: { ...s.compare, mode: s.compare.mode === 'off' ? 'before' : 'off' } })),
  toggleClipping: () => set((s) => ({ clipping: !s.clipping })),
  enterCrop: (cropSnapshot) => set({ cropEdit: true, cropSnapshot, zoomMode: 'fit', pan: { x: 0, y: 0 }, smooth: true, picking: false }),
  exitCrop: () => set({ cropEdit: false, cropSnapshot: null, zoomMode: 'fit', pan: { x: 0, y: 0 }, smooth: true }),
  cycleGuide: () => set({ guide: GUIDES[(GUIDES.indexOf(get().guide) + 1) % GUIDES.length]! }),
  setPicking: (picking) => set({ picking, mixerTarget: picking ? null : get().mixerTarget }),
  setMixerTarget: (mixerTarget) => set({ mixerTarget, picking: mixerTarget ? false : get().picking }),
}))
