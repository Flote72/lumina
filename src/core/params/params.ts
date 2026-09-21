/** Edit parameters — the only thing persisted for an edit. Originals are never modified. */

export interface BasicParams {
  temp: number
  tint: number
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  texture: number
  clarity: number
  dehaze: number
  vibrance: number
  saturation: number
}

/** Crop in normalized image coordinates. `angle` in degrees, positive = clockwise. Also the Transform "Rotate". */
export interface CropParams {
  cx: number
  cy: number
  w: number
  h: number
  angle: number
  /** 'original' | 'free' | 'W:H' */
  ratio: string
}

export interface CurvePoint {
  x: number
  y: number
}
export type CurveChannel = 'rgb' | 'r' | 'g' | 'b'

export interface ToneCurveParams {
  parametric: { highlights: number; lights: number; darks: number; shadows: number; split1: number; split2: number; split3: number }
  points: Record<CurveChannel, CurvePoint[]>
}

export const MIXER_COLORS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'] as const
export type MixerColor = (typeof MIXER_COLORS)[number]
export type MixerRecord = Record<MixerColor, number>
export interface MixerParams {
  hue: MixerRecord
  sat: MixerRecord
  lum: MixerRecord
}

export interface Wheel {
  /** degrees 0..360 */
  h: number
  /** 0..100 */
  s: number
  /** -100..100 */
  l: number
}
export interface GradingParams {
  shadows: Wheel
  midtones: Wheel
  highlights: Wheel
  global: Wheel
  blending: number
  balance: number
}

export interface DetailParams {
  sharpAmount: number
  sharpRadius: number
  sharpDetail: number
  sharpMasking: number
  nrLum: number
  nrColor: number
}

export interface LensParams {
  distortion: number
  vignette: number
  vignetteMid: number
  defringe: number
}

/** (Rotate lives in `crop.angle`.) */
export interface TransformParams {
  vertical: number
  horizontal: number
  scale: number
  aspect: number
  xOffset: number
  yOffset: number
}

export interface EffectsParams {
  vigAmount: number
  vigMid: number
  vigRound: number
  vigFeather: number
  grainAmount: number
  grainSize: number
  grainRough: number
}

/** Black & white conversion; `mix` weights each colour range (like a channel mixer). */
export interface BwParams {
  enabled: boolean
  mix: MixerRecord
}

export interface EditParams {
  version: 1
  basic: BasicParams
  crop: CropParams
  toneCurve: ToneCurveParams
  mixer: MixerParams
  grading: GradingParams
  detail: DetailParams
  lens: LensParams
  transform: TransformParams
  effects: EffectsParams
  bw: BwParams
}

export const DEFAULT_BASIC: Readonly<BasicParams> = {
  temp: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  vibrance: 0,
  saturation: 0,
}

export const DEFAULT_CROP: Readonly<CropParams> = { cx: 0.5, cy: 0.5, w: 1, h: 1, angle: 0, ratio: 'original' }

const zeroMixer = (): MixerRecord => ({ red: 0, orange: 0, yellow: 0, green: 0, aqua: 0, blue: 0, purple: 0, magenta: 0 })
const wheel = (): Wheel => ({ h: 0, s: 0, l: 0 })
const identityPoints = (): CurvePoint[] => [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

export function createDefaultParams(): EditParams {
  return {
    version: 1,
    basic: { ...DEFAULT_BASIC },
    crop: { ...DEFAULT_CROP },
    toneCurve: {
      parametric: { highlights: 0, lights: 0, darks: 0, shadows: 0, split1: 25, split2: 50, split3: 75 },
      points: { rgb: identityPoints(), r: identityPoints(), g: identityPoints(), b: identityPoints() },
    },
    mixer: { hue: zeroMixer(), sat: zeroMixer(), lum: zeroMixer() },
    grading: { shadows: wheel(), midtones: wheel(), highlights: wheel(), global: wheel(), blending: 50, balance: 0 },
    detail: { sharpAmount: 0, sharpRadius: 1, sharpDetail: 25, sharpMasking: 0, nrLum: 0, nrColor: 0 },
    lens: { distortion: 0, vignette: 0, vignetteMid: 50, defringe: 0 },
    transform: { vertical: 0, horizontal: 0, scale: 100, aspect: 0, xOffset: 0, yOffset: 0 },
    effects: { vigAmount: 0, vigMid: 50, vigRound: 0, vigFeather: 50, grainAmount: 0, grainSize: 25, grainRough: 50 },
    bw: { enabled: false, mix: zeroMixer() },
  }
}

function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T
  if (base && typeof base === 'object') {
    const o = (over && typeof over === 'object' ? over : {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(base)) out[k] = deepMerge((base as Record<string, unknown>)[k], o[k])
    return out as T
  }
  return (typeof over === typeof base ? over : base) as T
}

/** Fill missing fields (forward-compatible loading of stored JSON). */
export function mergeDefaults(raw: unknown): EditParams {
  return deepMerge(createDefaultParams(), raw)
}

export function isDefaultCrop(c: CropParams): boolean {
  return c.cx === 0.5 && c.cy === 0.5 && c.w === 1 && c.h === 1 && c.angle === 0
}

/** Which blur/clean-up passes the renderer must run. */
export function passNeeds(p: EditParams) {
  const b = p.basic
  const d = p.detail
  return {
    blurSmall: b.texture !== 0,
    blurLarge: b.clarity !== 0 || b.dehaze !== 0,
    blurSharp: d.sharpAmount > 0,
    cleanup: d.nrLum > 0 || d.nrColor > 0 || p.lens.defringe > 0,
  }
}

/** Read/write helpers for path-addressed params ("mixer.hue.red"). */
export function getIn(obj: unknown, path: readonly string[]): number {
  let cur = obj as Record<string, unknown>
  for (const k of path) cur = cur[k] as Record<string, unknown>
  return cur as unknown as number
}
export function setIn<T>(obj: T, path: readonly string[], value: unknown): T {
  const [k, ...rest] = path
  const src = obj as Record<string, unknown>
  return { ...src, [k!]: rest.length ? setIn(src[k!], rest, value) : value } as T
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** Apply a sparse patch (e.g. a preset) onto params. Arrays (curve points) are replaced, objects merged. */
export function applyPatch(base: EditParams, patch: DeepPartial<EditParams>): EditParams {
  const walk = (b: unknown, p: unknown): unknown => {
    if (p === undefined) return b
    if (Array.isArray(p) || p === null || typeof p !== 'object') return p
    const out: Record<string, unknown> = { ...(b as Record<string, unknown>) }
    for (const k of Object.keys(p)) out[k] = walk(out[k], (p as Record<string, unknown>)[k])
    return out
  }
  return walk(base, patch) as EditParams
}
