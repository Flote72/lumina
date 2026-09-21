import type { CurvePoint, ToneCurveParams } from '../params/params'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Sort by x and drop points with (almost) duplicate x. */
export function normalizePoints(points: CurvePoint[]): CurvePoint[] {
  const s = [...points].sort((a, b) => a.x - b.x)
  const out: CurvePoint[] = []
  for (const p of s) {
    const last = out[out.length - 1]
    if (last && p.x - last.x < 1e-6) out[out.length - 1] = p
    else out.push(p)
  }
  return out
}

/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson): never overshoots between points and
 * stays monotone whenever the data is monotone. Returns an evaluator clamped to [0,1].
 */
export function monotoneSpline(points: CurvePoint[]): (x: number) => number {
  const p = normalizePoints(points)
  const n = p.length
  if (n === 0) return (x) => clamp01(x)
  if (n === 1) return () => clamp01(p[0]!.y)
  const h: number[] = []
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(p[i + 1]!.x - p[i]!.x)
    d.push((p[i + 1]!.y - p[i]!.y) / h[i]!)
  }
  const m: number[] = new Array(n)
  m[0] = d[0]!
  m[n - 1] = d[n - 2]!
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i]! / d[i]!
      const b = m[i + 1]! / d[i]!
      const s = a * a + b * b
      if (s > 9) {
        const tau = 3 / Math.sqrt(s)
        m[i] = tau * a * d[i]!
        m[i + 1] = tau * b * d[i]!
      }
    }
  }
  return (x: number) => {
    if (x <= p[0]!.x) return clamp01(p[0]!.y)
    if (x >= p[n - 1]!.x) return clamp01(p[n - 1]!.y)
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (p[mid]!.x <= x) lo = mid
      else hi = mid
    }
    const t = (x - p[lo]!.x) / h[lo]!
    const t2 = t * t
    const t3 = t2 * t
    const y =
      (2 * t3 - 3 * t2 + 1) * p[lo]!.y +
      (t3 - 2 * t2 + t) * h[lo]! * m[lo]! +
      (-2 * t3 + 3 * t2) * p[lo + 1]!.y +
      (t3 - t2) * h[lo]! * m[lo + 1]!
    return clamp01(y)
  }
}

/** Parametric curve as control points: one knob per region, at the region's midpoint. */
export function parametricPoints(pc: ToneCurveParams['parametric']): CurvePoint[] {
  const A = 0.15
  const s1 = pc.split1 / 100
  const s2 = pc.split2 / 100
  const s3 = pc.split3 / 100
  const knobs: [number, number][] = [
    [s1 / 2, pc.shadows],
    [(s1 + s2) / 2, pc.darks],
    [(s2 + s3) / 2, pc.lights],
    [(s3 + 1) / 2, pc.highlights],
  ]
  const pts: CurvePoint[] = [{ x: 0, y: 0 }]
  let prev = 0
  for (const [x, amt] of knobs) {
    // keep the data monotone so the spline is too
    const y = Math.min(1, Math.max(prev, x + (amt / 100) * A))
    pts.push({ x, y })
    prev = y
  }
  pts.push({ x: 1, y: 1 })
  return pts
}

export function isIdentityCurve(tc: ToneCurveParams): boolean {
  const pc = tc.parametric
  if (pc.highlights || pc.lights || pc.darks || pc.shadows) return false
  return (['rgb', 'r', 'g', 'b'] as const).every((c) => {
    const pts = tc.points[c]
    return pts.length === 2 && pts[0]!.x === 0 && pts[0]!.y === 0 && pts[1]!.x === 1 && pts[1]!.y === 1
  })
}

/**
 * 256×1 RGBA8 LUT: R/G/B hold the complete per-channel curve
 * (parametric → RGB master → channel curve), applied to sRGB-encoded values.
 */
export function buildCurveLUT(tc: ToneCurveParams): Uint8Array {
  const param = monotoneSpline(parametricPoints(tc.parametric))
  const master = monotoneSpline(tc.points.rgb)
  const r = monotoneSpline(tc.points.r)
  const g = monotoneSpline(tc.points.g)
  const b = monotoneSpline(tc.points.b)
  const out = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const m = master(param(i / 255))
    out[i * 4] = Math.round(r(m) * 255)
    out[i * 4 + 1] = Math.round(g(m) * 255)
    out[i * 4 + 2] = Math.round(b(m) * 255)
    out[i * 4 + 3] = 255
  }
  return out
}
