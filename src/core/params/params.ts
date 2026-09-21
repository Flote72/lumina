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

/** Crop in normalized image coordinates. `angle` in degrees, positive = clockwise. */
export interface CropParams {
  cx: number
  cy: number
  w: number
  h: number
  angle: number
  /** 'original' | 'free' | 'W:H' */
  ratio: string
}

export interface EditParams {
  version: 1
  basic: BasicParams
  crop: CropParams
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

export function createDefaultParams(): EditParams {
  return { version: 1, basic: { ...DEFAULT_BASIC }, crop: { ...DEFAULT_CROP } }
}

/** Fill missing fields (forward-compatible loading of stored JSON). */
export function mergeDefaults(raw: Partial<EditParams> | null | undefined): EditParams {
  const d = createDefaultParams()
  return { version: 1, basic: { ...d.basic, ...raw?.basic }, crop: { ...d.crop, ...raw?.crop } }
}

export function isDefaultCrop(c: CropParams): boolean {
  return c.cx === 0.5 && c.cy === 0.5 && c.w === 1 && c.h === 1 && c.angle === 0
}

export function needsBlur(b: BasicParams): { small: boolean; large: boolean } {
  return { small: b.texture !== 0, large: b.clarity !== 0 || b.dehaze !== 0 }
}
