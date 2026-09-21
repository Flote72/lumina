import type { Mask, MaskComponent, MaskOp } from '../params/params'

/**
 * Reference implementation of the mask maths. The GLSL in `render/shaders/mask.frag.glsl` implements the same
 * formulas; keeping them here makes them unit-testable.
 * Coordinates: `px`,`py` are ORIGINAL-image pixels; `W`,`H` the original size; L = max(W,H).
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Full effect at the start point, fading to nothing at the end point. */
export function evalLinear(c: { x0: number; y0: number; x1: number; y1: number }, px: number, py: number, W: number, H: number): number {
  const ax = c.x0 * W
  const ay = c.y0 * H
  const dx = c.x1 * W - ax
  const dy = c.y1 * H - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return 0
  const t = ((px - ax) * dx + (py - ay) * dy) / len2
  return 1 - smoothstep(0, 1, t)
}

/** Elliptical falloff: 1 inside (softened by `feather`), 0 outside the ellipse. */
export function evalRadial(
  c: { cx: number; cy: number; rx: number; ry: number; angle: number; feather: number },
  px: number,
  py: number,
  W: number,
  H: number,
): number {
  const L = Math.max(W, H)
  const dx = px - c.cx * W
  const dy = py - c.cy * H
  const a = -c.angle
  const x = dx * Math.cos(a) - dy * Math.sin(a)
  const y = dx * Math.sin(a) + dy * Math.cos(a)
  const rx = Math.max(c.rx * L, 1e-3)
  const ry = Math.max(c.ry * L, 1e-3)
  const d = Math.hypot(x / rx, y / ry)
  const inner = Math.min(1 - c.feather / 100 > 0 ? 1 - c.feather / 100 : 0, 0.999)
  return 1 - smoothstep(inner, 1, d)
}

/** Band-pass on (sRGB-encoded) luminance with soft edges. */
export function evalLuminance(c: { lo: number; hi: number; smooth: number }, L: number): number {
  const s = Math.max(c.smooth, 0.005)
  return smoothstep(c.lo - s, c.lo, L) * (1 - smoothstep(c.hi, c.hi + s, L))
}

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Similarity to a sampled colour (sRGB-encoded 0..1); `range` 0..100. Chroma matters more than lightness. */
export function evalColor(c: { r: number; g: number; b: number; range: number }, r: number, g: number, b: number): number {
  const lt = lum(c.r, c.g, c.b)
  const lp = lum(r, g, b)
  const dr = r - lp - (c.r - lt)
  const dg = g - lp - (c.g - lt)
  const db = b - lp - (c.b - lt)
  const d = Math.sqrt(dr * dr + dg * dg + db * db + (0.35 * (lp - lt)) ** 2)
  const rad = 0.04 + (0.5 - 0.04) * (c.range / 100)
  return 1 - smoothstep(rad * 0.4, rad, d)
}

/** Combine a component value into the running mask value. */
export function combine(op: MaskOp, acc: number, v: number): number {
  switch (op) {
    case 'add':
      return acc + v - acc * v // union
    case 'subtract':
      return acc * (1 - v)
    case 'intersect':
      return acc * v
  }
}

/** Evaluate a mask given a per-component sampler; applies per-component invert, mask invert and amount. */
export function evalMask(mask: Pick<Mask, 'components' | 'invert' | 'amount'>, sample: (c: MaskComponent) => number): number {
  let acc = 0
  for (const c of mask.components) {
    let v = clamp01(sample(c))
    if (c.invert) v = 1 - v
    acc = combine(c.op, acc, v)
  }
  if (mask.invert) acc = 1 - acc
  return clamp01(acc) * (mask.amount / 100)
}

/** Sampler for the geometric / range kinds (brush needs a bitmap and is supplied by the caller). */
export function sampleComponent(
  c: MaskComponent,
  ctx: { px: number; py: number; W: number; H: number; rgb: [number, number, number]; brush?: (c: MaskComponent) => number },
): number {
  switch (c.kind) {
    case 'linear':
      return evalLinear(c, ctx.px, ctx.py, ctx.W, ctx.H)
    case 'radial':
      return evalRadial(c, ctx.px, ctx.py, ctx.W, ctx.H)
    case 'luminance':
      return evalLuminance(c, lum(...ctx.rgb))
    case 'color':
      return evalColor(c, ...ctx.rgb)
    case 'brush':
      return ctx.brush ? ctx.brush(c) : 0
  }
}
