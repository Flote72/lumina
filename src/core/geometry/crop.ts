import type { CropParams } from '../params/params'

export type V2 = [number, number]

const rad = (d: number) => (d * Math.PI) / 180

export function rotate(v: V2, a: number): V2 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
}

/**
 * Conventions (image px, y down):
 *  - output→source: p = C + rotate(o, -θ)   (positive angle = image appears rotated clockwise)
 *  - "frame" = image rotated by θ about its centre; frame coords are relative to the image centre.
 *    The crop rectangle is axis-aligned in frame coords.
 */
export function frameToSource(q: V2, angleDeg: number, W: number, H: number): V2 {
  const r = rotate(q, -rad(angleDeg))
  return [W / 2 + r[0], H / 2 + r[1]]
}
export function sourceToFrame(p: V2, angleDeg: number, W: number, H: number): V2 {
  return rotate([p[0] - W / 2, p[1] - H / 2], rad(angleDeg))
}

/** Bounding size of the rotated image (what crop mode displays). */
export function frameSize(W: number, H: number, angleDeg: number): V2 {
  const c = Math.abs(Math.cos(rad(angleDeg)))
  const s = Math.abs(Math.sin(rad(angleDeg)))
  return [W * c + H * s, W * s + H * c]
}

export interface FrameRect {
  cx: number
  cy: number
  w: number
  h: number
}

export function cropToFrameRect(c: CropParams, W: number, H: number): FrameRect {
  const [cx, cy] = sourceToFrame([c.cx * W, c.cy * H], c.angle, W, H)
  return { cx, cy, w: c.w * W, h: c.h * H }
}

export function frameRectToCrop(r: FrameRect, angle: number, ratio: string, W: number, H: number): CropParams {
  const [px, py] = frameToSource([r.cx, r.cy], angle, W, H)
  return { cx: px / W, cy: py / H, w: r.w / W, h: r.h / H, angle, ratio }
}

/** Axis-aligned bounds (image px) of the rectangle's corners. */
function boundsInImage(r: FrameRect, angle: number, W: number, H: number) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const [x, y] = frameToSource([r.cx + (sx * r.w) / 2, r.cy + (sy * r.h) / 2], angle, W, H)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  return { minX, minY, maxX, maxY }
}

/** Rigidly slide the rect so it lies inside the image (no resizing). */
export function translateInside(r: FrameRect, angle: number, W: number, H: number): FrameRect {
  const b = boundsInImage(r, angle, W, H)
  let dx = 0
  let dy = 0
  if (b.minX < 0) dx = -b.minX
  else if (b.maxX > W) dx = W - b.maxX
  if (b.minY < 0) dy = -b.minY
  else if (b.maxY > H) dy = H - b.maxY
  if (dx === 0 && dy === 0) return r
  const [fx, fy] = rotate([dx, dy], rad(angle))
  return { ...r, cx: r.cx + fx, cy: r.cy + fy }
}

/** Slide, and if still too big, shrink about the centre (keeps aspect) until inside the image. */
export function fitInside(r: FrameRect, angle: number, W: number, H: number): FrameRect {
  let cur = translateInside(r, angle, W, H)
  const b = boundsInImage(cur, angle, W, H)
  const bw = b.maxX - b.minX
  const bh = b.maxY - b.minY
  const f = Math.min(1, W / bw, H / bh)
  if (f < 1) {
    cur = { ...cur, w: cur.w * f, h: cur.h * f }
    cur = translateInside(cur, angle, W, H)
  }
  return cur
}

export function isInside(r: FrameRect, angle: number, W: number, H: number, eps = 0.5): boolean {
  const b = boundsInImage(r, angle, W, H)
  return b.minX >= -eps && b.minY >= -eps && b.maxX <= W + eps && b.maxY <= H + eps
}

export function ratioValue(ratio: string, W: number, H: number): number | null {
  if (ratio === 'free') return null
  if (ratio === 'original') return W / H
  const [a, b] = ratio.split(':').map(Number)
  return a && b ? a / b : null
}

/** Re-shape the rect to a ratio (fits inside the current rect, same centre), then constrain to the image. */
export function applyRatio(r: FrameRect, ratio: number, angle: number, W: number, H: number): FrameRect {
  let { w, h } = r
  if (w / h > ratio) w = h * ratio
  else h = w / ratio
  return fitInside({ ...r, w, h }, angle, W, H)
}

export const RATIO_PRESETS = ['original', 'free', '1:1', '4:5', '5:7', '3:2', '4:3', '16:9', '16:10', '2:1'] as const

/** Swap orientation of a 'W:H' ratio (landscape ↔ portrait). */
export function flipRatio(ratio: string): string {
  const m = ratio.split(':')
  return m.length === 2 ? `${m[1]}:${m[0]}` : ratio
}

export type ZoomMode = 'fit' | 'fill' | '1:1' | '2:1' | 'custom'

/** Zoom in device px per output px. */
export function resolveZoom(mode: ZoomMode, custom: number, vw: number, vh: number, fw: number, fh: number): number {
  if (fw <= 0 || fh <= 0 || vw <= 0 || vh <= 0) return 1
  const fit = Math.min(vw / fw, vh / fh)
  switch (mode) {
    case 'fit':
      return fit * 0.97
    case 'fill':
      return Math.max(vw / fw, vh / fh)
    case '1:1':
      return 1
    case '2:1':
      return 2
    default:
      return custom
  }
}
