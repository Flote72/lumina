export type ResizeMode = 'original' | 'longEdge' | 'percent' | 'dimensions'

export interface ResizeSettings {
  mode: ResizeMode
  /** px, for 'longEdge' */
  longEdge: number
  /** 1..400, for 'percent' */
  percent: number
  /** bounding box for 'dimensions' (0 = unbounded) */
  width: number
  height: number
  /** never enlarge beyond the cropped size */
  noUpscale: boolean
}

export const MAX_OUTPUT_SIDE = 16384
export const MAX_OUTPUT_PIXELS = 200_000_000

/** Output pixel size for a cropped image of cw × ch. Aspect ratio is always preserved. */
export function outputSize(cw: number, ch: number, r: ResizeSettings): { w: number; h: number; scale: number } {
  let scale = 1
  switch (r.mode) {
    case 'longEdge':
      scale = r.longEdge > 0 ? r.longEdge / Math.max(cw, ch) : 1
      break
    case 'percent':
      scale = Math.max(1, r.percent) / 100
      break
    case 'dimensions': {
      const sx = r.width > 0 ? r.width / cw : Infinity
      const sy = r.height > 0 ? r.height / ch : Infinity
      scale = Math.min(sx, sy)
      if (!Number.isFinite(scale)) scale = 1
      break
    }
  }
  if (r.noUpscale && r.mode !== 'original') scale = Math.min(scale, 1)
  // hard limits (canvas size / memory)
  scale = Math.min(scale, MAX_OUTPUT_SIDE / Math.max(cw, ch), Math.sqrt(MAX_OUTPUT_PIXELS / (cw * ch)))
  return { w: Math.max(1, Math.round(cw * scale)), h: Math.max(1, Math.round(ch * scale)), scale }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Split an output of w × h into tiles of at most `tile` px. */
export function tiles(w: number, h: number, tile: number): Rect[] {
  const out: Rect[] = []
  for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) out.push({ x, y, w: Math.min(tile, w - x), h: Math.min(tile, h - y) })
  return out
}

export type WatermarkPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'

/** Top-left corner of a wm × wh box placed at a 3×3 grid position inside w × h, with a margin in px. */
export function watermarkOrigin(pos: WatermarkPosition, w: number, h: number, wm: number, wh: number, margin: number): { x: number; y: number } {
  const col = pos[1] === 'l' ? 0 : pos[1] === 'c' ? 1 : 2
  const row = pos[0] === 't' ? 0 : pos[0] === 'm' ? 1 : 2
  const x = col === 0 ? margin : col === 1 ? (w - wm) / 2 : w - wm - margin
  const y = row === 0 ? margin : row === 1 ? (h - wh) / 2 : h - wh - margin
  return { x: Math.round(x), y: Math.round(y) }
}

export type SharpenTarget = 'none' | 'screen' | 'print'
export type SharpenAmount = 'low' | 'standard' | 'high'

/** Extra sharpen amount (0..150 scale) for the given output medium. */
export function outputSharpenAmount(target: SharpenTarget, amount: SharpenAmount): number {
  if (target === 'none') return 0
  const table = { screen: { low: 15, standard: 30, high: 50 }, print: { low: 25, standard: 45, high: 70 } }
  return table[target][amount]
}
