import type { HistogramData } from '@/core/histogram/histogram'
import type { EditParams } from '@/core/params/params'

export type CompareMode = 'off' | 'before' | 'lr' | 'tb'

export interface RenderState {
  params: EditParams
  /** Params used for the "before" side (same crop, default adjustments). */
  before: EditParams
  /** device px per output px */
  zoom: number
  /** device px offset of the frame centre from the viewport centre */
  pan: [number, number]
  /** Crop mode: show the whole rotated image instead of the cropped result. */
  cropEdit: boolean
  compare: { mode: CompareMode; pos: number }
  clipping: boolean
}

export type ToHost =
  | { type: 'init'; canvas: AnyCanvasMsg }
  | { type: 'resize'; w: number; h: number }
  | { type: 'load'; req: number; id: string; blob: Blob }
  | { type: 'unload' }
  | { type: 'render'; state: RenderState }
  | { type: 'probeRGB'; req: number; x: number; y: number }
  | { type: 'probeWork'; req: number; x: number; y: number }

export type AnyCanvasMsg = OffscreenCanvas | HTMLCanvasElement

export type FromHost =
  | { type: 'ready'; maxTextureSize: number; floatTargets: boolean }
  | { type: 'loaded'; req: number; id: string; width: number; height: number }
  | { type: 'error'; req?: number; message: string }
  | { type: 'hist'; data: HistogramData }
  | { type: 'probe'; req: number; rgb: [number, number, number] | null }
